"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CircleCheck, Factory, Paperclip, Pencil, Plus, Save, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { Card, Button } from "@/components/ui/primitives";
import { GearSpinner } from "@/components/ui/LubeIcons";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  createStandard,
  updateStandard,
  deleteStandard,
  getStandardsSnapshot,
} from "@/lib/actions/standards";
import { StandardAttachmentsPanel } from "./StandardAttachmentsPanel";
import { DOC_SECTION, StandardBlocks } from "./StandardContent";
import { parseStandardSections } from "@/lib/parse/standard-content";
import type { Standard, StandardCategory } from "@/lib/types";
import { readableText } from "@/lib/color";

const CATS: StandardCategory[] = ["TRIBOLOGY", "VIBRATION", "RELIABILITY", "ASSET", "CUSTOM"];
// Tabs group the DB categories: RELIABILITY / ASSET / CUSTOM fall under "อื่นๆ".
type Tab = "" | "lube" | "vib" | "other";
const TABS: { id: Tab; label: string }[] = [
  { id: "", label: "ทั้งหมด" },
  { id: "lube", label: "Lubrication" },
  { id: "vib", label: "Vibration" },
  { id: "other", label: "อื่นๆ" },
];
const tabOf = (c: StandardCategory): Tab => (c === "TRIBOLOGY" ? "lube" : c === "VIBRATION" ? "vib" : "other");
const CAT_COLOR: Record<StandardCategory, string> = {
  TRIBOLOGY: "#8b5cf6",
  VIBRATION: "#0066cc",
  RELIABILITY: "#22c55e",
  ASSET: "#f59e0b",
  CUSTOM: "#7a7a7a",
};

// Alarm param keys a standard can be linked to (drill-down / alarm config).
const PARAM_KEYS = ["fe", "water", "visc", "tan", "vel", "acc", "cf", "temp"];
const ASSET_TYPES = [
  "Centrifugal Pump",
  "Reciprocating Pump",
  "Motor Gearbox",
  "Gearbox",
  "Mechanical Agitator",
  "Screw Compressor",
  "Reciprocating Compressor",
  "Steam Turbine",
  "Motor",
  "Blower/Fan",
  "Hydraulic Unit",
  "Belt Conveyor",
  "Other",
];

// Thai names of the readings a standard can be linked to
const PARAM_TH: Record<string, string> = {
  fe: "เหล็ก (Fe)", water: "น้ำ", visc: "ความหนืด", tan: "TAN",
  vel: "Velocity", acc: "Acceleration", cf: "Crest Factor", temp: "อุณหภูมิ",
};

const SOURCE_LABEL: Record<string, string> = {
  glm: "GLM",
  openai: "OpenAI",
  anthropic: "Claude",
  fallback: "Rule-based (ไม่มี AI key)",
};

const INP =
  "w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan";
const CHIP =
  "rounded border border-border/70 bg-bg2 px-1.5 py-0.5 text-[13px] text-t3 transition hover:border-cyan/40 hover:text-cyan";

interface StdForm {
  id?: string;
  title: string;
  category: StandardCategory;
  subtitle: string;
  description: string;
  full_text: string;
  tags: string;
  related: string[];
  types: string[];
  relatedStandardIds: string[];
}

const EMPTY_FORM: StdForm = {
  title: "",
  category: "CUSTOM",
  subtitle: "",
  description: "",
  full_text: "",
  tags: "",
  related: [],
  types: [],
  relatedStandardIds: [],
};

