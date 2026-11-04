"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleCheck, FolderOpen, TriangleAlert, X } from "lucide-react";
import { Card, Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { getExistingOilKeys, saveOilBatch } from "@/lib/actions/readings";
import { armCarry, useCarry } from "@/lib/remount-carry";
import { isExcelLike, ACCEPTED_TYPES, MAX_FILE_MB } from "@/lib/parse/excel-utils";
import { matchTag, type TagMatch } from "@/lib/asset-match";
import { isPeriod, parseSamplingPeriod } from "@/lib/parse/period";
import type { BatchRow } from "@/lib/parse/batch";
import type { AssetOption } from "@/lib/queries/assets";

const INP = "rounded-md border border-border bg-bg2 px-1.5 py-1 font-mono text-[14px] outline-none focus:border-cyan";

// One parsed Excel row plus what the user decided for it. Nothing is created or
// guessed: a row is imported only once it points at an existing machine and a month.
interface Line {
  row: BatchRow;
  match: TagMatch;
  assetId: string;
  period: string;
  periodNote: "ok" | "ambiguous" | "missing";
  hasValues: boolean;
}

type Status = "ready" | "check" | "skip";

const rowKey = (l: Line) => `${l.assetId}|${l.period}`;

function oilValues(r: BatchRow): Record<string, number | string> {
  const v: Record<string, number | string> = {};
  if (r.visc != null) v.visc = r.visc;
  if (r.water != null) v.water = r.water;
  if (r.fe != null) v.fe = r.fe;
  if (r.tan != null) v.tan = r.tan;
  if (r.iso) v.iso_code = r.iso;
  if (r.particle_4 != null) v.particle_4 = r.particle_4;
  if (r.particle_6 != null) v.particle_6 = r.particle_6;
  if (r.particle_14 != null) v.particle_14 = r.particle_14;
  return v;
}

export function BatchImportClient({ assets, demo, localStore = false }: { assets: AssetOption[]; demo: boolean; localStore?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);
  // Machine + month pairs that already have a reading in the system, and the ones the
  // user agreed to overwrite: re-importing an old file must not silently replace values.
  // `lookup` = which file's machines/months `keys` answers; keys null = the lookup failed.
  const [existing, setExisting] = useState<{ lookup: string; keys: Set<string> | null }>({ lookup: "", keys: new Set() });
  const [tries, setTries] = useState(0); // bumped per picked file: re-picking the same file re-asks a failed check
  const [okOverwrite, setOkOverwrite] = useState<Set<string>>(new Set());
  // survive the remount that follows an import (lib/remount-carry.ts)
  useCarry<{ lines: Line[]; failures: string[] }>("dataentry:batch", (c) => {
    setLines(c.lines);
    setFailures(c.failures);
  });
  const ids = useMemo(() => new Set(assets.map((a) => a.id)), [assets]);

  // Same machine + month twice in one file: the second save would silently replace the first.
  const dupKeys = useMemo(() => {
    const seen = new Map<string, number>();
    for (const l of lines) if (l.hasValues && l.assetId && l.period) seen.set(rowKey(l), (seen.get(rowKey(l)) ?? 0) + 1);
    return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
  }, [lines]);
  const isDup = (l: Line) => dupKeys.has(rowKey(l));
  const isOverwrite = (l: Line) => !!existing.keys?.has(rowKey(l)) && !okOverwrite.has(rowKey(l));

  // Re-asked whenever the rows' machines or months change.
  const lookup = useMemo(() => {
    const rows = lines.filter((l) => l.hasValues && ids.has(l.assetId) && isPeriod(l.period));
    return JSON.stringify([[...new Set(rows.map((l) => l.assetId))].sort(), [...new Set(rows.map((l) => l.period))].sort()]);
  }, [lines, ids]);
  useEffect(() => {
    const [assetIds, periods] = JSON.parse(lookup) as [string[], string[]];
    if (assetIds.length === 0) { setExisting({ lookup, keys: new Set() }); return; }
    setExisting({ lookup: "", keys: new Set() });
    let cancelled = false;
    getExistingOilKeys(assetIds, periods)
      .then((keys) => { if (!cancelled) setExisting({ lookup, keys: keys ? new Set(keys) : null }); })
      .catch(() => { if (!cancelled) setExisting({ lookup, keys: null }); });
    return () => { cancelled = true; };
  }, [lookup, tries]);
  // Until the saved-readings check for *these* rows is back (and succeeded), nothing is "ready":
  // clicking import early must not overwrite saved values without asking.
  const existingReady = existing.lookup === lookup && existing.keys !== null;
  const existingFailed = existing.lookup === lookup && existing.keys === null;

  function statusOf(l: Line): Status {
    if (!l.hasValues) return "skip";
    // An ambiguous day/month is never imported on a guess (PRD §7.4).
    return ids.has(l.assetId) && isPeriod(l.period) && l.periodNote !== "ambiguous" && !isDup(l) && existingReady && !isOverwrite(l) ? "ready" : "check";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isExcelLike(file)) { toast("รองรับเฉพาะ Excel/CSV", "error"); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { toast(`ไฟล์ใหญ่เกิน ${MAX_FILE_MB}MB`, "error"); return; }
    setBusy(true);
    setFailures([]);
    setOkOverwrite(new Set());
    setTries((n) => n + 1);
    try {
      const { parseBatchExcel } = await import("@/lib/parse/batch");
      const parsed = await parseBatchExcel(file);
      if (parsed.length === 0) { toast("ไม่พบข้อมูลในไฟล์", "warning"); setBusy(false); return; }
      setLines(
        parsed.map((row) => {
          const match = matchTag(row.tag, assets);
          const p = parseSamplingPeriod(row.samplingDate);
          return {
            row,
            match,
            assetId: match.id ?? "",
            period: p?.period ?? "",
            periodNote: !p ? "missing" : p.ambiguous ? "ambiguous" : "ok",
            hasValues: Object.keys(oilValues(row)).length > 0,
          };
        }),
      );
    } catch {
      toast("อ่านไฟล์ไม่สำเร็จ", "error");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function update(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  const ambiguousCount = lines.filter((l) => l.periodNote === "ambiguous").length;
  const overwriteCount = lines.filter((l) => l.hasValues && isOverwrite(l)).length;
  const confirmOverwrite = (keys: string[]) => setOkOverwrite((s) => new Set([...s, ...keys]));
  const counts = lines.reduce((c, l) => (c[statusOf(l)]++, c), { ready: 0, check: 0, skip: 0 } as Record<Status, number>);

  async function importReady() {
    const ready = lines.filter((l) => statusOf(l) === "ready");
    if (ready.length === 0) return;
    setBusy(true);
    setSaving(ready.length);
    let res;
    try {
      res = await saveOilBatch(ready.map((l) => ({ assetId: l.assetId, period: l.period, values: oilValues(l.row) })));
    } catch {
      res = { ok: false, message: "เกิดข้อผิดพลาด กรุณาลองใหม่" };
    }
    setBusy(false);
    setSaving(0);
    if (res.demo) {
      toast("ตรวจทานได้ แต่ยังไม่บันทึกจริง", "info");
      return;
    }
    // No per-row result (permission / network): nothing was saved, keep every row.
    if (res.saved === undefined) {
      setFailures([res.message]);
      toast(res.message, "error");
      return;
    }
    const failed = res.failed ?? [];
    const failedKeys = new Set(res.failedKeys ?? []);
    setFailures(failed);
    toast(failed.length ? `นำเข้า ${res.saved} สำเร็จ · ไม่สำเร็จ ${failed.length}` : `นำเข้าสำเร็จ ${res.saved} รายการ`, failed.length ? "warning" : "success");
    // keep the rows still needing attention — and the ones that failed to save — so
    // they can be fixed and imported again without re-uploading the file
    const left = lines.filter((l) => statusOf(l) !== "ready" || failedKeys.has(rowKey(l)));
    setLines(left);
    armCarry("dataentry:batch", { lines: left, failures: failed });
    armCarry("dataentry:batch-open", true);
    router.refresh();
  }

  return (
    <div className="fade space-y-3">
      <div className="text-[14px] text-t2">
        อ่านทุกแถวในไฟล์ Excel → จับคู่ TAG กับเครื่องจักรในระบบ → ตรวจทาน → บันทึกผลแล็บ (ไม่สร้างเครื่องจักรใหม่ให้อัตโนมัติ)
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <input ref={fileRef} type="file" accept={ACCEPTED_TYPES} onChange={onFile} className="hidden" />
            <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              <FolderOpen className="h-3.5 w-3.5" aria-hidden />เลือกไฟล์ Excel
            </Button>
          </div>
          {lines.length > 0 && (
            <Button variant="ok" onClick={importReady} disabled={busy || counts.ready === 0}>
              {saving > 0 ? `กำลังนำเข้า ${saving} รายการ…` : <><CircleCheck className="h-3.5 w-3.5" aria-hidden />{`นำเข้า ${counts.ready} รายการที่พร้อม`}</>}
            </Button>
          )}
        </div>

        {failures.length > 0 && (
          <div role="alert" className="mt-3 rounded-lg border border-red/30 bg-red/[0.05] p-2.5 text-[14px] text-t1">
            <div className="mb-1 font-semibold text-red">บันทึกไม่สำเร็จ {failures.length} รายการ</div>
            <ul className="list-disc space-y-0.5 pl-4">{failures.slice(0, 8).map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        )}
      </Card>

      {lines.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border p-2 text-[14px]">
            <span className="font-semibold">พบ {lines.length} รายการในไฟล์</span>
            <span className="text-green"><Check className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />พร้อม {counts.ready}</span>
            <span className="text-yellow"><TriangleAlert className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />ต้องตรวจ {counts.check}</span>
            {counts.skip > 0 && <span className="text-t3">ไม่มีค่าผลตรวจ {counts.skip}</span>}
            {!existingReady && !existingFailed && <span className="text-t3">กำลังตรวจผลเดิมในระบบ…</span>}
            {existingFailed && <span className="text-red">ตรวจผลเดิมในระบบไม่สำเร็จ — ยังนำเข้าไม่ได้ ลองเลือกไฟล์ใหม่</span>}
            {overwriteCount > 0 && (
              <button
                type="button"
                onClick={() => confirmOverwrite(lines.filter(isOverwrite).map(rowKey))}
                className="ml-auto rounded border border-yellow/40 px-2 py-0.5 text-yellow hover:bg-yellow/10"
              >
                ยืนยันทับผลเดิมทุกแถว ({overwriteCount})
              </button>
            )}
            {ambiguousCount > 0 && (
              <button
                type="button"
                onClick={() => setLines((ls) => ls.map((l) => (l.periodNote === "ambiguous" ? { ...l, periodNote: "ok" } : l)))}
                className="ml-auto rounded border border-cyan/30 px-2 py-0.5 text-cyan hover:bg-cyan/10"
              >
                ยืนยันเดือนทุกแถวที่กำกวม ({ambiguousCount})
              </button>
            )}
          </div>
          {/* one shared list for every row's machine field — typing filters 800+ ids natively */}
          <datalist id="batch-asset-ids">
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.site}</option>)}
          </datalist>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="sticky top-0 bg-bg2">
                <tr className="border-b border-border text-[13px] text-t3">
                  <th scope="col" className="px-2.5 py-2">TAG ในไฟล์</th>
                  <th scope="col">เครื่องจักรในระบบ</th>
                  <th scope="col">งวด</th>
                  <th scope="col">Fe</th>
                  <th scope="col">Visc</th>
                  <th scope="col">Water</th>
                  <th scope="col">TAN</th>
                  <th scope="col">ISO</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const st = statusOf(l);
                  const known = ids.has(l.assetId);
                  return (
                    <tr key={i} className={`border-b border-black/[0.04] align-top ${st === "check" ? "bg-yellow/[0.05]" : st === "skip" ? "opacity-60" : ""}`}>
                      <td className="px-2.5 py-1.5 font-mono">{l.row.tag || <span className="font-sans text-yellow"><TriangleAlert className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />ไม่มี TAG</span>}</td>
                      <td className="py-1.5 pr-2">
                        <input
                          list="batch-asset-ids"
                          value={l.assetId}
                          onChange={(e) => update(i, { assetId: e.target.value.trim() })}
                          placeholder="พิมพ์/เลือกรหัสเครื่อง"
                          aria-label={`เครื่องจักรสำหรับแถว ${l.row.tag || i + 1}`}
                          className={`${INP} w-[150px] ${l.assetId && !known ? "border-red" : ""}`}
                        />
                        <div className="mt-0.5 text-[12px]">
                          {known && l.match.kind === "exact" && l.assetId === l.match.id && <span className="text-green"><Check className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />ตรง</span>}
                          {known && l.match.kind === "normalized" && l.assetId === l.match.id && <span className="text-green"><Check className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />จับคู่ (เขียนต่างกัน)</span>}
                          {known && l.assetId !== l.match.id && <span className="text-green"><Check className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />เลือกเอง</span>}
                          {!known && l.assetId && <span className="text-red">ไม่มีรหัสนี้ในระบบ</span>}
                          {!l.assetId && l.match.kind === "suggest" && (
                            <span className="flex flex-wrap items-center gap-1 text-t3">
                              ≈ ใกล้เคียง:
                              {l.match.suggestions.map((s) => (
                                <button key={s.id} type="button" onClick={() => update(i, { assetId: s.id })} className="rounded border border-cyan/30 px-1 font-mono text-cyan hover:bg-cyan/10" title={`${s.name} · ${s.site}`}>
                                  {s.id}
                                </button>
                              ))}
                            </span>
                          )}
                          {!l.assetId && l.match.kind === "none" && <span className="text-red"><X className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />ไม่พบในระบบ — เลือกเอง หรือเพิ่มเครื่องในฐานข้อมูลก่อน</span>}
                          {!l.assetId && l.match.kind === "empty" && <span className="text-yellow">เลือกเครื่องที่เป็นเจ้าของผลนี้</span>}
                        </div>
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="month"
                          value={l.period}
                          onChange={(e) => update(i, { period: e.target.value, periodNote: "ok" })}
                          aria-label={`งวดของแถว ${l.row.tag || i + 1}`}
                          className={`${INP} ${!l.period ? "border-red" : ""}`}
                        />
                        <div className="mt-0.5 text-[12px] text-t3">
                          {l.periodNote === "missing" && <span className="text-red">อ่านวันที่ไม่ได้{l.row.samplingDate ? ` ("${l.row.samplingDate}")` : ""}</span>}
                          {l.periodNote === "ambiguous" && (
                            <span className="text-yellow">
                              <TriangleAlert className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />{l.row.samplingDate} — วัน/เดือนกำกวม ตรวจสอบ{" "}
                              <button type="button" onClick={() => update(i, { periodNote: "ok" })} className="rounded border border-cyan/30 px-1 text-cyan hover:bg-cyan/10">
                                ใช้เดือนนี้
                              </button>
                            </span>
                          )}
                          {l.periodNote === "ok" && l.row.samplingDate && <span>{l.row.samplingDate}</span>}
                          {isDup(l) && <div className="text-red">ซ้ำกับอีกแถว (เครื่องและงวดเดียวกัน) — แก้งวดหรือเครื่องให้ถูก</div>}
                          {l.hasValues && isOverwrite(l) && (
                            <div className="text-yellow">
                              <TriangleAlert className="mr-0.5 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />มีผลงวดนี้ในระบบแล้ว — ค่าในไฟล์จะทับ{" "}
                              <button type="button" onClick={() => confirmOverwrite([rowKey(l)])} className="rounded border border-cyan/30 px-1 text-cyan hover:bg-cyan/10">
                                ยืนยันทับ
                              </button>
                            </div>
                          )}
                          {l.hasValues && existing.keys?.has(rowKey(l)) && !isOverwrite(l) && <div>จะทับผลเดิมของงวดนี้</div>}
                        </div>
                      </td>
                      <td className="py-1.5 font-mono">{l.row.fe ?? "—"}</td>
                      <td className="py-1.5 font-mono">{l.row.visc ?? "—"}</td>
                      <td className="py-1.5 font-mono">{l.row.water ?? "—"}</td>
                      <td className="py-1.5 font-mono">{l.row.tan ?? "—"}</td>
                      <td className="py-1.5 font-mono text-t3">{l.row.iso ?? (st === "skip" ? "ไม่มีค่า" : "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {demo && !localStore && (
        <Card>
          <div className="rounded-lg border border-yellow/30 bg-yellow/[0.06] p-2.5 text-[14px] text-yellow">
            <TriangleAlert className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />ตรวจทานได้ แต่ยังไม่บันทึกจริง (ต้องเชื่อม Supabase หรือเปิด Local Store)
          </div>
        </Card>
      )}
    </div>
  );
}
