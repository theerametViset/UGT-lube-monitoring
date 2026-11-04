"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, CircleCheck, Cog, Download, Eye, Factory, Pencil, Trash2, TriangleAlert, Upload } from "lucide-react";
import { Card, Button, StatusBadge, HealthBar, ButtonLink } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createAsset, deleteAllAssets, deleteAsset, deleteAssets, exportAssetsJson, importAssets, updateAsset } from "@/lib/actions/assets";
import { downloadFile } from "@/lib/export";
import { useXlsxExport } from "@/lib/hooks/useXlsxExport";
import type { Asset, AssetStatus, AssetType, Site } from "@/lib/types";
import { readableText } from "@/lib/color";
import { ISSUES, type IssueKey } from "@/lib/asset-issues";
import { ISO_VG } from "@/lib/viscosity-limits";
import { assetsFromSheetRows } from "@/lib/asset-import";

const INP = "w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan";

function siteHref(siteCode: string, q: string, status: string, sort: string) {
  const p = new URLSearchParams();
  if (siteCode) p.set("site", siteCode);
  if (q) p.set("q", q);
  if (status) p.set("status", status);
  if (sort) p.set("sort", sort);
  const qs = p.toString();
  return qs ? "/assets?" + qs : "/assets";
}

function pageHref(base: { site: string; q: string; status: string; sort: string; issue: string }, pg: number) {
  const p = new URLSearchParams();
  if (base.issue) p.set("issue", base.issue);
  if (base.site) p.set("site", base.site);
  if (base.q) p.set("q", base.q);
  if (base.status) p.set("status", base.status);
  if (base.sort) p.set("sort", base.sort);
  if (pg > 1) p.set("page", String(pg));
  const qs = p.toString();
  return qs ? "/assets?" + qs : "/assets";
}

function pillCls(active: boolean) {
  return "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[14px] font-semibold transition " + (active ? "border-cyan bg-cyan/10 text-cyan" : "border-border bg-bg2 text-t2 hover:border-cyan/40 hover:bg-cyan/5");
}
function pillBadgeCls(active: boolean) {
  return "ml-0.5 rounded px-1 font-mono text-[14px] " + (active ? "bg-cyan/15 text-cyan" : "bg-black/[0.04] text-t3");
}

