"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, CalendarDays, Database, Droplet, FlaskConical, Factory, FileSpreadsheet, FileText, Paperclip, Pin, Search, TriangleAlert, Upload } from "lucide-react";
import { getAssetAlarmConfigAction } from "@/lib/actions/alarms";
import { getViscosityLimits } from "@/lib/viscosity-limits";
import { Card, Button, StatusBadge } from "@/components/ui/primitives";
import { SaveDrop } from "@/components/ui/LubeIcons";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { BatchImportClient } from "./BatchImportClient";
import { getSavedReadings, saveReading } from "@/lib/actions/readings";
import { OIL_FIELDS, VIB_FIELDS, addCleared, showSaved } from "@/lib/reading-fields";
import { previewReading, type ReadingPreview } from "@/lib/actions/audit";
import { healthColor, statusFromHealth } from "@/lib/scoring/health";
import type { ReadingLevel } from "@/lib/scoring/audit";
import { registerAttachment } from "@/lib/actions/attachments";
import { matchTag, type TagMatch } from "@/lib/asset-match";
import { parseSamplingPeriod } from "@/lib/parse/period";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import {
  isExcelLike,
  isPdf,
  ACCEPTED_TYPES,
  MAX_FILE_MB,
} from "@/lib/parse/excel-utils";
import { sanitizeFileName } from "@/lib/format";
import type { AssetOption } from "@/lib/queries/assets";
import type { AlarmParam, AssetStatus, Site } from "@/lib/types";
import { readableText } from "@/lib/color";
import { armCarry, dropCarries, useCarry } from "@/lib/remount-carry";

type Notice = { tone: "ok" | "info" | "error" | "warn"; text: string };
const FLASH_KEY = "dataentry:after-save";
const BATCH_OPEN_KEY = "dataentry:batch-open";
type SaveFlash = {
  at: number;
  selectedId: string;
  notice: Notice;
};

const NOTICE_STYLE: Record<Notice["tone"], string> = {
  ok: "border-green/40 bg-green/[0.07] text-t1",
  info: "border-cyan/40 bg-cyan/[0.06] text-t1",
  warn: "border-yellow/50 bg-yellow/[0.08] text-t1",
  error: "border-red/40 bg-red/[0.06] text-t1",
};

const fmtNum = (n: number) => String(Number(n.toFixed(2)));

const INP =
  "w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan";
const ISO_RE = /^\d{1,2}(?:\.\d+)?\/\d{1,2}(?:\.\d+)?\/\d{1,2}(?:\.\d+)?$/;

