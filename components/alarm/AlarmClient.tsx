"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Activity, BookOpen, ChevronDown, CircleCheck, Droplet, Eye, Globe, Info, Lock, Pencil, RotateCcw, Ruler, Save, Scale, ShieldCheck, SlidersHorizontal, Trash2, Wrench } from "lucide-react";
import { Card, Button, HealthBadge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { DeductionSection } from "@/components/ui/DeductionSection";
import { AssetCombobox } from "@/components/ui/AssetCombobox";
import { useToast } from "@/components/ui/Toast";
import { getAssetAudit } from "@/lib/actions/audit";
import { applyWeightToAllOverrides, deleteAssetAlarmOverride, getAssetAlarmConfigAction, saveAlarmConfig, saveAssetAlarmOverride } from "@/lib/actions/alarms";
import { healthColor } from "@/lib/scoring/health";
import { viscCriteriaText } from "@/lib/viscosity-limits";
import type { AlarmParam, ScoreConfig, Standard } from "@/lib/types";
import type { AssetOption } from "@/lib/queries/assets";
import type { DeductionBreakdown } from "@/lib/scoring/audit";
import { readableText } from "@/lib/color";
import { scrollBehavior } from "@/lib/motion";

const INP =
  "w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// One "N มาตรฐาน" toggle per parameter instead of 6–8 chips always on screen.
function StandardsChips({ standards }: { standards?: Standard[] }) {
  const [open, setOpen] = useState(false);
  if (!standards?.length) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-pill border border-cyan/30 bg-cyan/5 px-2 py-0.5 text-[14px] font-semibold text-cyan transition hover:bg-cyan/10"
      >
        <BookOpen className="h-3 w-3" aria-hidden />
        {standards.length} มาตรฐานอ้างอิง
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-1 flex flex-wrap gap-1">
          {standards.map((s) => (
            <Link
              key={s.id}
              href={`/standards?q=${encodeURIComponent(s.title)}`}
              className="rounded-pill border border-border bg-bg2 px-2 py-0.5 text-[14px] font-semibold text-t2 transition hover:border-cyan hover:text-cyan"
            >
              {s.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Viscosity limits aren't editable: scoring always derives them from each
// asset's ISO VG grade (lib/viscosity-limits.ts, 0027_visc_by_vg_grade.sql).
function ViscGradeLimits({ vgGrade }: { vgGrade?: number }) {
  const t = viscCriteriaText(vgGrade);
  return (
    <div className="col-span-2 rounded-lg border border-dashed border-border bg-black/[0.02] px-2.5 py-1.5 text-[14px] leading-relaxed text-t2">
      <div><span className="font-bold text-yellow">Warn</span> {t.warn}</div>
      <div><span className="font-bold text-red">Crit</span> {t.crit}</div>
      <div className="text-[13px] text-t3">{vgGrade ? `ตามเกรด VG ${vgGrade} ของเครื่องนี้` : "คำนวณตามเกรด VG ของแต่ละเครื่อง (ISO 3448)"} — ปรับได้เฉพาะ Penalty</div>
    </div>
  );
}

export function AlarmClient({
  initialParams,
  initialScore,
  assets,
  standardsByParam,
  canManage = false,
}: {
  initialParams: AlarmParam[];
  initialScore: ScoreConfig;
  assets: AssetOption[];
  /** Standards linked to each alarm param key (e.g. vel -> ISO 10816-3). */
  standardsByParam?: Record<string, Standard[]>;
  canManage?: boolean;
}) {
  const toast = useToast();
  const [params, setParams] = useState<AlarmParam[]>(() => clone(initialParams));
  const [score, setScore] = useState<ScoreConfig>(() => clone(initialScore));
  const [selectedId, setSelectedId] = useState("");
  const [audit, setAudit] = useState<DeductionBreakdown | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmApplyAll, setConfirmApplyAll] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const overrideCardRef = useRef<HTMLDivElement>(null);

  // Per-machine override editor — separate draft state from the global
  // params/score above, scoped to whichever asset is selected in the picker.
  const [ovMode, setOvMode] = useState(false);
  const [ovLoading, setOvLoading] = useState(false);
  const [ovHasOverride, setOvHasOverride] = useState(false);
  const [ovParams, setOvParams] = useState<AlarmParam[]>([]);
  const [ovScore, setOvScore] = useState<ScoreConfig | null>(null);
  const [ovAudit, setOvAudit] = useState<DeductionBreakdown | null>(null);
  const [ovBusy, setOvBusy] = useState(false);
  const [ovSaving, setOvSaving] = useState(false);

  // Weights and source of the shown breakdown: a machine with its own override is
  // scored with it on pick (same number as Dashboard); global edits re-run a what-if.
  const [auditScore, setAuditScore] = useState<ScoreConfig>(initialScore);
  const [auditOwn, setAuditOwn] = useState(false);
  // The machine picked last: a slower reply for an earlier pick must not land on it
  // (it showed — and then saved — machine A's override under machine B).
  const pickRef = useRef("");
  async function runAudit(id: string, p: AlarmParam[], s: ScoreConfig, own = false) {
    if (!id) {
      setAudit(null);
      return;
    }
    setBusy(true);
    const res = await getAssetAudit({ assetId: id, params: p, scoreConfig: s });
    if (id !== pickRef.current) return;
    setAudit(res);
    setAuditScore(s);
    setAuditOwn(own);
    setBusy(false);
  }

  async function loadOverride(id: string) {
    setOvMode(false);
    setOvAudit(null);
    setOvBusy(false);
    if (!id) {
      setOvParams([]);
      setOvScore(null);
      setOvHasOverride(false);
      return;
    }
    setOvLoading(true);
    const cfg = await getAssetAlarmConfigAction(id);
    if (id !== pickRef.current) return;
    setOvParams(clone(cfg.params));
    setOvScore(clone(cfg.scoreConfig));
    setOvHasOverride(cfg.hasOverride);
    setOvLoading(false);
    return cfg;
  }

  async function onPick(id: string) {
    pickRef.current = id;
    setSelectedId(id);
    const cfg = await loadOverride(id);
    if (id !== pickRef.current) return;
    if (cfg?.hasOverride) runAudit(id, cfg.params, cfg.scoreConfig, true);
    else runAudit(id, params, score);
  }

  function runOvAudit(p: AlarmParam[], s: ScoreConfig) {
    if (!selectedId) return;
    setOvBusy(true);
    const id = selectedId;
    getAssetAudit({ assetId: id, params: p, scoreConfig: s }).then((res) => {
      if (id !== pickRef.current) return;
      setOvAudit(res);
      setOvBusy(false);
    });
  }

  function setOvLimit(id: string, field: "warn_limit" | "crit_limit" | "warn_penalty" | "crit_penalty", value: string) {
    const v = value === "" ? null : Number(value);
    setOvParams((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: v } : p)));
  }

  function commitAndReauditOv() {
    runOvAudit(ovParams, ovScore ?? score);
  }

  function setOvWeight(which: "oil_weight" | "vib_weight", value: string) {
    if (!ovScore) return;
    let v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    setOvScore((prev) =>
      prev && which === "oil_weight"
        ? { ...prev, oil_weight: v, vib_weight: 100 - v }
        : prev
          ? { ...prev, vib_weight: v, oil_weight: 100 - v }
          : prev,
    );
  }

  async function saveOverride() {
    if (!selectedId || !ovScore) return;
    setOvSaving(true);
    const res = await saveAssetAlarmOverride({
      assetId: selectedId,
      params: ovParams.map((p) => ({ category: p.category, key: p.key, warn_limit: p.warn_limit ?? null, crit_limit: p.crit_limit ?? null, warn_penalty: p.warn_penalty ?? null, crit_penalty: p.crit_penalty ?? null })),
      scoreConfig: ovScore,
    });
    setOvSaving(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) onPick(selectedId);
  }

  async function resetOverride() {
    if (!selectedId) return;
    setOvSaving(true);
    const res = await deleteAssetAlarmOverride(selectedId);
    setOvSaving(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) onPick(selectedId);
  }

  function setLimit(id: string, field: "warn_limit" | "crit_limit" | "warn_penalty" | "crit_penalty", value: string) {
    // Empty limit must stay NULL — writing 0 would turn every reading into a
    // critical violation. Penalties fall back to 0 (no deduction) when empty.
    const v = value === "" ? null : Number(value);
    setParams((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: v } : p)));
  }

  function commitAndReaudit() {
    runAudit(selectedId, params, score);
  }

  function setWeight(which: "oil_weight" | "vib_weight", value: string) {
    let v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    setScore((prev) =>
      which === "oil_weight"
        ? { ...prev, oil_weight: v, vib_weight: 100 - v }
        : { ...prev, vib_weight: v, oil_weight: 100 - v },
    );
  }

  function reset() {
    setParams(clone(initialParams));
    setScore(clone(initialScore));
    setAudit(null);
    toast("คืนค่าเริ่มต้นแล้ว", "info");
  }

  async function save() {
    setSaving(true);
    const res = await saveAlarmConfig({
      params: params.map((p) => ({ id: p.id, warn_limit: p.warn_limit ?? null, crit_limit: p.crit_limit ?? null, warn_penalty: p.warn_penalty ?? 0, crit_penalty: p.crit_penalty ?? 0 })),
      scoreConfig: score,
    });
    setSaving(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
  }

  async function applyAll() {
    setApplyingAll(true);
    const res = await applyWeightToAllOverrides(score.oil_weight, score.vib_weight);
    setApplyingAll(false);
    setConfirmApplyAll(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok && selectedId) loadOverride(selectedId);
  }

  function goToPerMachine() {
    if (!selectedId) {
      toast("กรุณาเลือกเครื่องจักรที่ด้านบนก่อน", "warning");
      return;
    }
    setOvMode(true);
    overrideCardRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  }

  const selected = assets.find((a) => a.id === selectedId) ?? null;
  const oilParams = params.filter((p) => p.category === "oil");
  const vibParams = params.filter((p) => p.category === "vib");

  return (
    <div className="fade space-y-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <div>
              <h2 className="page-title font-sans text-[22px] max-sm:text-[18px] font-bold">ตั้งค่าแจ้งเตือน (Alarm Configuration)</h2>
              <div className="text-[14px] text-t2">ตั้งค่าขีดจำกัด (Thresholds) สำหรับน้ำมันและความสั่นสะเทือน</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={reset}><RotateCcw className="h-3.5 w-3.5" aria-hidden />คืนค่าเริ่มต้น</Button>
            {canManage && (
              <Button size="sm" variant="primary" onClick={save} disabled={saving}>
                {saving ? "กำลังบันทึก…" : <><Save className="h-3.5 w-3.5" aria-hidden />บันทึก (Recompute All)</>}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Health Score Audit */}
      <Card>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-green/12"><ShieldCheck className="h-4 w-4" aria-hidden /></div>
            <div>
              <h2 className="font-sans text-[18px] max-sm:text-[16px] font-semibold">คะแนนสุขภาพปัจจุบัน (Current Health Score)</h2>
              <div className="text-[13px] text-t3">Real-time Calculation Audit Log — อัปเดตตามค่า limit ด้านล่าง</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AssetCombobox assets={assets} value={selectedId} onChange={onPick} ariaLabel="เลือกเครื่องจักรเพื่อดูคะแนนสุขภาพ" className="w-[300px] max-w-full" />
            {selected && <HealthBadge score={selected.health} />}
          </div>
        </div>

        {!selectedId ? (
          <div className="rounded-lg border border-border bg-black/[0.02] p-4 text-center text-[13px] text-t3">
            เลือกเครื่องจักรเพื่อดูการแบ่งคะแนน
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-black/[0.02] p-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-[14px] text-t2"><span className="inline-block h-2 w-2 rounded-full bg-green align-middle" aria-hidden /> คะแนนเริ่มต้น (Base Score)</span>
              <span className="font-mono text-[16px] font-bold">100</span>
            </div>
            {busy ? (
              <div className="py-3 text-center text-[13px] text-t3">กำลังคำนวณ…</div>
            ) : audit ? (
              <>
                <DeductionSection title={<><Droplet className="h-3.5 w-3.5" aria-hidden />Oil Analysis</>} weight={auditScore.oil_weight} score={audit.oilScore} items={audit.items.filter((it) => it.category === "oil" && (it.penalty > 0 || it.cappedFrom != null))} emptyLabel="ไม่พบความผิดปกติจากน้ำมัน" />
                <DeductionSection title={<><Activity className="h-3.5 w-3.5" aria-hidden />Vibration</>} weight={auditScore.vib_weight} score={audit.vibScore} items={audit.items.filter((it) => it.category === "vib" && (it.penalty > 0 || it.cappedFrom != null))} emptyLabel="ไม่พบความผิดปกติจากการสั่นสะเทือน" />
              </>
            ) : (
              <div className="py-3 text-center text-[13px] italic text-t3">ตรวจไม่พบความผิดปกติ</div>
            )}
            {audit && (
              <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
                <div>
                  <div className="text-[14px] font-bold text-t1">คะแนนสุทธิ (Net Score)</div>
                  <div className="text-[13px] text-t3">({audit.oilScore} × {auditScore.oil_weight}% + {audit.vibScore} × {auditScore.vib_weight}%) ÷ 100 = {audit.netScore}</div>
                  {ovHasOverride && (
                    <div className="text-[13px] text-t3">
                      {auditOwn ? "ใช้เกณฑ์เฉพาะของเครื่องนี้ — ตรงกับคะแนนใน Dashboard" : "คำนวณตามเกณฑ์กลางที่กำลังแก้ — เครื่องนี้มีเกณฑ์เฉพาะ คะแนนจริงอาจต่างจากนี้"}
                    </div>
                  )}
                </div>
                <div className="font-mono text-[26px] font-extrabold" style={{ color: readableText(healthColor(audit.netScore)) }}>{audit.netScore}</div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Per-machine override */}
      {selectedId && (
        <div ref={overrideCardRef}>
        <Card>
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-purple/12"><Wrench className="h-4 w-4" aria-hidden /></div>
              <div>
                <h2 className="font-sans text-[18px] max-sm:text-[16px] font-semibold">ตั้งค่าเฉพาะเครื่องนี้ (Per-Machine Override) — {selected?.id}</h2>
                <div className="text-[13px] text-t3">Override เกณฑ์ warn/critical และ scoring เฉพาะเครื่องจักรนี้เครื่องเดียว ไม่กระทบเครื่องอื่น</div>
              </div>
            </div>
            <span className={`badge ${ovHasOverride ? "badge-warn" : "badge-ok"}`}>
              {ovHasOverride ? <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" aria-hidden />ใช้ค่าเฉพาะเครื่อง</span> : "ใช้ค่ากลาง (Global)"}
            </span>
          </div>

          {ovLoading || !ovScore ? (
            <div className="py-3 text-center text-[13px] text-t3">กำลังโหลด…</div>
          ) : !ovMode ? (
            <div className="rounded-lg border border-border bg-black/[0.02] p-3 text-center">
              {canManage ? (
                <Button size="sm" variant="primary" onClick={() => setOvMode(true)}><Pencil className="h-3.5 w-3.5" aria-hidden />แก้ไขค่าเฉพาะเครื่องนี้</Button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-t3"><Lock className="h-3.5 w-3.5" aria-hidden />ไม่มีสิทธิ์แก้ไขค่าเฉพาะเครื่องนี้</span>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="mb-1 block text-[13px] font-bold text-yellow"><span className="inline-flex items-center gap-1.5"><Droplet className="h-3.5 w-3.5" aria-hidden />Oil weight (%)</span></span>
                  <input type="number" min={0} max={100} value={ovScore.oil_weight} onChange={(e) => setOvWeight("oil_weight", e.target.value)} onBlur={commitAndReauditOv} className={INP} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[13px] font-bold text-purple"><span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" aria-hidden />Vibration weight (%)</span></span>
                  <input type="number" min={0} max={100} value={ovScore.vib_weight} onChange={(e) => setOvWeight("vib_weight", e.target.value)} onBlur={commitAndReauditOv} className={INP} />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-t2"><Droplet className="h-3.5 w-3.5" aria-hidden />Oil Limits + Scoring</div>
                  <div className="space-y-1.5">
                    {ovParams.filter((p) => p.category === "oil").map((p) => (
                      <div key={p.id} className="rounded-md border border-border p-2">
                        <div className="flex items-center justify-between text-[14px] font-semibold">{p.name}<span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[13px] text-t3">{p.unit}</span></div>
                        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                          {p.key === "visc" ? (
                            <ViscGradeLimits vgGrade={selected?.vg_grade} />
                          ) : (
                            <>
                              <label className="block"><span className="mb-0.5 block text-[13px] font-bold text-yellow">Warn</span><input type="number" step="0.1" value={p.warn_limit ?? ""} onChange={(e) => setOvLimit(p.id, "warn_limit", e.target.value)} onBlur={commitAndReauditOv} className={INP} /></label>
                              <label className="block"><span className="mb-0.5 block text-[13px] font-bold text-red">Crit</span><input type="number" step="0.1" value={p.crit_limit ?? ""} onChange={(e) => setOvLimit(p.id, "crit_limit", e.target.value)} onBlur={commitAndReauditOv} className={INP} /></label>
                            </>
                          )}
                          <label className="block"><span className="mb-0.5 block text-[13px] font-bold text-yellow">W-pen</span><input type="number" min={0} max={100} value={p.warn_penalty ?? 0} onChange={(e) => setOvLimit(p.id, "warn_penalty", e.target.value)} onBlur={commitAndReauditOv} className={INP} /></label>
                          <label className="block"><span className="mb-0.5 block text-[13px] font-bold text-red">C-pen</span><input type="number" min={0} max={100} value={p.crit_penalty ?? 0} onChange={(e) => setOvLimit(p.id, "crit_penalty", e.target.value)} onBlur={commitAndReauditOv} className={INP} /></label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-t2"><Activity className="h-3.5 w-3.5" aria-hidden />Vibration Limits + Scoring</div>
                  <div className="space-y-1.5">
                    {ovParams.filter((p) => p.category === "vib").map((p) => (
                      <div key={p.id} className="rounded-md border border-border p-2">
                        <div className="flex items-center justify-between text-[14px] font-semibold">{p.name}<span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[13px] text-t3">{p.unit}</span></div>
                        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                          <label className="block"><span className="mb-0.5 block text-[13px] font-bold text-yellow">Warn</span><input type="number" step="0.1" value={p.warn_limit ?? ""} onChange={(e) => setOvLimit(p.id, "warn_limit", e.target.value)} onBlur={commitAndReauditOv} className={INP} /></label>
                          <label className="block"><span className="mb-0.5 block text-[13px] font-bold text-red">Crit</span><input type="number" step="0.1" value={p.crit_limit ?? ""} onChange={(e) => setOvLimit(p.id, "crit_limit", e.target.value)} onBlur={commitAndReauditOv} className={INP} /></label>
                          <label className="block"><span className="mb-0.5 block text-[13px] font-bold text-yellow">W-pen</span><input type="number" min={0} max={100} value={p.warn_penalty ?? 0} onChange={(e) => setOvLimit(p.id, "warn_penalty", e.target.value)} onBlur={commitAndReauditOv} className={INP} /></label>
                          <label className="block"><span className="mb-0.5 block text-[13px] font-bold text-red">C-pen</span><input type="number" min={0} max={100} value={p.crit_penalty ?? 0} onChange={(e) => setOvLimit(p.id, "crit_penalty", e.target.value)} onBlur={commitAndReauditOv} className={INP} /></label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {(ovBusy || ovAudit) && (
                <div className="rounded-lg border border-border bg-black/[0.02] p-3">
                  {ovBusy ? (
                    <div className="py-2 text-center text-[13px] text-t3">กำลังคำนวณตัวอย่าง…</div>
                  ) : ovAudit ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[14px] text-t2"><Eye className="h-3.5 w-3.5" aria-hidden />ตัวอย่างคะแนนสุทธิของ {selected?.id} หากบันทึกค่านี้</div>
                      <div className="font-mono text-[18px] font-extrabold" style={{ color: readableText(healthColor(ovAudit.netScore)) }}>{ovAudit.netScore}</div>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border pt-2.5">
                <Button size="sm" variant="ghost" onClick={() => setOvMode(false)}>ยกเลิก</Button>
                {ovHasOverride && (
                  <Button size="sm" variant="ghost" onClick={resetOverride} disabled={ovSaving}><Trash2 className="h-3.5 w-3.5" aria-hidden />รีเซ็ตเป็นค่ากลาง</Button>
                )}
                <Button size="sm" variant="primary" onClick={saveOverride} disabled={ovSaving}>
                  {ovSaving ? "กำลังบันทึก…" : <><Save className="h-3.5 w-3.5" aria-hidden />บันทึกเป็นค่าเฉพาะเครื่องนี้</>}
                </Button>
              </div>
            </div>
          )}
        </Card>
        </div>
      )}

      {/* Score weighting */}
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan/12"><Scale className="h-4 w-4" aria-hidden /></div>
            <div>
              <h2 className="font-sans text-[18px] max-sm:text-[16px] font-semibold">น้ำหนักคะแนนรวม (Overall Score Weighting)</h2>
              <div className="text-[13px] text-t3">ปรับค่าใดค่าหนึ่ง อีกค่าจะปรับสมดุลให้รวม 100 อัตโนมัติ — ค่านี้เป็นค่ากลาง เครื่องที่มีค่าเฉพาะเครื่องจะไม่เปลี่ยนตามจนกว่าจะกด &quot;ปรับทั้งหมด&quot;</div>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={goToPerMachine}><Wrench className="h-3.5 w-3.5" aria-hidden />ปรับรายตัว</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmApplyAll(true)}><Globe className="h-3.5 w-3.5" aria-hidden />ปรับทั้งหมด</Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-yellow"><span className="inline-flex items-center gap-1.5"><Droplet className="h-3.5 w-3.5" aria-hidden />Oil weight (%)</span></span>
            <input type="number" min={0} max={100} value={score.oil_weight} onChange={(e) => setWeight("oil_weight", e.target.value)} onBlur={commitAndReaudit} className={INP} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-purple"><span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" aria-hidden />Vibration weight (%)</span></span>
            <input type="number" min={0} max={100} value={score.vib_weight} onChange={(e) => setWeight("vib_weight", e.target.value)} onBlur={commitAndReaudit} className={INP} />
          </label>
        </div>
      </Card>

      <Modal open={confirmApplyAll} onClose={() => setConfirmApplyAll(false)} title={<span className="flex items-center gap-1.5"><Globe className="h-4 w-4" aria-hidden />ปรับน้ำหนักคะแนนทั้งหมด</span>}>
        <p className="text-[14px] text-t2">
          จะนำค่าน้ำหนักปัจจุบัน (<Droplet className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> {score.oil_weight}% / <Activity className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> {score.vib_weight}%) ไปทับค่าเฉพาะเครื่อง (override) ของ<b>ทุกเครื่องจักร</b>ที่เคยตั้งไว้ต่างจากค่ากลาง แล้วคำนวณคะแนนสุขภาพใหม่ทั้งหมด ต้องการดำเนินการต่อหรือไม่?
        </p>
        <div className="mt-3 flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setConfirmApplyAll(false)}>ยกเลิก</Button>
          <Button size="sm" variant="primary" onClick={applyAll} disabled={applyingAll}>
            {applyingAll ? "กำลังปรับ…" : <><CircleCheck className="h-3.5 w-3.5" aria-hidden />ยืนยันปรับทั้งหมด</>}
          </Button>
        </div>
      </Modal>

      {/* Oil / Vib limits — with per-parameter penalty display */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-yellow/12"><Droplet className="h-4 w-4" aria-hidden /></span>
            <h2 className="font-sans text-[18px] max-sm:text-[16px] font-semibold">เกณฑ์วิเคราะห์น้ำมัน (Oil Limits + Scoring)</h2>
          </div>
          <div className="space-y-2">
            {oilParams.map((p) => (
              <div key={p.id} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between"><span className="text-[14px] font-semibold">{p.name}</span><span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[13px] text-t3">{p.unit}</span></div>
                <StandardsChips standards={standardsByParam?.[p.key]} />
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {p.key === "visc" ? (
                    <ViscGradeLimits />
                  ) : (
                    <>
                      <label className="block"><span className="mb-1 block text-[13px] font-bold text-yellow">Warn ≥</span>
                        <input type="number" step="0.1" value={p.warn_limit ?? ""} onChange={(e) => setLimit(p.id, "warn_limit", e.target.value)} onBlur={commitAndReaudit} className={INP} />
                      </label>
                      <label className="block"><span className="mb-1 block text-[13px] font-bold text-red">Crit ≥</span>
                        <input type="number" step="0.1" value={p.crit_limit ?? ""} onChange={(e) => setLimit(p.id, "crit_limit", e.target.value)} onBlur={commitAndReaudit} className={INP} />
                      </label>
                    </>
                  )}
                  <label className="block"><span className="mb-1 block text-[13px] font-bold text-yellow">Penalty −</span>
                    <input type="number" min={0} max={100} value={p.warn_penalty ?? 0} onChange={(e) => setLimit(p.id, "warn_penalty", e.target.value)} onBlur={commitAndReaudit} className={INP} />
                  </label>
                  <label className="block"><span className="mb-1 block text-[13px] font-bold text-red">Penalty −</span>
                    <input type="number" min={0} max={100} value={p.crit_penalty ?? 0} onChange={(e) => setLimit(p.id, "crit_penalty", e.target.value)} onBlur={commitAndReaudit} className={INP} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-purple/12"><Activity className="h-4 w-4" aria-hidden /></span>
            <h2 className="font-sans text-[18px] max-sm:text-[16px] font-semibold">เกณฑ์ความสั่นสะเทือน (Vibration Limits + Scoring)</h2>
          </div>
          <div className="space-y-2">
            {vibParams.map((p) => (
              <div key={p.id} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between"><span className="text-[14px] font-semibold">{p.name}</span><span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[13px] text-t3">{p.unit}</span></div>
                <StandardsChips standards={standardsByParam?.[p.key]} />
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <label className="block"><span className="mb-1 block text-[13px] font-bold text-yellow">Warn ≥</span>
                    <input type="number" step="0.1" value={p.warn_limit ?? ""} onChange={(e) => setLimit(p.id, "warn_limit", e.target.value)} onBlur={commitAndReaudit} className={INP} />
                  </label>
                  <label className="block"><span className="mb-1 block text-[13px] font-bold text-red">Crit ≥</span>
                    <input type="number" step="0.1" value={p.crit_limit ?? ""} onChange={(e) => setLimit(p.id, "crit_limit", e.target.value)} onBlur={commitAndReaudit} className={INP} />
                  </label>
                  <label className="block"><span className="mb-1 block text-[13px] font-bold text-yellow">Penalty −</span>
                    <input type="number" min={0} max={100} value={p.warn_penalty ?? 0} onChange={(e) => setLimit(p.id, "warn_penalty", e.target.value)} onBlur={commitAndReaudit} className={INP} />
                  </label>
                  <label className="block"><span className="mb-1 block text-[13px] font-bold text-red">Penalty −</span>
                    <input type="number" min={0} max={100} value={p.crit_penalty ?? 0} onChange={(e) => setLimit(p.id, "crit_penalty", e.target.value)} onBlur={commitAndReaudit} className={INP} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Penalties */}
      <Card>
        <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Ruler className="h-4 w-4" aria-hidden />เกณฑ์การตัดคะแนน (Penalty Default)</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block"><span className="mb-1 block text-[13px] font-bold text-yellow">Warn penalty (−)</span>
            <input type="number" min={0} max={100} value={score.warn_penalty} onChange={(e) => setScore((p) => ({ ...p, warn_penalty: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} onBlur={commitAndReaudit} className={INP} />
          </label>
          <label className="block"><span className="mb-1 block text-[13px] font-bold text-red">Crit penalty (−)</span>
            <input type="number" min={0} max={100} value={score.crit_penalty} onChange={(e) => setScore((p) => ({ ...p, crit_penalty: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))} onBlur={commitAndReaudit} className={INP} />
          </label>
        </div>
        <div className="mt-2 rounded-lg border border-cyan/15 bg-cyan/[0.04] p-2 text-[14px] text-t2">
          <Info className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />ค่านี้เป็น <b>default</b> สำหรับพารามิเตอร์ที่ไม่ได้ตั้ง penalty เฉพาะ — ดู <b className="text-cyan">เกณฑ์คะแนนเต็ม</b> ได้ที่หน้า Drill-down &gt; วิเคราะห์สุขภาพ
        </div>
      </Card>
    </div>
  );
}