export function AssetDbClient({ rows, total, page, pages, site, q, status, sort, issue, issueCounts, sites, types, typeMap, siteCounts, canWrite, canDelete, canDeleteAll, canImport }: {
  rows: Asset[]; total: number; page: number; pages: number; site: string; q: string; status: AssetStatus | ""; sort: "" | "health_asc";
  issue: IssueKey | ""; issueCounts: Record<IssueKey, number>;
  sites: Site[]; types: AssetType[]; typeMap: Record<string, { abbr: string; color: string }>; siteCounts: Record<string, number>;
  canWrite: boolean; canDelete: boolean; canDeleteAll: boolean; canImport: boolean;
}) {
  const router = useRouter(); const toast = useToast(); const base = { site, q, status, sort, issue };
  const [deleteAllText, setDeleteAllText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Asset | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "one" | "bulk" | "all">(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); prev.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((prev) => { const on = rows.every((r) => prev.has(r.id)); const n = new Set(prev); rows.forEach((r) => on ? n.delete(r.id) : n.add(r.id)); return n; });
  function after(res: { ok: boolean; demo?: boolean; message: string }) {
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) { setConfirm(null); setEditing(null); setAddOpen(false); setSelected(new Set()); router.refresh(); }
  }
  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    if (!fd.get("id") || !fd.get("name")) { toast("กรุณากรอก ID และชื่อ", "warning"); return; }
    setBusy(true);
    const res = await createAsset({ id: String(fd.get("id")), name: String(fd.get("name")), type: String(fd.get("type")), site: String(fd.get("site")),
      vg_grade: numField(fd, "vg_grade", 46), motor_kw: numField(fd, "motor_kw", 75), rpm: numField(fd, "rpm", 1500),
      oil_brand: String(fd.get("oil_brand")), oil_qty_l: numField(fd, "oil_qty_l", 20), oil_change_months: numField(fd, "oil_change_months", 6),
      oil_sample_months: numField(fd, "oil_sample_months", 3) });
    setBusy(false); after(res);
  }
  // Blank field → fallback; 0 is kept (VG 0 = no VG: viscosity uses the generic Alarm Config limits). `|| 46` used to turn it into VG 46.
  function numField<T extends number | undefined>(fd: FormData, key: string, fallback: T): number | T {
    const v = String(fd.get(key) ?? "").trim();
    return v !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback;
  }
  async function onEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!editing) return; const fd = new FormData(e.currentTarget); setBusy(true);
    const res = await updateAsset(editing.id, { name: String(fd.get("name")), type: String(fd.get("type")), site: String(fd.get("site")),
      vg_grade: numField(fd, "vg_grade", editing.vg_grade), motor_kw: numField(fd, "motor_kw", editing.motor_kw ?? undefined), rpm: numField(fd, "rpm", editing.rpm ?? undefined),
      oil_brand: String(fd.get("oil_brand")), oil_qty_l: numField(fd, "oil_qty_l", editing.oil_qty_l), oil_change_months: numField(fd, "oil_change_months", editing.oil_change_months),
      oil_sample_months: numField(fd, "oil_sample_months", editing.oil_sample_months) });
    setBusy(false); after(res);
  }
  async function doDelete() {
    setBusy(true); let res;
    if (confirm === "one" && editing) res = await deleteAsset(editing.id);
    else if (confirm === "bulk") res = await deleteAssets([...selected]);
    else if (confirm === "all") res = await deleteAllAssets();
    setBusy(false); if (res) after(res);
  }
  async function onExport() {
    const json = await exportAssetsJson();
    downloadFile("ugt_" + new Date().toISOString().slice(0, 10) + ".json", json, "application/json");
    toast("ส่งออกสำเร็จ");
  }
  const { exporting: exportingXlsx, run: onExportExcel } = useXlsxExport(
    async () => JSON.parse(await exportAssetsJson()) as Asset[],
    {
      filenamePrefix: "assets",
      sheet: "Assets",
      headers: ["ID", "Name", "Type", "Site", "Health", "Status", "Install Date", "Motor kW", "RPM", "VG Grade", "Oil Brand", "Oil Qty (L)", "Oil Change (mo)", "Oil Sample (mo)", "Last Update"],
      mapRow: (a) => [a.id, a.name, a.type, a.site, a.health, a.status, a.install_date, a.motor_kw, a.rpm, a.vg_grade, a.oil_brand, a.oil_qty_l, a.oil_change_months, a.oil_sample_months, a.last_update],
    },
  );
  async function importParsed(data: unknown) {
    if (!Array.isArray(data)) { toast("รูปแบบไฟล์ไม่ถูกต้อง", "error"); return; }
    setBusy(true); const res = await importAssets(data); setBusy(false); after(res);
  }
  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (/\.xlsx$/i.test(f.name)) {
      // the Equipment sheet of the import template (or the first sheet of an Excel export)
      void f.arrayBuffer().then(async (buf) => {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buf, { type: "array", cellDates: true });
        const ws = wb.Sheets["Equipment"] ?? wb.Sheets[wb.SheetNames[0]];
        const rows = ws ? assetsFromSheetRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })) : [];
        if (!rows.length) { toast("ไม่พบแถวที่มีทั้ง ID และ Name", "error"); return; }
        await importParsed(rows);
      }).catch(() => toast("ไม่สามารถอ่านไฟล์", "error"));
      e.target.value = ""; return;
    }
    const r = new FileReader();
    r.onload = async (ev) => {
      try { await importParsed(JSON.parse(String(ev.target?.result ?? "[]")));
      } catch { toast("ไม่สามารถอ่านไฟล์", "error"); } };
    r.readAsText(f); e.target.value = "";
  }
  const grandTotal = Object.values(siteCounts).reduce((s, n) => s + n, 0);

  return (<div className="fade space-y-3">
    <Card className="py-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 font-sans text-[22px] max-sm:text-[18px] font-bold"><Cog className="h-4 w-4" aria-hidden />ฐานข้อมูลเครื่องจักร (Master Asset Database)</h2>
          <div className="text-[14px] text-t2">จัดการแก้ไขทรัพย์สินทั้งหมดในระบบ</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {canImport && (
            <>
              <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" aria-hidden />นำเข้า</Button>
              <input ref={fileRef} type="file" accept=".json,.xlsx" onChange={onImportFile} className="hidden" />
            </>
          )}
          <Button size="sm" variant="ghost" onClick={onExport}><Download className="h-3.5 w-3.5" aria-hidden />JSON</Button>
          <Button size="sm" variant="ghost" onClick={onExportExcel} disabled={exportingXlsx}>{exportingXlsx ? "กำลังส่งออก…" : <><Download className="h-3.5 w-3.5" aria-hidden />Excel</>}</Button>
          {canDelete && selected.size > 0 && <Button size="sm" variant="danger" onClick={() => setConfirm("bulk")}><Trash2 className="h-3.5 w-3.5" aria-hidden />ลบที่เลือก ({selected.size})</Button>}
          {canWrite && <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>+ เพิ่มเครื่องจักร</Button>}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <a href={siteHref("", q, status, sort)} className={pillCls(site === "")}><Factory className="h-3.5 w-3.5" aria-hidden />ทั้งหมด <span className={pillBadgeCls(true)}>{grandTotal}</span></a>
        {sites.map((s) => {
          const count = siteCounts[s.code] ?? 0; const active = site === s.code;
          return (<a key={s.code} href={siteHref(s.code, q, status, sort)} className={pillCls(active)}><Factory className="h-3.5 w-3.5" aria-hidden />{s.code} <span className={pillBadgeCls(active)}>{count}</span></a>);
        })}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(["", "Critical", "Warning", "Healthy"] as const).map((st) => (
          <a key={st || "all"} href={siteHref(site, q, st, sort)} className={pillCls(status === st)}>
            {st === "" ? "ทั้งหมด" : st === "Critical" ? "วิกฤต" : st === "Warning" ? "เฝ้าระวัง" : "ปกติ"}
          </a>
        ))}
        <a href={siteHref(site, q, status, sort ? "" : "health_asc")} className={pillCls(!!sort)}><ArrowUpDown className="h-3.5 w-3.5" aria-hidden />เรียงคะแนนน้อย→มาก</a>
      </div>

      <form method="get" action="/assets" className="flex flex-wrap items-center gap-2">
        {site && <input type="hidden" name="site" value={site} />}
        {status && <input type="hidden" name="status" value={status} />}
        {sort && <input type="hidden" name="sort" value={sort} />}
        <input name="q" defaultValue={q} placeholder="ค้นหาด้วย ID หรือชื่อ..." aria-label="ค้นหาเครื่องจักรด้วย ID หรือชื่อ" className="min-w-[200px] flex-1 rounded-pill border border-border bg-bg2 px-3 py-1.5 text-[14px] outline-none focus:border-cyan" />
        <button className="rounded-pill bg-cyan px-4 py-1.5 text-[14px] font-semibold text-white">ค้นหา</button>
      </form>
    </Card>

    {Object.values(issueCounts).some((n) => n > 0) && (
      <Card className="py-2.5">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[15px] font-semibold"><TriangleAlert className="h-4 w-4 text-yellow" aria-hidden />ข้อมูลที่ควรตรวจ</h3>
          {issue && <a href="/assets" className="text-[14px] text-cyan hover:underline">กลับไปดูทั้งหมด</a>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ISSUES) as IssueKey[]).filter((k) => issueCounts[k] > 0).map((k) => (
            <a key={k} href={issue === k ? "/assets" : `/assets?issue=${k}`} title={ISSUES[k].hint} aria-current={issue === k ? "true" : undefined} className={pillCls(issue === k)}>
              {ISSUES[k].label} <span className={pillBadgeCls(issue === k)}>{issueCounts[k]}</span>
            </a>
          ))}
        </div>
        {issue && <div className="mt-1.5 text-[14px] text-t2">{ISSUES[issue].hint}</div>}
      </Card>
    )}

    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="border-b border-border bg-black/[0.015] text-[13px] text-t3">
            {canDelete && <th scope="col" className="px-2.5 py-2"><input type="checkbox" onChange={toggleAll} checked={rows.length > 0 && rows.every((r) => selected.has(r.id))} aria-label="เลือกเครื่องจักรทั้งหมด" /></th>}
            <th scope="col" className="px-2.5 py-2">รหัส (ID)</th>
            <th scope="col" className="px-2.5 py-2">ชื่อเครื่องจักร</th>
            <th scope="col" className="px-2.5 py-2">ประเภท</th>
            <th scope="col" className="px-2.5 py-2">Site</th>
            <th scope="col" className="px-2.5 py-2">Condition</th>
            <th scope="col" className="px-2.5 py-2">Health score</th>
            <th scope="col" className="px-2.5 py-2">เก็บตัวอย่างล่าสุด</th>
            <th scope="col" className="px-2.5 py-2">ดำเนินการ</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={canDelete ? 9 : 8} className="px-2.5 py-3.5 text-center text-t3">ไม่พบข้อมูล</td></tr> : rows.map((a) => {
              const col = types.find((t) => t.name === a.type)?.color ?? "#94a3b8";
              return (<tr key={a.id} className="border-b border-black/[0.025] hover:bg-cyan/[0.025]">
                {canDelete && <td className="px-2.5 py-2"><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} aria-label={`เลือกเครื่องจักร ${a.id}`} /></td>}
                <td className="px-2.5 py-2 font-mono text-[14px] font-semibold text-cyan">{a.id}</td>
                <td className="px-2.5 py-2 text-[14px] font-medium">{a.name}</td>
                <td className="px-2.5 py-2"><span className="rounded border px-1.5 py-0.5 text-[14px]" style={{ color: readableText(col), borderColor: col + "33", background: col + "11" }}>{a.type}</span></td>
                <td className="px-2.5 py-2 text-[14px] text-t2"><span className="inline-flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" aria-hidden />{a.site}</span></td>
                <td className="px-2.5 py-2"><StatusBadge status={a.status} /></td>
                <td className="px-2.5 py-2"><HealthBar score={a.health} /></td>
                <td className="px-2.5 py-2 font-mono text-[13px] text-t3">{a.last_update}</td>
                <td className="px-2.5 py-2"><div className="flex gap-1">
                  <ButtonLink href={"/assets/" + a.id} size="xs" variant="ghost" aria-label={`ดูรายละเอียด ${a.name}`}><Eye className="h-3.5 w-3.5" aria-hidden /></ButtonLink>
                  {canWrite && <Button size="xs" variant="ghost" aria-label={`แก้ไข ${a.name}`} onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>}
                  {canDelete && <Button size="xs" variant="danger" aria-label={`ลบ ${a.name}`} onClick={() => { setEditing(a); setConfirm("one"); }}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>}
                </div></td>
              </tr>); })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[13px] text-t3">
        <span>แสดง {rows.length ? (page - 1) * 20 + 1 : 0}-{Math.min(total, page * 20)} จาก {total} รายการ {site ? <span className="inline-flex items-center gap-1">(<Factory className="h-3.5 w-3.5" aria-hidden />{site})</span> : ""}</span>
        <span className="flex gap-1.5">
          <ButtonLink href={pageHref(base, page - 1)} size="xs" disabled={page <= 1}>‹ ก่อนหน้า</ButtonLink>
          <span className="self-center px-1">{page}/{pages}</span>
          <ButtonLink href={pageHref(base, page + 1)} size="xs" disabled={page>= pages}>ถัดไป ›</ButtonLink>
        </span>
      </div>
    </Card>

    {/* Kept away from the everyday buttons: it used to sit next to "Excel" and "+ เพิ่ม". */}
    {canDeleteAll && (
      <div className="flex justify-end">
        <button type="button" onClick={() => { setDeleteAllText(""); setConfirm("all"); }} className="inline-flex items-center gap-1 text-[13px] text-t3 hover:text-red">
          <Trash2 className="h-3.5 w-3.5" aria-hidden />ลบเครื่องจักรทั้งหมดในระบบ…
        </button>
      </div>
    )}

    <Modal open={addOpen} onClose={() => setAddOpen(false)} title="+ เพิ่มเครื่องจักร">
      <AssetForm types={types} sites={sites} onSubmit={onAdd} busy={busy} submitLabel={<><CircleCheck className="h-3.5 w-3.5" aria-hidden />บันทึก</>} />
    </Modal>
    <Modal open={!!editing && confirm === null} onClose={() => setEditing(null)} title={<span className="flex items-center gap-1.5"><Pencil className="h-4 w-4" aria-hidden />แก้ไขข้อมูลเครื่องจักร</span>}>
      {editing && <AssetForm types={types} sites={sites} asset={editing} onSubmit={onEdit} busy={busy} submitLabel={<><CircleCheck className="h-3.5 w-3.5" aria-hidden />บันทึกการแก้ไข</>} />}
    </Modal>
    <Modal open={confirm !== null} onClose={() => { setConfirm(null); if (confirm === "one") setEditing(null); }} title={<span className="flex items-center gap-1.5"><TriangleAlert className="h-4 w-4" aria-hidden />ยืนยันการลบข้อมูล</span>}>
      <div className="mb-3.5 text-[14px] leading-relaxed text-t2">
        {confirm === "one" && editing && <>คุณกำลังจะลบ <b className="text-t1">{editing.name}</b> การดำเนินการนี้ไม่สามารถย้อนกลับได้</>}
        {confirm === "bulk" && <>คุณกำลังจะลบเครื่องจักรที่เลือก <b className="text-t1">{selected.size}</b> รายการ</>}
        {confirm === "all" && (
          <>
            คุณกำลังจะลบเครื่องจักร<b className="text-t1">ทั้งหมดในระบบ</b> พร้อมผลแล็บทุกงวด การดำเนินการนี้ไม่สามารถย้อนกลับได้
            <label className="mt-2.5 block">
              พิมพ์ <b className="text-red">ลบทั้งหมด</b> เพื่อยืนยัน
              <input value={deleteAllText} onChange={(e) => setDeleteAllText(e.target.value)} className={INP + " mt-1"} autoComplete="off" />
            </label>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => { setConfirm(null); if (confirm === "one") setEditing(null); }}>ยกเลิก</Button>
        <Button variant="danger" onClick={doDelete} disabled={busy || (confirm === "all" && deleteAllText.trim() !== "ลบทั้งหมด")}>{busy ? "กำลังลบ…" : <><Trash2 className="h-3.5 w-3.5" aria-hidden />ยืนยันลบ</>}</Button>
      </div>
    </Modal>
  </div>);
}