export function DataEntryClient({
  assets,
  sites,
  demo,
  localStore = false,
  canUpload,
  canSave = true,
  initialAssetId,
}: {
  assets: AssetOption[];
  sites: Site[];
  demo: boolean;
  /** Demo Mode that really saves readings + files to disk (lib/local-store.ts). */
  localStore?: boolean;
  canUpload: boolean;
  /** readings:write — without it the form is look-only (no Submit, no batch import). */
  canSave?: boolean;
  initialAssetId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(() => (initialAssetId && assets.some((a) => a.id === initialAssetId) ? initialAssetId : ""));
  const [site, setSite] = useState("");
  const [selectedId, setSelectedId] = useState(() =>
    initialAssetId && assets.some((a) => a.id === initialAssetId) ? initialAssetId : assets[0]?.id ?? "",
  );
  const [kind, setKind] = useState<"oil" | "vib">("oil");
  // Local date: toISOString() is UTC, so before 07:00 in Thailand it gave yesterday (last month on the 1st).
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  // A lab file whose TAG didn't resolve to one machine: saving waits for an explicit choice.
  const [tagIssue, setTagIssue] = useState<{ file: string; tag: string; match: TagMatch } | null>(null);
  const [isoErr, setIsoErr] = useState(false);
  const [busy, setBusy] = useState(false);
  // a moment of "saved" on the button itself, so the success is seen where the click was
  const [justSaved, setJustSaved] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);

  const [oil, setOil] = useState({ fe: "", water: "", visc: "", iso: "", tan: "", p4: "", p6: "", p14: "" });
  const [vib, setVib] = useState({ vel: "", acc: "", cf: "", temp: "" });
  const oilRef = useRef(oil);
  oilRef.current = oil;
  const vibRef = useRef(vib);
  vibRef.current = vib;
  const editOil = (f: keyof typeof oil, v: string) => { touched.current.add(f); setOil((o) => ({ ...o, [f]: v })); };
  const editVib = (f: keyof typeof vib, v: string) => { touched.current.add(f); setVib((o) => ({ ...o, [f]: v })); };

  // Values already saved for this machine + period are shown in the form. A shown
  // value the user empties is sent as null (deleted); saveReading leaves fields
  // that aren't sent alone. `touched` = fields the user typed in or a lab file
  // filled: they keep their value when the machine or period changes.
  const savedRef = useRef<Awaited<ReturnType<typeof getSavedReadings>>>({ oil: null, vib: null });
  const touched = useRef(new Set<string>());
  const [savedVersion, setSavedVersion] = useState(0);
  const period = date.slice(0, 7);
  useEffect(() => {
    let cancelled = false;
    // Blank the previous machine/period's values at once, so none of them can be
    // saved to this one while its own values load — or if that load fails. An
    // emptied field has nothing to keep, so it stops counting as touched.
    const show = (saved: Awaited<ReturnType<typeof getSavedReadings>>) => {
      setOil((f) => showSaved(f, OIL_FIELDS, touched.current, saved.oil));
      setVib((f) => showSaved(f, VIB_FIELDS, touched.current, saved.vib));
    };
    for (const f of [...touched.current]) if ((oilRef.current as Record<string, string>)[f] === "" || (vibRef.current as Record<string, string>)[f] === "") touched.current.delete(f);
    savedRef.current = { oil: null, vib: null };
    show(savedRef.current);
    const load = selectedId ? getSavedReadings(selectedId, period) : Promise.resolve({ oil: null, vib: null });
    load
      .then((next) => {
        if (cancelled) return;
        savedRef.current = next;
        show(next);
      })
      .catch(() => { /* showing saved values is a convenience — entry still works */ });
    return () => { cancelled = true; };
  }, [selectedId, period, savedVersion]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return assets
      .filter((a) => (!site || a.site === site) && (!ql || `${a.id} ${a.name}`.toLowerCase().includes(ql)))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [assets, q, site]);
  // After a save: the next machine of the same plant, in the picker's ID order.
  const nextAsset = useMemo(() => {
    const cur = assets.find((a) => a.id === selectedId);
    const same = assets.filter((a) => a.site === cur?.site).sort((a, b) => a.id.localeCompare(b.id));
    return same[same.findIndex((a) => a.id === selectedId) + 1];
  }, [assets, selectedId]);

  const selected = assets.find((a) => a.id === selectedId) ?? null;

  // Live score preview — debounced so typing doesn't fire a request per key.
  const [preview, setPreview] = useState<ReadingPreview | null>(null);
  const valuesKey = useMemo(() => {
    const src: Record<string, string> = kind === "oil"
      ? { fe: oil.fe, water: oil.water, visc: oil.visc, tan: oil.tan }
      : { ...vib };
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(src)) {
      if (v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0) out[k] = Number(v);
    }
    return JSON.stringify(out);
  }, [kind, oil, vib]);
  useEffect(() => {
    const values = JSON.parse(valuesKey) as Record<string, number>;
    if (!selectedId || Object.keys(values).length === 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await previewReading({ assetId: selectedId, kind, period: date.slice(0, 7), values });
      if (!cancelled) setPreview(res);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [selectedId, kind, date, valuesKey]);
  const lvl = (key: string) => preview?.levels[key];

  // The selected machine's effective limits (global + its own overrides), shown under each field.
  const [cfgParams, setCfgParams] = useState<AlarmParam[] | null>(null);
  useEffect(() => {
    setCfgParams(null);
    if (!selectedId) return;
    let cancelled = false;
    getAssetAlarmConfigAction(selectedId)
      .then((c) => { if (!cancelled) setCfgParams(c.params); })
      .catch(() => { /* limits are a hint — the form still works without them */ });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Same words as the status badges (เฝ้าระวัง / วิกฤต); the idle hint shows the limits as coloured chips.
  function fieldHint(key: string, raw: string): FieldHint | undefined {
    const p = cfgParams?.find((x) => x.category === kind && x.key === key);
    if (!p) return undefined;
    const unit = p.unit ? ` ${p.unit}` : "";
    const val = raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
    const level = val == null ? undefined : lvl(key);
    if (key === "visc" && selected?.vg_grade) {
      const l = getViscosityLimits(selected.vg_grade);
      const limits = { warn: `< ${l.normalMin} หรือ > ${l.warn}`, crit: `< ${l.cautionMin} หรือ > ${l.crit}`, unit: `${unit} (VG ${selected.vg_grade})` };
      if ((level === "warn" || level === "crit") && val != null) {
        const side = val < l.normalMin ? "ต่ำกว่าช่วงปกติ" : "สูงกว่าช่วงปกติ";
        return { level, text: `${level === "crit" ? "วิกฤต" : "เฝ้าระวัง"}: ${side} (ปกติ ${l.normalMin}–${l.warn}${unit})` };
      }
      return { limits };
    }
    const w = p.warn_limit ?? 0;
    const c = p.crit_limit ?? 0;
    if (level === "crit" && val != null) return { level, text: `วิกฤต: เกินเกณฑ์ ${c}${unit} อยู่ ${fmtNum(val - c)}` };
    if (level === "warn" && val != null) return { level, text: `เฝ้าระวัง: เกิน ${w}${unit} อยู่ ${fmtNum(val - w)} · วิกฤตที่ > ${c}` };
    return { limits: { warn: `> ${w}`, crit: `> ${c}`, unit } };
  }

  // Save outcome shown inline (a toast here used to cover the Submit button).
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    setNotice(null);
  }, [selectedId]);
  // The refresh after a save remounts this component; pick the post-save state back up
  // (lib/remount-carry.ts). Declared after the selectedId effect so it wins on mount.
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  useCarry<SaveFlash>(FLASH_KEY, (f) => {
    if (f.selectedId !== selectedRef.current) return;
    setNotice(f.notice);
  });
  useCarry<boolean>(BATCH_OPEN_KEY, (open) => setBatchOpen(open));
  // Worst field level of the previewed reading (null = every value within limits).
  const overLimit: "warn" | "crit" | null = !preview || preview.olderThanLatest
    ? null
    : Object.values(preview.levels).includes("crit")
      ? "crit"
      : Object.values(preview.levels).includes("warn") ? "warn" : null;

  // Keyboard picker: one listbox, aria-activedescendant cursor.
  const listRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [listFocused, setListFocused] = useState(false);
  const optId = (i: number) => `asset-opt-${i}`;
  useEffect(() => setActiveIdx(0), [q, site]);

  function moveActive(next: number) {
    if (!filtered.length) return;
    const i = Math.max(0, Math.min(filtered.length - 1, next));
    setActiveIdx(i);
    document.getElementById(optId(i))?.scrollIntoView({ block: "nearest" });
  }
  function pickAsset(id: string, focusForm: boolean) {
    setSelectedId(id);
    if (focusForm) requestAnimationFrame(() => firstFieldRef.current?.focus());
  }
  function onListFocus() {
    setListFocused(true);
    const i = filtered.findIndex((a) => a.id === selectedId);
    if (i >= 0 && i !== activeIdx) moveActive(i);
  }
  function onListKey(e: React.KeyboardEvent) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => moveActive(activeIdx + 1),
      ArrowUp: () => moveActive(activeIdx - 1),
      PageDown: () => moveActive(activeIdx + 10),
      PageUp: () => moveActive(activeIdx - 10),
      Home: () => moveActive(0),
      End: () => moveActive(filtered.length - 1),
      Enter: () => filtered[activeIdx] && pickAsset(filtered[activeIdx].id, true),
      " ": () => filtered[activeIdx] && pickAsset(filtered[activeIdx].id, true),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && filtered[0]) {
      e.preventDefault();
      setActiveIdx(0);
      pickAsset(filtered[0].id, true);
    } else if (e.key === "ArrowDown" && filtered.length) {
      e.preventDefault();
      listRef.current?.focus();
    }
  }

  function validateISO(v: string) {
    setIsoErr(v !== "" && !ISO_RE.test(v));
  }

  async function onFilesPicked(list: FileList | null) {
    if (!list) return;
    // One lab Excel per record: each one overwrites the form (values, TAG, date), so a
    // second file would silently replace the first and every file would be filed under
    // the last one's month. Several months belong in Batch import.
    let excelCount = files.filter(isExcelLike).length;
    const skippedExcel: string[] = [];
    for (const file of Array.from(list)) {
      const extOk = isExcelLike(file) || isPdf(file);
      if (!extOk) {
        toast(`ไฟล์ "${file.name}" ไม่รองรับ (PDF/Excel/CSV เท่านั้น)`, "error");
        continue;
      }
      if (isExcelLike(file) && excelCount >= 1) {
        skippedExcel.push(file.name);
        continue;
      }
      if (isExcelLike(file)) excelCount++;
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast(`ไฟล์ "${file.name}" ใหญ่เกิน ${MAX_FILE_MB}MB`, "error");
        continue;
      }
      // Excel/CSV → parse and prefill
      if (isExcelLike(file)) {
        setParsing(true);
        try {
          const { parseLabExcel } = await import("@/lib/parse/excel");
          const parsed = await parseLabExcel(file);
          if (parsed.matched.length > 0) {
            const po = parsed.oil as Record<string, number | null | undefined>;
            const fromLab: [string, unknown][] = [["fe", po.fe], ["water", po.water], ["visc", po.visc], ["tan", po.tan], ["iso", parsed.iso], ["p4", po.particle_4], ["p6", po.particle_6], ["p14", po.particle_14], ["vel", parsed.vib.vel], ["acc", parsed.vib.acc], ["cf", parsed.vib.cf], ["temp", parsed.vib.temp]];
            for (const [f, v] of fromLab) if (v != null) touched.current.add(f);
            setOil((prev) => ({
              ...prev,
              fe: parsed.oil.fe != null ? String(parsed.oil.fe) : prev.fe,
              water: parsed.oil.water != null ? String(parsed.oil.water) : prev.water,
              visc: parsed.oil.visc != null ? String(parsed.oil.visc) : prev.visc,
              tan: parsed.oil.tan != null ? String(parsed.oil.tan) : prev.tan,
              iso: parsed.iso ?? prev.iso,
              p4: (parsed.oil as Record<string, number | null>).particle_4 != null ? String((parsed.oil as Record<string, number | null>).particle_4) : prev.p4,
              p6: (parsed.oil as Record<string, number | null>).particle_6 != null ? String((parsed.oil as Record<string, number | null>).particle_6) : prev.p6,
              p14: (parsed.oil as Record<string, number | null>).particle_14 != null ? String((parsed.oil as Record<string, number | null>).particle_14) : prev.p14,
            }));
            setVib((prev) => ({
              ...prev,
              vel: parsed.vib.vel != null ? String(parsed.vib.vel) : prev.vel,
              acc: parsed.vib.acc != null ? String(parsed.vib.acc) : prev.acc,
              cf: parsed.vib.cf != null ? String(parsed.vib.cf) : prev.cf,
              temp: parsed.vib.temp != null ? String(parsed.vib.temp) : prev.temp,
            }));
            toast(`ดึงค่าจาก "${file.name}" แล้ว: ${parsed.matched.join(", ")} — กรุณาตรวจสอบ`, "success");
          } else {
            toast(`ไม่พบค่าที่ตรงใน "${file.name}" (แนบไฟล์ได้อยู่)`, "warning");
          }
          // Machine from the file's TAG. Exact or same-once-normalized ("34u02b" → 34-U02-B)
          // is selected; anything else waits for the user to pick — never a guessed or
          // auto-created machine, and never silently the one that happened to be selected.
          const match = matchTag(parsed.tag, assets);
          if (match.id) {
            setSelectedId(match.id);
            setTagIssue(null);
            toast(
              match.kind === "normalized" ? `TAG "${parsed.tag}" → เลือก ${match.id}` : `เลือกเครื่องจักร ${match.id} อัตโนมัติ`,
              "info",
            );
          } else {
            setTagIssue({ file: file.name, tag: parsed.tag ?? "", match });
          }
          // Period from the file's sampling date (only the month is stored)
          if (parsed.samplingDate) {
            const p = parseSamplingPeriod(parsed.samplingDate);
            if (!p) {
              toast(`อ่านวันที่ "${parsed.samplingDate}" ไม่ได้ — ใช้วันที่ในฟอร์ม กรุณาตรวจสอบ`, "warning");
            } else {
              setDate((d) => (d.slice(0, 7) === p.period ? d : `${p.period}-01`));
              if (p.ambiguous) toast(`วันที่ "${parsed.samplingDate}" วัน/เดือนกำกวม — ตั้งเป็นงวด ${p.period} กรุณาตรวจสอบ`, "warning");
            }
          }
        } catch {
          toast(`อ่านไฟล์ "${file.name}" ไม่สำเร็จ`, "error");
        } finally {
          setParsing(false);
        }
      }
      setFiles((prev) => [...prev, file]);
    }
    if (fileRef.current) fileRef.current.value = "";
    if (skippedExcel.length) {
      setNotice({
        tone: "warn",
        text: `แนบ Excel ได้ 1 ไฟล์ต่อ 1 ผลตรวจ — ไม่ได้แนบ: ${skippedExcel.join(", ")}. ไฟล์หลายเดือน/หลายเครื่องให้ใช้ "นำเข้าไฟล์ Excel (Batch)" ด้านบน`,
      });
    }
  }

  function removeFile(idx: number) {
    if (tagIssue && files[idx]?.name === tagIssue.file) setTagIssue(null);
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit() {
    if (!selectedId) {
      setNotice({ tone: "warn", text: "กรุณาเลือกเครื่องจักร" });
      return;
    }
    if (tagIssue) {
      setNotice({ tone: "warn", text: `ยืนยันก่อนว่าไฟล์ "${tagIssue.file}" เป็นผลของเครื่องไหน (กล่องสีเหลืองด้านบน)` });
      return;
    }
    const period = date.slice(0, 7);
    if (kind === "oil") {
      const values: Record<string, number | string | null> = {};
      (["fe", "water", "visc", "tan"] as const).forEach((k) => {
        if (oil[k] !== "") values[k] = Number(oil[k]);
      });
      if (oil.iso) values.iso_code = oil.iso;
      if (oil.p4) values.particle_4 = Number(oil.p4);
      if (oil.p6) values.particle_6 = Number(oil.p6);
      if (oil.p14) values.particle_14 = Number(oil.p14);
      addCleared(values, oil, OIL_FIELDS, savedRef.current.oil);
      if (isoErr) {
        setNotice({ tone: "error", text: "รูปแบบ ISO Code ไม่ถูกต้อง (XX/XX/XX)" });
        return;
      }
      if (Object.keys(values).length === 0 && files.length === 0) {
        setNotice({ tone: "warn", text: "กรุณากรอกผลตรวจอย่างน้อย 1 ค่า หรือแนบไฟล์" });
        return;
      }
      for (const k of ["fe", "water", "visc", "tan", "p4", "p6", "p14"] as const) {
        if (oil[k] !== "" && Number(oil[k]) < 0) {
          setNotice({ tone: "error", text: "ค่าไม่สามารถเป็นลบ" });
          return;
        }
      }
      setBusy(true);
      const res = await saveReading({ assetId: selectedId, period, kind: "oil", values });
      await afterSave(res, period, "oil");
    } else {
      const values: Record<string, number | string | null> = {};
      (["vel", "acc", "cf", "temp"] as const).forEach((k) => {
        if (vib[k] !== "") values[k] = Number(vib[k]);
      });
      addCleared(values, vib, VIB_FIELDS, savedRef.current.vib);
      if (Object.keys(values).length === 0 && files.length === 0) {
        setNotice({ tone: "warn", text: "กรุณากรอกผลตรวจอย่างน้อย 1 ค่า หรือแนบไฟล์" });
        return;
      }
      for (const k of ["vel", "acc", "cf", "temp"] as const) {
        if (vib[k] !== "" && Number(vib[k]) < 0) {
          setNotice({ tone: "error", text: "ค่าไม่สามารถเป็นลบ" });
          return;
        }
      }
      setBusy(true);
      const res = await saveReading({ assetId: selectedId, period, kind: "vib", values });
      await afterSave(res, period, "vib");
    }
  }

  async function afterSave(
    res: { ok: boolean; demo?: boolean; message: string },
    period: string,
    saveKind: "oil" | "vib",
  ) {
    if (!res.ok && !res.demo) {
      setBusy(false);
      setNotice({ tone: "error", text: res.message });
      return;
    }
    // Demo Mode blocks the write; the notice says nothing was stored.
    if (!res.ok) {
      setBusy(false);
      setNotice({ tone: "info", text: res.message });
      return;
    }
    // upload staged files (real mode → Supabase bucket, Local Store → disk via /api/local-store/upload)
    let attached = 0;
    let failed = 0;
    if (localStore && files.length > 0) {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("assetId", selectedId);
        fd.append("period", period);
        fd.append("kind", saveKind);
        try {
          const r = await fetch("/api/local-store/upload", { method: "POST", body: fd });
          (await r.json()).ok ? attached++ : failed++;
        } catch {
          failed++;
        }
      }
    } else if (!demo && files.length > 0) {
      const supabase = createBrowserClient();
      for (const file of files) {
        const storagePath = `${selectedId}/${period}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const upErr = await supabase.storage
          .from("lab-attachments")
          .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });
        if (upErr.error) {
          failed++;
          continue;
        }
        const reg = await registerAttachment({
          assetId: selectedId,
          period,
          kind: saveKind,
          fileName: file.name,
          storagePath,
          mimeType: file.type || null,
          sizeBytes: file.size,
        });
        reg.ok ? attached++ : failed++;
      }
    }

    setBusy(false);
    let msg = res.message;
    if ((!demo || localStore) && files.length > 0) {
      msg += ` · แนบไฟล์ ${attached}/${files.length}${failed ? ` (ไม่สำเร็จ ${failed})` : ""}`;
    }
    const okNotice: Notice = { tone: "ok", text: msg };
    setNotice(okNotice);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
    const flash: SaveFlash = {
      at: Date.now(),
      selectedId,
      notice: okNotice,
    };
    armCarry(FLASH_KEY, flash);
    setOil({ fe: "", water: "", visc: "", iso: "", tan: "", p4: "", p6: "", p14: "" });
    setVib({ vel: "", acc: "", cf: "", temp: "" });
    touched.current.clear();
    savedRef.current = { oil: null, vib: null };
    setSavedVersion((v) => v + 1); // reload, so the form shows what is now saved
    setFiles([]);
    setTagIssue(null);
    router.refresh();
  }

  return (
    // Any pointer/key input means the post-save remounts are over: stop restoring.
    <div className="fade space-y-3" onPointerDownCapture={() => dropCarries("dataentry:")} onKeyDownCapture={() => dropCarries("dataentry:")}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="page-title flex items-center gap-2.5 font-sans text-[22px] max-sm:text-[18px] font-bold"><FlaskConical className="h-4 w-4 shrink-0" aria-hidden />ป้อนข้อมูลผลวิเคราะห์ (Data Entry)</h2>
            <div className="text-[14px] text-t2">ระบบป้อนข้อมูลผลแล็บ รองรับการแนบไฟล์ PDF/Excel และดึงค่าจาก Excel อัตโนมัติ</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {canUpload && canSave && (
              <Button size="sm" variant="ghost" onClick={() => setBatchOpen(true)}>
                <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="whitespace-nowrap">นำเข้าไฟล์ Excel (Batch)</span>
              </Button>
            )}
            <div className="sm:text-right">
              <div className="text-[13px] text-t3">จำนวนเครื่องจักร</div>
              <div className="font-sans text-[23px] font-bold text-cyan">{assets.length}</div>
            </div>
          </div>
        </div>
      </Card>

      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="นำเข้าไฟล์ Excel (Batch)" maxWidth={900}>
        <BatchImportClient assets={assets} demo={demo} localStore={localStore} />
      </Modal>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Picker */}
        <div className="space-y-3">
          <Card>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Search className="h-4 w-4" aria-hidden />1. ค้นหาและเลือกเครื่องจักรเป้าหมาย</h2>
              <span className="whitespace-nowrap rounded-pill bg-cyan/10 px-2 py-0.5 text-[14px] font-semibold text-cyan">
                พบ {filtered.length} จาก {assets.length} เครื่องจักร
              </span>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="ค้นหาด้วยชื่อหรือรหัส..."
              aria-label="ค้นหาเครื่องจักรด้วยชื่อหรือรหัส"
              aria-describedby="asset-list-hint"
              className={INP}
            />
            <div id="asset-list-hint" className="mb-2 mt-1 text-[13px] text-t3">
              Enter = เลือกเครื่องแรกแล้วไปกรอกผล · ↓ เข้ารายการ · ↑↓ เลื่อน · Enter เลือก
            </div>
            <div className="mb-2 text-[13px] font-bold text-t3">เลือกโรงงาน</div>
            <div className="mb-2 flex flex-wrap gap-1">
              <Button size="xs" variant={site === "" ? "primary" : "ghost"} onClick={() => setSite("")}>ทั้งหมด</Button>
              {sites.map((s) => (
                <Button key={s.code} size="xs" variant={site === s.code ? "primary" : "ghost"} onClick={() => setSite(s.code)}><Factory className="h-3.5 w-3.5" aria-hidden />{s.code}</Button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-[13px] text-t3">ไม่พบเครื่องจักรที่ตรงกับเงื่อนไข</div>
            ) : (
              // One tab stop for the whole list (was one per machine — ~892 Tab
              // presses before reaching the form). Arrow keys move, Enter picks.
              <div
                ref={listRef}
                role="listbox"
                tabIndex={0}
                aria-label="รายการเครื่องจักร"
                aria-activedescendant={optId(activeIdx)}
                onKeyDown={onListKey}
                onFocus={onListFocus}
                onBlur={() => setListFocused(false)}
                className="max-h-[420px] space-y-1.5 overflow-y-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan/60"
              >
                {filtered.map((a, i) => {
                  const selectedRow = a.id === selectedId;
                  const cursor = listFocused && i === activeIdx;
                  return (
                    <div
                      key={a.id}
                      id={optId(i)}
                      role="option"
                      aria-selected={selectedRow}
                      onClick={() => { setActiveIdx(i); pickAsset(a.id, false); }}
                      className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${selectedRow ? "border-cyan bg-cyan/[0.06]" : "border-border hover:border-cyan/40 hover:bg-bg3"} ${cursor ? "ring-2 ring-cyan/60" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[14px] font-semibold text-cyan">{a.id}</div>
                        <div className="truncate text-[14px] font-semibold text-t1">{a.name}</div>
                      </div>
                      <span className="rounded bg-cyan/12 px-1.5 py-0.5 text-[14px] text-cyan">{a.site}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Pin className="h-4 w-4" aria-hidden />เครื่องจักรปัจจุบัน</h2>
              {selected && <span className="rounded bg-cyan/10 px-2 py-0.5 font-mono text-[14px] text-cyan">{selected.id}</span>}
            </div>
            {selected ? (
              <div>
                <div className="font-sans text-[16px] font-bold text-t1">{selected.name}</div>
                <div className="mt-1.5 space-y-1 text-[14px]">
                  <div className="flex justify-between"><span className="text-t3">ประเภทเครื่องจักร</span><span className="font-semibold">{selected.type}</span></div>
                  <div className="flex justify-between"><span className="text-t3">โรงงาน</span><span className="font-mono text-cyan">{selected.site}</span></div>
                  <div className="flex justify-between"><span className="text-t3">สถานะสุขภาพ</span><StatusBadge status={selected.status as AssetStatus} /></div>
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-t3">เลือกเครื่องจักรจากรายการด้านบน</div>
            )}
          </Card>
        </div>

        {/* Form */}
        <Card>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><CalendarDays className="h-4 w-4" aria-hidden />วันที่เก็บตัวอย่าง</h2>
            <div className="flex gap-1">
              <Button size="sm" variant={kind === "oil" ? "primary" : "ghost"} onClick={() => setKind("oil")}><Droplet className="h-3.5 w-3.5" aria-hidden />Oil</Button>
              <Button size="sm" variant={kind === "vib" ? "primary" : "ghost"} onClick={() => setKind("vib")}><Activity className="h-3.5 w-3.5" aria-hidden />Vibration</Button>
            </div>
          </div>
          <div className="mb-2.5">
            <Field label="วันที่เก็บตัวอย่าง">
              <input type="date" value={date} max={new Date().toLocaleDateString("en-CA")} onChange={(e) => setDate(e.target.value)} className={INP} />
            </Field>
          </div>

          {kind === "oil" ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Iron (Fe) - ppm *" hint={fieldHint("fe", oil.fe)}><input ref={firstFieldRef} type="number" min={0} value={oil.fe} onChange={(e) => editOil("fe", e.target.value)} className={INP} /></Field>
              <Field label="Water Content (ppm)" hint={fieldHint("water", oil.water)}><input type="number" min={0} value={oil.water} onChange={(e) => editOil("water", e.target.value)} className={INP} /></Field>
              <Field label="Viscosity @40°C (cSt)" hint={fieldHint("visc", oil.visc)}><input type="number" value={oil.visc} onChange={(e) => editOil("visc", e.target.value)} className={INP} /></Field>
              <Field label="ISO Code (XX/XX/XX)">
                <input value={oil.iso} onChange={(e) => { editOil("iso", e.target.value); validateISO(e.target.value); }} placeholder="18/16/13" className={`${INP} ${isoErr ? "border-red bg-red/5" : ""}`} />
                {isoErr && <span className="mt-0.5 flex items-center gap-1.5 text-[14px] text-yellow"><TriangleAlert className="h-3.5 w-3.5" aria-hidden />รูปแบบต้องเป็น XX/XX/XX</span>}
              </Field>
              <div className="col-span-2"><Field label="TAN (mgKOH/g)" hint={fieldHint("tan", oil.tan)}><input type="number" min={0} step="0.01" value={oil.tan} onChange={(e) => editOil("tan", e.target.value)} className={INP} /></Field></div>
              <Field label="Particle 4μm"><input type="number" min={0} value={oil.p4} onChange={(e) => editOil("p4", e.target.value)} className={INP} /></Field>
              <Field label="Particle 6μm"><input type="number" min={0} value={oil.p6} onChange={(e) => editOil("p6", e.target.value)} className={INP} /></Field>
              <div className="col-span-2"><Field label="Particle 14μm"><input type="number" min={0} value={oil.p14} onChange={(e) => editOil("p14", e.target.value)} className={INP} /></Field></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Velocity RMS (mm/s)" hint={fieldHint("vel", vib.vel)}><input ref={firstFieldRef} type="number" min={0} step="0.01" value={vib.vel} onChange={(e) => editVib("vel", e.target.value)} className={INP} /></Field>
              <Field label="Peak Acceleration (g-PK)" hint={fieldHint("acc", vib.acc)}><input type="number" min={0} step="0.01" value={vib.acc} onChange={(e) => editVib("acc", e.target.value)} className={INP} /></Field>
              <Field label="Crest Factor"><input type="number" min={0} step="0.1" value={vib.cf} onChange={(e) => editVib("cf", e.target.value)} className={INP} /></Field>
              <Field label="Bearing Temperature (°C)"><input type="number" min={0} value={vib.temp} onChange={(e) => editVib("temp", e.target.value)} className={INP} /></Field>
            </div>
          )}

          {/* Attach files */}
          <div className="mt-3 rounded-lg border border-dashed border-border bg-bg3 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[14px] font-semibold text-t2"><Paperclip className="h-3.5 w-3.5" aria-hidden />แนบไฟล์ผลแลป (PDF/Excel/CSV — ดึงค่าจาก Excel อัตโนมัติ)</span>
            {canUpload ? (
              <Button size="xs" variant="ghost" onClick={() => fileRef.current?.click()} disabled={parsing}>
                {parsing ? "กำลังอ่านไฟล์…" : "+ เลือกไฟล์"}
              </Button>
            ) : (
              <span className="text-[13px] text-t3">เฉพาะ admin/engineer</span>
            )}
            <input ref={fileRef} type="file" accept={ACCEPTED_TYPES} multiple onChange={(e) => onFilesPicked(e.target.files)} className="hidden" />
          </div>
            {files.length > 0 ? (
              <div className="space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded border border-border bg-bg2 px-2 py-1 text-[14px]">
                    <span className="min-w-0 truncate">
                      {isExcelLike(f) ? <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> : isPdf(f) ? <FileText className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> : <Paperclip className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />}{f.name}
                      <span className="ml-1 text-t3">({(f.size / 1024).toFixed(0)} KB)</span>
                    </span>
                    <button aria-label={`นำไฟล์ ${f.name} ออก`} onClick={() => removeFile(i)} className="ml-2 text-red">✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px] text-t3">ยังไม่มีไฟล์แนบ · รองรับ .pdf .xlsx .xls .csv (สูงสุด {MAX_FILE_MB}MB/ไฟล์)</div>
            )}
          </div>

          {tagIssue && (
            <div role="alert" className="mt-3 rounded-lg border border-yellow/40 bg-yellow/[0.06] p-2.5 text-[14px] text-t1">
              <div className="flex items-start gap-1.5">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow" aria-hidden />
                <div>
                  {tagIssue.match.kind === "empty" ? (
                    <>ไฟล์ &quot;{tagIssue.file}&quot; ไม่มี TAG เครื่องจักร — ยืนยันว่าเป็นผลของเครื่องไหน</>
                  ) : (
                    <>
                      TAG ในไฟล์ <span className="font-mono font-semibold">{tagIssue.tag}</span>{" "}
                      {tagIssue.match.kind === "suggest" ? "ไม่ตรงกับรหัสในระบบ — หมายถึงเครื่องไหน?" : "ไม่พบในระบบ"}
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tagIssue.match.suggestions.map((s) => (
                  <Button key={s.id} size="xs" variant="ghost" onClick={() => { setSelectedId(s.id); setTagIssue(null); }}>
                    <span className="font-mono">{s.id}</span>
                    <span className="text-t3">{s.name} · {s.site}</span>
                  </Button>
                ))}
                {selected && (
                  <Button size="xs" variant="ghost" onClick={() => setTagIssue(null)}>
                    ใช้เครื่องที่เลือกอยู่ <span className="font-mono">{selected.id}</span>
                  </Button>
                )}
              </div>
              {tagIssue.match.kind === "none" && (
                <div className="mt-1.5 text-t3">
                  ถ้าเป็นเครื่องใหม่ ให้เพิ่มที่{" "}
                  <a href="/assets" className="font-semibold text-cyan hover:underline">ฐานข้อมูลเครื่องจักร</a> ก่อน แล้วแนบไฟล์อีกครั้ง
                </div>
              )}
            </div>
          )}

          {preview && <ScorePreview preview={preview} kind={kind} />}

          {notice && (
            <div role="status" aria-live="polite" className={`mt-3 rounded-lg border p-2.5 text-[14px] ${NOTICE_STYLE[notice.tone]}`}>
              <div>{notice.text}</div>
              {notice.tone === "ok" && nextAsset && (
                <Button size="xs" variant="ghost" className="mt-1.5" onClick={() => pickAsset(nextAsset.id, true)}>
                  เครื่องถัดไป: {nextAsset.id}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              )}
            </div>
          )}

          {overLimit && (
            <div className="mt-3 flex items-start gap-1.5 text-[14px] text-t2">
              <TriangleAlert className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${overLimit === "crit" ? "text-red" : "text-yellow"}`} aria-hidden />
              ค่าเกินเกณฑ์ ควรเปิดงานซ่อม
            </div>
          )}
          {canSave ? (
            <Button variant="ok" onClick={() => onSubmit()} disabled={busy || justSaved} className="mt-3 w-full justify-center py-2.5">
              {busy ? <><SaveDrop saved={false} />กำลังบันทึก…</>
                : justSaved ? <><SaveDrop saved />บันทึกแล้ว</>
                : <><Database className="h-3.5 w-3.5" aria-hidden />บันทึกข้อมูลเข้าระบบ (Submit Record)</>}
            </Button>
          ) : (
            <div className="mt-3 rounded-md border border-border px-3 py-2 text-center text-[14px] text-t3">
              Role ของคุณดูข้อมูลได้อย่างเดียว — ไม่มีสิทธิ์บันทึกผล (readings:write)
            </div>
          )}
          {demo && !localStore && <div className="mt-1.5 text-center text-[13px] text-t3">ดึงค่าจาก Excel ได้ แต่ยังไม่บันทึกไฟล์จริง (ยังไม่ได้เชื่อม Supabase)</div>}
          {localStore && (
            <div className="mt-1.5 text-center text-[13px] text-t3">
              บันทึกในเครื่อง (Local Store · ทดลอง) — ยังไม่ขึ้นฐานข้อมูลกลาง ·{" "}
              <a href="/api/local-store/export" className="font-semibold text-cyan underline-offset-2 hover:underline">
                ส่งออก SQL สำหรับ Supabase / เซิร์ฟเวอร์บริษัท
              </a>
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}

// Theme-aware text tokens (globals.css) so the hint clears 4.5:1 in light and dark.
const HINT_TONE: Record<"none" | ReadingLevel, string> = {
  none: "text-t3",
  ok: "text-t3",
  warn: "font-semibold text-[rgb(var(--c-warn-text))]",
  crit: "font-semibold text-[rgb(var(--c-crit-text))]",
};

type FieldHint = { level?: ReadingLevel; text?: string; limits?: { warn: string; crit: string; unit: string } };

// Yellow = เฝ้าระวัง, red = วิกฤต — the same tints as the status badges.
function LimitChip({ tone, text }: { tone: "warn" | "crit"; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 font-semibold ${tone === "crit" ? "bg-red/10 text-red" : "bg-yellow/15 text-yellow"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "crit" ? "bg-red" : "bg-yellow"}`} aria-hidden />
      {text}
    </span>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: FieldHint;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-bold text-t3">{label}</span>
      {children}
      {hint?.limits && (
        <span className="mt-1 flex flex-wrap items-center gap-1 text-[13px] leading-5">
          <LimitChip tone="warn" text={`เฝ้าระวัง ${hint.limits.warn}`} />
          <LimitChip tone="crit" text={`วิกฤต ${hint.limits.crit}`} />
          {hint.limits.unit && <span className="text-t3">{hint.limits.unit.trim()}</span>}
        </span>
      )}
      {hint?.text && (
        <span className={`mt-0.5 flex items-start gap-1 text-[14px] leading-snug ${HINT_TONE[hint.level ?? "none"]}`}>
          {(hint.level === "warn" || hint.level === "crit") && <TriangleAlert className="mt-px h-3 w-3 shrink-0" aria-hidden />}
          {hint.text}
        </span>
      )}
    </label>
  );
}

function ScorePreview({ preview, kind }: { preview: ReadingPreview; kind: "oil" | "vib" }) {
  const before = preview.current.netScore;
  const after = preview.preview.netScore;
  const items = preview.preview.items.filter((it) => it.category === kind && (it.penalty > 0 || it.cappedFrom != null));
  return (
    <div className="mt-3 rounded-lg border border-border bg-bg3 p-2.5" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[14px] font-semibold text-t1">คะแนนสุขภาพหลังบันทึก (ตัวอย่าง)</div>
          <div className="text-[13px] text-t3">
            {preview.olderThanLatest
              ? "มีผลตรวจที่ใหม่กว่าวันที่นี้อยู่แล้ว — บันทึกแล้วคะแนนจะไม่เปลี่ยน"
              : "ยังไม่ได้บันทึก · คำนวณด้วยสูตรเดียวกับระบบ"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] text-t3">{before}</span>
          <span className="text-t3">→</span>
          <span className="font-mono text-[24px] font-extrabold" style={{ color: readableText(healthColor(after)) }}>{after}</span>
          <StatusBadge status={statusFromHealth(after)} />
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-border pt-1.5 text-[14px] text-t2">
          {items.map((it) => (
            <span key={it.name}>{it.name} <b className="font-mono text-red">−{it.penalty}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}