function pick<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function StandardsClient({
  initialStandards,
  initialQ = "",
  demo = false,
  canManage = false,
  canManageAttachments = false,
}: {
  initialStandards: Standard[];
  initialQ?: string;
  demo?: boolean;
  canManage?: boolean;
  canManageAttachments?: boolean;
}) {
  const toast = useToast();
  const [standards, setStandards] = useState(initialStandards);
  const [tab, setTab] = useState<Tab>("");
  const [q, setQ] = useState(initialQ);
  const [selected, setSelected] = useState<Standard | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<StdForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<{ analysis: string; source: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ analysis: string; source: string } | null>(null);

  // Search first, so each tab's count shows how many matches it holds.
  const searched = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return standards;
    return standards.filter((s) =>
      `${s.title} ${s.subtitle ?? ""} ${(s.tags ?? []).join(" ")} ${s.description ?? ""}`.toLowerCase().includes(ql),
    );
  }, [standards, q]);
  const filtered = tab ? searched.filter((s) => tabOf(s.category) === tab) : searched;

  async function refresh() {
    setStandards(await getStandardsSnapshot());
  }

  // Related standards for the open detail modal: forward links (this standard's
  // own related_standard_ids) plus reverse links (other standards that point at
  // this one) — computed here since the reverse direction has no DB row of its own.
  const relatedStandards = useMemo(() => {
    if (!selected) return [];
    const forwardIds = new Set(selected.related_standard_ids ?? []);
    const seen = new Set<string>([selected.id]);
    const out: Standard[] = [];
    for (const s of standards) {
      if (seen.has(s.id)) continue;
      const isForward = forwardIds.has(s.id);
      const isReverse = (s.related_standard_ids ?? []).includes(selected.id);
      if (isForward || isReverse) {
        seen.add(s.id);
        out.push(s);
      }
    }
    return out;
  }, [selected, standards]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }
  function openEdit(s: Standard) {
    setForm({
      id: s.id,
      title: s.title,
      category: s.category,
      subtitle: s.subtitle ?? "",
      description: s.description ?? "",
      full_text: s.full_text ?? "",
      tags: (s.tags ?? []).join(", "),
      related: pick<string>(s.related_params),
      types: pick<string>(s.asset_types),
      relatedStandardIds: pick<string>(s.related_standard_ids),
    });
    setFormOpen(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const input = {
      title: form.title.trim(),
      category: form.category,
      subtitle: form.subtitle.trim(),
      description: form.description.trim(),
      full_text: form.full_text.trim(),
      tags: form.tags,
      related_params: form.related,
      asset_types: form.types,
      related_standard_ids: form.relatedStandardIds,
    };
    const res = form.id
      ? await updateStandard(form.id, input)
      : await createStandard(input);
    setBusy(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) {
      setFormOpen(false);
      await refresh();
    }
  }

  function toggle(list: "related" | "types" | "relatedStandardIds", v: string) {
    setForm((f) => ({
      ...f,
      [list]: f[list].includes(v) ? f[list].filter((x) => x !== v) : [...f[list], v],
    }));
  }

  async function confirmDelete(s: Standard) {
    if (!window.confirm(`ลบมาตรฐาน "${s.title}"? การกระทำนี้ย้อนกลับไม่ได้`)) return;
    const res = await deleteStandard(s.id);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) {
      setSelected(null);
      await refresh();
    }
  }

  async function runAiSummary() {
    if (!selected) return;
    setAiLoading(true);
    setAiErr(null);
    setAi(null);
    try {
      const res = await fetch("/api/ai/standard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "AI error");
      setAi(data as { analysis: string; source: string });
    } catch (e) {
      setAiErr("เกิดข้อผิดพลาดในการวิเคราะห์ AI");
    } finally {
      setAiLoading(false);
    }
  }

  async function askAi() {
    if (!selected || !question.trim() || aiLoading) return;
    setAiLoading(true);
    setAiErr(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai/standard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "AI error");
      setAnswer(data as { analysis: string; source: string });
    } catch (e) {
      setAiErr("เกิดข้อผิดพลาดในการวิเคราะห์ AI");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="fade">
      <Card className="mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="page-title flex items-center gap-2.5 font-sans text-[22px] max-sm:text-[18px] font-bold">
              <BookOpen className="h-4 w-4" aria-hidden />คลังมาตรฐานวิศวกรรม (Engineering Standards Library)
            </h2>
            <div className="text-[14px] text-t2">ฐานข้อมูลอ้างอิง ISO / ASTM / SAE / API</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหามาตรฐาน..."
              aria-label="ค้นหามาตรฐาน"
              className="w-[190px] rounded-pill border border-border bg-bg2 px-2.5 py-1 text-[14px] outline-none focus:border-cyan"
            />
            {canManage && <Button size="sm" variant="primary" onClick={openAdd}><Plus className="h-3.5 w-3.5" aria-hidden />เพิ่มมาตรฐาน</Button>}
          </div>
        </div>
      </Card>

      <div className="mb-3 flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="หมวดหมู่มาตรฐาน">
        {TABS.map((t) => {
          const n = t.id ? searched.filter((s) => tabOf(s.category) === t.id).length : searched.length;
          return (
            <button
              key={t.id || "all"}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[14px] font-medium transition ${
                tab === t.id ? "border-cyan text-cyan" : "border-transparent text-t2 hover:text-t1"
              }`}
            >
              {t.label}
              <span className={`text-[12px] ${n ? "" : "opacity-50"}`}>({n})</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s)}
            className="flex flex-col rounded-[14px] border border-border bg-bg2 p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-cyan/30 hover:shadow-lg"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] font-extrabold" style={{ color: readableText(CAT_COLOR[s.category]) }}>
                {s.category}
              </span>
              {s.version != null && (
                <span className="rounded bg-black/5 px-1 py-0.5 font-mono text-[13px] text-t3">v{s.version}</span>
              )}
            </div>
            <div className="font-sans text-[16px] font-semibold text-t1">{s.title}</div>
            <div className="mt-0.5 line-clamp-1 text-[13px] text-t3" title={s.subtitle ?? undefined}>{s.subtitle}</div>
            {s.description && <p className="mt-2 line-clamp-2 text-[14px] leading-snug text-t1">{s.description}</p>}
            {(s.asset_types?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1 text-[13px] text-t3">
                <Factory className="h-3 w-3" aria-hidden />
                {s.asset_types!.slice(0, 3).join(" · ")}{s.asset_types!.length > 3 && ` +${s.asset_types!.length - 3}`}
              </div>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center text-[13px] text-t3">ไม่พบมาตรฐานที่ตรงกับเงื่อนไข</div>
        )}
      </div>

      {/* Detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ""} maxWidth={760}>
        {selected && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] font-extrabold" style={{ color: readableText(CAT_COLOR[selected.category]) }}>
                {selected.category}
              </span>
              {selected.version != null && (
                <span className="text-[13px] text-t3">
                  v{selected.version}
                  {selected.updated_at
                    ? ` · อัปเดต ${new Date(selected.updated_at).toLocaleDateString("th-TH", { calendar: "gregory", year: "numeric", month: "short", day: "numeric" })}`
                    : ""}
                </span>
              )}
            </div>
            <div className="mb-3 text-[14px] font-semibold text-cyan">{selected.subtitle}</div>
            <DocCard standard={selected} />
            <Section title="สรุปย่อ">
              <p className="text-[14px] leading-relaxed text-t1">{selected.description}</p>
            </Section>
            {parseStandardSections(selected.full_text ?? "").filter((s) => s.title !== DOC_SECTION).map((s, i) => (
              <Section key={i} title={s.title ?? "สาระสำคัญของมาตรฐาน"} note={s.title ? undefined : "สรุปจากเอกสาร — ตรวจกับฉบับจริงก่อนอ้างอิงในรายงาน"}>
                <StandardBlocks blocks={s.blocks} />
              </Section>
            ))}
            {(selected.related_params?.length || selected.asset_types?.length) ? (
              <Section title="ใช้กับ">
                <div className="flex flex-wrap gap-1">
                  {selected.related_params?.map((k) => (
                    <span key={k} className={`${CHIP} inline-flex items-center gap-1`}>{PARAM_TH[k] ?? k}</span>
                  ))}
                  {selected.asset_types?.map((t) => (
                    <span key={t} className={`${CHIP} inline-flex items-center gap-1`}><Factory className="h-3 w-3" aria-hidden />{t}</span>
                  ))}
                </div>
              </Section>
            ) : null}
            <div className="mb-3 flex flex-wrap gap-1">
              {(selected.tags ?? []).map((t) => (
                <span key={t} className="rounded border border-black/10 bg-black/[0.04] px-1.5 py-0.5 text-[13px] text-t3">{t}</span>
              ))}
            </div>

            {relatedStandards.length > 0 && (
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-t3"><Paperclip className="h-3.5 w-3.5" aria-hidden />มาตรฐานที่เกี่ยวข้อง</div>
                <div className="space-y-1">
                  {relatedStandards.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelected(s)}
                      className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-bg3/60 px-2.5 py-1.5 text-left transition hover:border-cyan/30"
                    >
                      <span
                        className="rounded px-1 py-0.5 text-[13px] font-extrabold"
                        style={{ background: CAT_COLOR[s.category] + "1a", color: readableText(CAT_COLOR[s.category]) }}
                      >
                        {s.category}
                      </span>
                      <span className="font-sans text-[14px] font-medium text-t1">{s.title}</span>
                      {s.subtitle && <span className="truncate text-[13px] text-t3">{s.subtitle}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI summary / Q&A */}
            <div className="rounded-lg border border-cyan/20 bg-cyan/[0.03] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-t3"><Sparkles className="h-3.5 w-3.5" aria-hidden />AI วิเคราะห์มาตรฐาน</span>
                <Button size="sm" variant="ghost" onClick={runAiSummary} disabled={aiLoading}>
                  {aiLoading ? <><GearSpinner className="h-3.5 w-3.5" />กำลังวิเคราะห์…</> : <><Sparkles className="h-3.5 w-3.5" aria-hidden />{ai ? "สรุปใหม่" : "AI สรุป"}</>}
                </Button>
              </div>
              {aiErr && <div className="mt-2 rounded border border-red/30 bg-red/10 px-2.5 py-1.5 text-[14px] text-red"><TriangleAlert className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />{aiErr}</div>}
              {ai && (
                <div className="mt-2">
                  <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-t1">{ai.analysis}</div>
                  <div className="mt-1 text-[13px] font-medium text-t3">source: {SOURCE_LABEL[ai.source] ?? ai.source}</div>
                </div>
              )}
              <div className="mt-2 flex gap-1.5 border-t border-cyan/10 pt-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askAi()}
                  placeholder="ถามเกี่ยวกับมาตรฐานนี้ เช่น ใช้เกณฑ์อะไรกับปั๊ม?"
                  className="flex-1 rounded-pill border border-border bg-bg2 px-2.5 py-1 text-[14px] outline-none focus:border-cyan"
                />
                <Button size="sm" variant="primary" onClick={askAi} disabled={aiLoading || !question.trim()}>
                  ถาม
                </Button>
              </div>
              {answer && (
                <div className="mt-2">
                  <div className="whitespace-pre-wrap rounded border border-border bg-bg2 p-2 text-[14px] leading-relaxed text-t1">
                    {answer.analysis}
                  </div>
                  <div className="mt-1 text-[13px] font-medium text-t3">source: {SOURCE_LABEL[answer.source] ?? answer.source}</div>
                </div>
              )}
            </div>

            <div className="mt-3">
              <StandardAttachmentsPanel standardId={selected.id} demo={demo} canManage={canManageAttachments} />
            </div>

            {canManage && (
              <div className="mt-3 flex justify-end gap-2 border-t border-border pt-2.5">
                <Button size="sm" variant="ghost" onClick={() => confirmDelete(selected)}><Trash2 className="h-3.5 w-3.5" aria-hidden />ลบ</Button>
                <Button size="sm" variant="primary" onClick={() => openEdit(selected)}><Pencil className="h-3.5 w-3.5" aria-hidden />แก้ไข</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add / Edit */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={<span className="flex items-center gap-1.5">{form.id ? <><Pencil className="h-4 w-4" aria-hidden />{`แก้ไขมาตรฐาน (${form.title})`}</> : <><Plus className="h-4 w-4" aria-hidden />เพิ่มมาตรฐานวิศวกรรม</>}</span>}
        maxWidth={600}
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="รหัส / ชื่อมาตรฐาน *"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={INP} /></Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="หมวดหมู่ *">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as StandardCategory })} className={INP}>
                {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="ชื่อย่อ / Subtitle *"><input required value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className={INP} /></Field>
          </div>
          <Field label="คำอธิบาย (Thai) *"><textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={INP} /></Field>
          <Field label="รายละเอียดเพิ่มเติม (ไม่บังคับ) — บรรทัดละหัวข้อ “หัวข้อ: ข้อ · ข้อ”, ## ชื่อส่วน, | ตาราง | ตาราง |"><textarea rows={3} value={form.full_text} onChange={(e) => setForm({ ...form, full_text: e.target.value })} className={INP} /></Field>
          <Field label="Tags (คั่นด้วย ,)"><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={INP} placeholder="Velocity RMS,ISO Grade" /></Field>
          <Field label="ลิงก์กับพารามิเตอร์ (จะแสดงใน Drill-down / Alarm Config)">
            <div className="flex flex-wrap gap-1">
              {PARAM_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle("related", k)}
                  className={`rounded-pill border px-2 py-0.5 text-[13px] font-medium transition ${form.related.includes(k) ? "border-cyan bg-cyan/10 text-cyan" : "border-border bg-bg3 text-t3 hover:border-cyan/30"}`}
                >
                  {k}
                </button>
              ))}
            </div>
          </Field>
          <Field label="ใช้กับประเภทเครื่องจักร">
            <div className="flex flex-wrap gap-1">
              {ASSET_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggle("types", t)}
                  className={`rounded-pill border px-2 py-0.5 text-[13px] font-medium transition ${form.types.includes(t) ? "border-cyan bg-cyan/10 text-cyan" : "border-border bg-bg3 text-t3 hover:border-cyan/30"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="มาตรฐานที่เกี่ยวข้อง (จะแสดงในหน้ารายละเอียด)">
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-bg2 p-1.5">
              {standards.filter((s) => s.id !== form.id).length === 0 ? (
                <div className="px-1.5 py-1 text-[13px] text-t3">ไม่มีมาตรฐานอื่นให้เลือก</div>
              ) : (
                standards
                  .filter((s) => s.id !== form.id)
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle("relatedStandardIds", s.id)}
                      className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[14px] transition ${form.relatedStandardIds.includes(s.id) ? "bg-cyan/10 text-cyan" : "text-t2 hover:bg-black/[0.03]"}`}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CAT_COLOR[s.category] }} />
                      <span className="truncate">{s.title}</span>
                    </button>
                  ))
              )}
            </div>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>ยกเลิก</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "กำลังบันทึก…" : form.id ? <><Save className="h-3.5 w-3.5" aria-hidden />บันทึกการแก้ไข</> : <><CircleCheck className="h-3.5 w-3.5" aria-hidden />บันทึกมาตรฐาน</>}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-bold text-t3">{label}</span>
      {children}
    </label>
  );
}

// One titled block of the standard's detail view.
function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="mb-1 text-[13px] font-bold text-t3">{title}</h3>
      <div className="rounded-lg border border-border bg-bg2 p-3">{children}</div>
      {note && <p className="mt-1 text-[12px] text-t3">{note}</p>}
    </section>
  );
}
const ISSUER: Record<string, string> = {
  ISO: "ISO — International Organization for Standardization",
  ASTM: "ASTM International",
  AGMA: "AGMA — American Gear Manufacturers Association",
  IEC: "IEC — International Electrotechnical Commission",
};

// Document facts: issuer and edition from the title, "## ข้อมูลเอกสาร" lines (แทนที่ฉบับ, สถานะ), and the in-app review.
function DocCard({ standard: s }: { standard: Standard }) {
  const doc = parseStandardSections(s.full_text ?? "").find((x) => x.title === DOC_SECTION);
  const rows: [string, string][] = [
    ["หน่วยงานที่ออก", ISSUER[s.title.split(/[\s-]/)[0]] ?? "—"],
    ["ฉบับที่ใช้อ้างอิง", s.title],
    ...(doc?.blocks ?? []).flatMap((b): [string, string][] => (b.kind === "lines" && b.heading ? [[b.heading, b.items.join(" · ")]] : [])),
    ["ตรวจทานในระบบ", [
      s.version != null ? `v${s.version}` : null,
      s.updated_at ? new Date(s.updated_at).toLocaleDateString("th-TH", { calendar: "gregory", year: "numeric", month: "short", day: "numeric" }) : null,
      s.updated_by ? `โดย ${s.updated_by}` : null,
    ].filter(Boolean).join(" · ") || "—"],
  ];
  return (
    <section className="mb-3">
      <h3 className="mb-1 text-[13px] font-bold text-t3">ข้อมูลเอกสาร</h3>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-border bg-bg3/60 p-3 text-[14px] max-sm:grid-cols-1 max-sm:gap-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-t3 max-sm:mt-1">{k}</dt>
            <dd className={`text-t1 ${k === "สถานะ" ? "font-semibold" : ""}`}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[12px] text-t3">ตรวจสถานะฉบับล่าสุดที่เว็บไซต์หน่วยงานที่ออกก่อนอ้างอิงในรายงาน</p>
    </section>
  );
}