function AssetForm({ types, sites, asset, onSubmit, busy, submitLabel }: {
  types: AssetType[]; sites: Site[]; asset?: Asset;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; busy: boolean; submitLabel: React.ReactNode;
}) {
  return (<form onSubmit={onSubmit} className="space-y-2.5">
    <div className="grid grid-cols-2 gap-2.5">
      <Field label="รหัส (ID) *"><input name="id" required defaultValue={asset?.id} disabled={!!asset} className={INP + (!!asset ? " opacity-60" : "")} placeholder="RE-1001" /></Field>
      <Field label="ชื่อเครื่องจักร *"><input name="name" required defaultValue={asset?.name} className={INP} /></Field>
      <Field label="ประเภท"><select name="type" defaultValue={asset?.type ?? types[0]?.name} className={INP}>{types.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}</select></Field>
      <Field label="โรงงาน (Site)"><select name="site" defaultValue={asset?.site ?? sites[0]?.code} className={INP}>{sites.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}</select></Field>
      <Field label="ISO VG">
        {/* A list, not free typing: "2" instead of "220" made every viscosity score of a machine wrong. */}
        <select name="vg_grade" defaultValue={asset?.vg_grade ?? 46} className={INP}>
          <option value={0}>ไม่ระบุ VG (เช่น SAE) — ใช้เกณฑ์ความหนืดกลาง</option>
          {!!asset?.vg_grade && !(ISO_VG as readonly number[]).includes(asset.vg_grade) && (
            <option value={asset.vg_grade}>{asset.vg_grade} (ไม่ใช่เกรดมาตรฐาน)</option>
          )}
          {ISO_VG.map((g) => <option key={g} value={g}>VG {g}</option>)}
        </select>
      </Field>
      <Field label="กำลัง (kW)"><input type="number" name="motor_kw" defaultValue={asset?.motor_kw ?? 75} className={INP} /></Field>
      <Field label="RPM"><input type="number" name="rpm" defaultValue={asset?.rpm ?? 1500} className={INP} /></Field>
      <Field label="ปริมาณน้ำมัน (L)"><input type="number" name="oil_qty_l" defaultValue={asset?.oil_qty_l ?? 20} className={INP} /></Field>
      <Field label="รอบเปลี่ยนถ่าย (ด.)"><input type="number" name="oil_change_months" defaultValue={asset?.oil_change_months ?? 6} className={INP} /></Field>
      <Field label="รอบเก็บตัวอย่าง (ด.)"><input type="number" name="oil_sample_months" defaultValue={asset?.oil_sample_months ?? 3} className={INP} /></Field>
      <div className="col-span-2"><Field label="ชนิด/เบอร์น้ำมัน"><input name="oil_brand" defaultValue={asset?.oil_brand ?? ""} className={INP} placeholder="Shell Omala S2 G 46" /></Field></div>
    </div>
    <div className="flex justify-end gap-2 pt-1">
      <Button type="submit" variant="primary" disabled={busy}>{busy ? "กำลังบันทึก…" : submitLabel}</Button>
    </div>
  </form>);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="mb-1 block text-[13px] font-bold text-t3">{label}</span>{children}</label>);
}

