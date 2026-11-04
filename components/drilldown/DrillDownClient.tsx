"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Activity, BookOpen, BrainCircuit, CalendarDays, ChartColumn, ChevronDown, Cog, History, ClipboardList, Download, Droplet, Droplets, Factory, FlaskConical, HeartPulse, Info, Paperclip, Ruler, Scale, Search, Siren, Sparkles, Target, Timer, TriangleAlert, Wrench, type LucideIcon } from "lucide-react";
import { Card, Button, StatusBadge, HealthBar, ButtonLink } from "@/components/ui/primitives";
import { DeductionSection } from "@/components/ui/DeductionSection";
import { AdviceList } from "@/components/ui/AdviceList";
import { GearSpinner } from "@/components/ui/LubeIcons";
import { actionReason } from "@/lib/scoring/advice";
import { useToast } from "@/components/ui/Toast";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { VibrationHistoryChart } from "@/components/charts/VibrationHistoryChart";
import { RcaChart } from "@/components/charts/RcaChart";
import { MaintenanceTab } from "@/components/drilldown/MaintenanceTab";
import { HistoryTab } from "@/components/drilldown/HistoryTab";
import type { HistoryEntry } from "@/lib/asset-history";
import { AttachmentsPanel } from "@/components/drilldown/AttachmentsPanel";
import { StandardCard } from "@/components/standards/StandardContent";
import { healthColor, runHours, statusLabelTh } from "@/lib/scoring/health";
import { getViscosityLimits, viscCriteriaText } from "@/lib/viscosity-limits";
import { addMonthsYM, dueInfo, nextSampleYM, nowYM } from "@/lib/sampling";
import { downloadFile } from "@/lib/export";
import type {
  AlarmParam,
  Asset,
  MaintenanceRecord,
  OilReading,
  ReadingAttachment,
  ScoreConfig,
  Standard,
  VibReading,
} from "@/lib/types";
import type { AssetOption } from "@/lib/queries/assets";
import type { DeductionBreakdown } from "@/lib/scoring/audit";
import type { RcaProbabilities } from "@/lib/scoring/rca";
import type { DiagnoseResult } from "@/lib/ai/provider";
import { readableText } from "@/lib/color";

type Tab = "wear" | "oil" | "vib" | "health" | "maint" | "intel" | "compare" | "history";

const SOURCE_LABEL: Record<string, string> = {
  glm: "GLM",
  openai: "OpenAI",
  anthropic: "Claude",
  fallback: "Rule-based (ไม่มี AI key)",
};

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "wear", label: "การสึกหรอ (Wear)", icon: Cog },
  { id: "oil", label: "สภาพน้ำมัน (Oil)", icon: Droplet },
  { id: "vib", label: "ความสั่นสะเทือน", icon: Activity },
  { id: "health", label: "วิเคราะห์สุขภาพ", icon: HeartPulse },
  { id: "maint", label: "ซ่อมบำรุง", icon: Wrench },
  { id: "intel", label: "Intelligence", icon: BrainCircuit },
  { id: "compare", label: "เปรียบเทียบ", icon: Scale },
  { id: "history", label: "ประวัติ", icon: History },
];

function Metric({
  label,
  value,
  unit,
  warn,
  crit,
  color,
}: {
  label: string;
  value: string | number;
  unit?: string;
  warn?: number | null;
  crit?: number | null;
  color?: string;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-bg3 p-2.5">
      <div className="text-[13px] font-bold text-t3">{label}</div>
      <div className={`font-mono text-[19px] font-bold leading-none ${color ? "" : "text-t1"}`} style={color ? { color: readableText(color) } : undefined}>
        {value}
      </div>
      {unit ? <div className="mt-0.5 text-[13px] text-t3">{unit}</div> : null}
      {warn != null && crit != null ? (
        <div className="mt-1 flex gap-1 font-mono text-[14px]">
          <span className="rounded bg-yellow/10 px-1 text-yellow">{warn}</span>
          <span className="rounded bg-red/10 px-1 text-red">{crit}</span>
        </div>
      ) : null}
    </div>
  );
}

// Shared by the Oil and Vibration tabs — identical "attachments + related
// standards" pair, differing only by kind ("oil"/"vib") and its label.
function AttachmentsAndStandards({
  assetId,
  kind,
  kindLabel,
  attachments,
  canManageAttachments,
  standards,
}: {
  assetId: string;
  kind: "oil" | "vib";
  kindLabel: string;
  attachments: ReadingAttachment[];
  canManageAttachments: boolean;
  standards: Standard[] | undefined;
}) {
  const filtered = attachments.filter((a) => a.kind === kind);
  return (
    <>
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Paperclip className="h-4 w-4" aria-hidden />ไฟล์ผลแลปแนบ ({kindLabel} Report)</h2>
          <span className="rounded bg-cyan/10 px-1.5 py-0.5 text-[14px] text-cyan">{filtered.length} ไฟล์</span>
        </div>
        <AttachmentsPanel assetId={assetId} attachments={filtered} canManage={canManageAttachments} />
      </Card>
      {standards && standards.length > 0 && (
        <Card>
          {/* Reference material, often long — collapsed until wanted. */}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
              <h2 className="flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold">
                <Paperclip className="h-4 w-4" aria-hidden />มาตรฐานที่เกี่ยวข้อง ({kindLabel})
                <span className="text-[13px] font-normal text-t3">({standards.length})</span>
              </h2>
              <ChevronDown className="h-4 w-4 shrink-0 text-t3 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-2 space-y-1.5">
              {standards.map((s) => (
                <StandardCard key={s.id} standard={s} />
              ))}
              <Link href="/standards" className="inline-block pt-1 text-[14px] text-cyan hover:underline">เปิดคลังทั้งหมด →</Link>
            </div>
          </details>
        </Card>
      )}
    </>
  );
}

export function DrillDownClient({
  asset,
  oilHistory,
  vibHistory,
  maintenance,
  audit,
  rca,
  params,
  scoreConfig,
  typeColor,
  typeAbbr,
  attachments,
  relatedStandards,
  compareOptions,
  canManageMaint,
  canManageAttachments,
  history,
}: {
  asset: Asset;
  oilHistory: OilReading[];
  vibHistory: VibReading[];
  maintenance: MaintenanceRecord[];
  audit: DeductionBreakdown;
  rca: RcaProbabilities;
  params: AlarmParam[];
  scoreConfig: ScoreConfig;
  typeColor: string;
  typeAbbr: string;
  attachments: ReadingAttachment[];
  relatedStandards?: { oil: Standard[]; vib: Standard[] };
  compareOptions: AssetOption[];
  canManageMaint: boolean;
  canManageAttachments: boolean;
  /** null = this role may not read the audit log, so the tab is hidden. */
  history: HistoryEntry[] | null;
}) {
  const urlTab = useSearchParams().get("tab");
  const [tab, setTabState] = useState<Tab>(TABS.some((t) => t.id === urlTab && (t.id !== "history" || history)) ? (urlTab as Tab) : "wear");
  // ?tab= keeps the open tab on refresh and in shared links; replaceState skips a server round trip.
  function setTab(t: Tab) {
    setTabState(t);
    const u = new URL(window.location.href);
    u.searchParams.set("tab", t);
    window.history.replaceState(null, "", u);
  }
  const [ai, setAi] = useState<(DiagnoseResult & { _source?: string }) | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [rcaAi, setRcaAi] = useState<{ analysis: string; source: string } | null>(null);
  const [rcaAiLoading, setRcaAiLoading] = useState(false);
  const [rcaAiErr, setRcaAiErr] = useState<string | null>(null);
  const [compareId, setCompareId] = useState("");
  const [compareData, setCompareData] = useState<Asset | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  async function runCompare() {
    if (!compareId) return;
    setCompareLoading(true);
    setCompareData(null);
    try {
      const res = await fetch(`/api/compare?id=${compareId}`);
      const data = await res.json();
      setCompareData(res.ok ? (data.asset as Asset) : null);
    } catch (e) {
      setCompareData(null);
    } finally {
      setCompareLoading(false);
    }
  }

  async function runRcaAi() {
    setRcaAiLoading(true);
    setRcaAiErr(null);
    setRcaAi(null);
    try {
      const res = await fetch("/api/ai/rca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "AI error");
      setRcaAi(data as { analysis: string; source: string });
    } catch (e) {
      setRcaAiErr("เกิดข้อผิดพลาดในการวิเคราะห์ RCA");
    } finally {
      setRcaAiLoading(false);
    }
  }

  async function runAi() {
    setAiLoading(true);
    setAiErr(null);
    setAi(null);
    try {
      const res = await fetch("/api/ai/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "AI error");
      setAi(data as DiagnoseResult & { _source?: string });
    } catch (e) {
      setAiErr("เกิดข้อผิดพลาดในการวิเคราะห์ AI");
    } finally {
      setAiLoading(false);
    }
  }
  const toast = useToast();
  const h = healthColor(asset.health);
  const latestOil = oilHistory.length ? oilHistory[oilHistory.length - 1] : null;
  const latestVib = vibHistory.length ? vibHistory[vibHistory.length - 1] : null;
  const cause = actionReason(audit, scoreConfig, latestOil, latestVib, asset.vg_grade);
  // Standards that govern the readings behind the cause, for the "where does this limit come from" link.
  const causeStandards = [...(relatedStandards?.oil ?? []), ...(relatedStandards?.vib ?? [])]
    .filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i && (s.related_params ?? []).some((k) => cause.keys.includes(k)));

  const lim = (cat: string, key: string) => params.find((p) => p.category === cat && p.key === key);
  const fe = lim("oil", "fe"),
    water = lim("oil", "water"),
    tan = lim("oil", "tan"),
    vel = lim("vib", "vel"),
    acc = lim("vib", "acc");
  const viscLimits = getViscosityLimits(asset.vg_grade);

  const oilLabels = oilHistory.map((o) => o.period);
  const vibLabels = vibHistory.map((v) => v.period);

  // 0 = no cycle in the lubrication plan: show "not set" instead of a due date that is always overdue
  const NO_CYCLE = { label: "ไม่ระบุรอบ", color: "" };
  const chgDue = asset.oil_change_months ? dueInfo(addMonthsYM(asset.last_update ?? nowYM(), asset.oil_change_months)) : NO_CYCLE;
  const smpDue = asset.oil_sample_months ? dueInfo(nextSampleYM(latestOil?.period ?? null, asset.last_update, asset.oil_sample_months)) : NO_CYCLE;

  function onExport() {
    downloadFile(
      `${asset.id}_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ asset, oilHistory, vibHistory, maintenance }, null, 2),
      "application/json",
    );
    toast("ส่งออกข้อมูลสำเร็จ");
  }

  return (
    <div className="fade">
      {/* Header */}
      <Card className="mb-3">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[14px] font-bold" style={{ background: typeColor + "22", border: `1px solid ${typeColor}55`, color: readableText(typeColor) }}>
                {typeAbbr}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] font-semibold text-cyan">{asset.id}</span>
                  <span className="text-[13px] text-t3">TAG</span>
                </div>
                <span className="font-sans text-[19px] font-bold text-t1">{asset.name}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[14px] text-t2">
              <StatusBadge status={asset.status} />
              <span className="rounded bg-black/[0.06] px-1.5 py-0.5 text-[13px] text-t3">{asset.type}</span>
              <span className="inline-flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" aria-hidden />{asset.site}</span>
              <span className="inline-flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" aria-hidden />{runHours(asset.install_date).toLocaleString()} Hrs</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-[13px] text-t3">Health index</div>
              <div className="flex items-baseline gap-2">
                <span className="font-sans text-[23px] font-bold tabular-nums" style={{ color: readableText(h) }}>{asset.health}</span>
                <span className="text-[14px] font-semibold" style={{ color: readableText(h) }}>{statusLabelTh(asset.status)}</span>
              </div>
              <div className="mt-0.5 h-1 w-[140px] overflow-hidden rounded bg-black/10">
                <div className="h-full rounded" style={{ width: `${asset.health}%`, background: h }} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] text-t3">Last update</div>
              <div className="flex items-center justify-end gap-1.5 font-mono text-[14px] text-cyan"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{asset.last_update}</div>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={onExport}><Download className="h-3.5 w-3.5" aria-hidden />Export</Button>
              <Button size="sm" variant="ghost" onClick={() => setTab("intel")}><Sparkles className="h-3.5 w-3.5" aria-hidden />AI Diagnostic</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Main cause first: the same reasons and next steps as the Dashboard's Action Required row. */}
      {cause.advice.length > 0 && (
        <Card className={`mb-3 border-l-4 ${asset.status === "Critical" ? "!border-l-red" : "!border-l-yellow"}`}>
          <h2 className="mb-2 flex items-center gap-1.5 text-[18px] max-sm:text-[16px] font-semibold"><Wrench className="h-4 w-4 text-red" aria-hidden />สาเหตุหลัก <span className="text-[13px] font-medium text-t3">(Main cause)</span></h2>
          <AdviceList reason={cause} />
          {causeStandards.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-t3">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />มาตรฐานอ้างอิง:
              {causeStandards.map((s) => (
                <Link key={s.id} href={`/standards?q=${encodeURIComponent(s.title)}`} className="rounded-full border border-border px-2 py-0.5 text-cyan hover:border-cyan">{s.title}</Link>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-3 flex flex-wrap gap-1 border-b border-border" role="tablist">
        {TABS.filter((t) => t.id !== "history" || history).map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[14px] font-medium transition ${
              tab === t.id ? "border-cyan text-cyan" : "border-transparent text-t2 hover:text-t1"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" aria-hidden />{t.label}
          </button>
        ))}
      </div>

      {/* Wear */}
      {tab === "wear" && (
        <div id="panel-wear" role="tabpanel" aria-labelledby="tab-wear">
          <Card className="mb-3">
            <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Cog className="h-4 w-4" aria-hidden />แนวโน้มการสึกหรอ (Wear Trend — ppm)</h2>
            {oilHistory.length ? (
              <TrendLineChart
                labels={oilLabels}
                series={[
                  { label: "Iron (Fe)", data: oilHistory.map((o) => o.fe ?? null), color: "#ef4444", warn: fe?.warn_limit ?? 100, crit: fe?.crit_limit ?? 200 },
                ]}
              />
            ) : (
              <div className="py-6 text-center text-[13px] text-t3">ไม่มีข้อมูล Oil Analysis</div>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-2.5">
            <Metric label="Iron (Fe)" value={latestOil?.fe ?? "—"} unit="ppm" warn={fe?.warn_limit} crit={fe?.crit_limit} color="#ef4444" />
            <Metric label="ISO cleanliness" value={latestOil?.iso_code ?? "—"} unit="ISO 4406" color="#0066cc" />
          </div>
        </div>
      )}

      {/* Oil */}
      {tab === "oil" && (
        <div id="panel-oil" role="tabpanel" aria-labelledby="tab-oil">
          <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Metric label="VISCOSITY @ 40°C" value={latestOil?.visc != null ? Number(latestOil.visc).toFixed(2) : "—"} unit="cSt" warn={viscLimits.warn} crit={viscLimits.crit} color="#22c55e" />
            <Metric label="Water content" value={latestOil?.water ?? "—"} unit="ppm" warn={water?.warn_limit} crit={water?.crit_limit} color="#38bdf8" />
            <Metric label="TAN" value={latestOil?.tan != null ? Number(latestOil.tan).toFixed(3) : "—"} unit="mgKOH/g" warn={tan?.warn_limit} crit={tan?.crit_limit} color="#a855f7" />
          </div>
          {oilHistory.length ? (
            <>
              <Card className="mb-3">
                <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Droplet className="h-4 w-4" aria-hidden />ความหนืด (Viscosity @40°C — cSt)</h2>
                <TrendLineChart
                  labels={oilLabels}
                  series={[
                    { label: "Viscosity @40°C", data: oilHistory.map((o) => o.visc ?? null), color: "#22c55e", warn: viscLimits.warn, crit: viscLimits.crit },
                  ]}
                  height={160}
                />
              </Card>
              <Card className="mb-3">
                <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Droplets className="h-4 w-4" aria-hidden />ปริมาณน้ำ (Water — ppm)</h2>
                <TrendLineChart
                  labels={oilLabels}
                  series={[
                    { label: "Water (ppm)", data: oilHistory.map((o) => o.water ?? null), color: "#38bdf8", warn: water?.warn_limit ?? 500, crit: water?.crit_limit ?? 1000 },
                  ]}
                  height={160}
                />
              </Card>
              <Card className="mb-3">
                <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><FlaskConical className="h-4 w-4" aria-hidden />ความเป็นกรด (TAN — mgKOH/g)</h2>
                <TrendLineChart
                  labels={oilLabels}
                  series={[
                    { label: "TAN (mgKOH/g)", data: oilHistory.map((o) => o.tan != null ? Number(o.tan) : null), color: "#a855f7", warn: tan?.warn_limit ?? 1.0, crit: tan?.crit_limit ?? 2.0 },
                  ]}
                  height={160}
                />
              </Card>
            </>
          ) : (
            <Card className="mb-3"><div className="py-6 text-center text-[13px] text-t3">ไม่มีข้อมูล Oil Analysis</div></Card>
          )}
          <Card>
            <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Droplet className="h-4 w-4" aria-hidden />ข้อมูลหลักการหล่อลื่น (Lubrication Master Data)</h2>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Metric label="ชนิด/เบอร์น้ำมัน" value={asset.oil_brand ?? "—"} />
              <Metric label="ISO VG grade" value={asset.vg_grade ? `VG ${asset.vg_grade}` : "—"} />
              <Metric label="ปริมาณน้ำมัน" value={`${asset.oil_qty_l} L`} />
              <Metric label="รอบเปลี่ยนถ่าย" value={asset.oil_change_months ? `${asset.oil_change_months} ด.` : "—"} />
              <Metric label="รอบเก็บตัวอย่าง" value={asset.oil_sample_months ? `${asset.oil_sample_months} ด.` : "—"} />
              <Metric label="สถานะเปลี่ยนถ่าย" value={chgDue.label} color={chgDue.color} />
              <Metric label="สถานะเก็บตัวอย่าง" value={smpDue.label} color={smpDue.color} />
              <Metric label="กำลังมอเตอร์" value={`${asset.motor_kw ?? "—"} kW`} />
            </div>
          </Card>
          <AttachmentsAndStandards
            assetId={asset.id}
            kind="oil"
            kindLabel="Oil"
            attachments={attachments}
            canManageAttachments={canManageAttachments}
            standards={relatedStandards?.oil}
          />
        </div>
      )}

      {/* Vibration */}
      {tab === "vib" && (
        <div id="panel-vib" role="tabpanel" aria-labelledby="tab-vib">
          <Card className="mb-3">
            <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Activity className="h-4 w-4" aria-hidden />ประวัติความสั่นสะเทือน (Velocity RMS / Peak Accel)</h2>
            {vibHistory.length ? (
              <VibrationHistoryChart
                labels={vibLabels}
                vel={vibHistory.map((v) => v.vel ?? null)}
                acc={vibHistory.map((v) => v.acc ?? null)}
              />
            ) : (
              <div className="py-6 text-center text-[13px] text-t3">ไม่มีข้อมูล Vibration</div>
            )}
          </Card>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Metric label="Overall velocity (RMS)" value={latestVib?.vel ?? "—"} unit="mm/s" warn={vel?.warn_limit} crit={vel?.crit_limit} color="#0066cc" />
            <Metric label="Peak acceleration" value={latestVib?.acc ?? "—"} unit="g-PK" warn={acc?.warn_limit} crit={acc?.crit_limit} color="#f472b6" />
          </div>
          <AttachmentsAndStandards
            assetId={asset.id}
            kind="vib"
            kindLabel="Vibration"
            attachments={attachments}
            canManageAttachments={canManageAttachments}
            standards={relatedStandards?.vib}
          />
        </div>
      )}

      {/* Health */}
      {tab === "health" && (
        <div id="panel-health" role="tabpanel" aria-labelledby="tab-health">
          <Card className="mb-3">
            <div className="rounded-lg border border-border bg-black/[0.02] p-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-[14px] text-t2"><span className="inline-block h-2 w-2 rounded-full bg-green align-middle" aria-hidden /> คะแนนเริ่มต้น (Base Score)</span>
                <span className="font-mono text-[16px] font-bold text-t1">100</span>
              </div>
              <DeductionSection title={<><Droplet className="h-4 w-4" aria-hidden />Oil Analysis</>} weight={scoreConfig.oil_weight} score={audit.oilScore} items={audit.items.filter((it) => it.category === "oil" && (it.penalty > 0 || it.cappedFrom != null))} emptyLabel="ไม่พบความผิดปกติจากน้ำมัน" />
              <DeductionSection title={<><Activity className="h-4 w-4" aria-hidden />Vibration</>} weight={scoreConfig.vib_weight} score={audit.vibScore} items={audit.items.filter((it) => it.category === "vib" && (it.penalty > 0 || it.cappedFrom != null))} emptyLabel="ไม่พบความผิดปกติจากการสั่นสะเทือน" />
              <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
                <div>
                  <div className="text-[14px] font-bold text-t1">คะแนนสุทธิ (Net Score)</div>
                  <div className="text-[13px] text-t3">({audit.oilScore} × {scoreConfig.oil_weight}% + {audit.vibScore} × {scoreConfig.vib_weight}%) ÷ 100 = {audit.netScore}</div>
                </div>
                <div className="font-mono text-[26px] font-extrabold" style={{ color: readableText(healthColor(audit.netScore)) }}>{audit.netScore}</div>
              </div>
            </div>
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Ruler className="h-4 w-4" aria-hidden />เกณฑ์การตัดคะแนน (Deduction Criteria Reference)</h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <div className="mb-2 text-[13px] font-bold text-yellow">Oil Analysis</div>
                <CriteriaTable params={params.filter((p) => p.category === "oil")} scoreConfig={scoreConfig} vgGrade={asset.vg_grade} />
              </div>
              <div>
                <div className="mb-2 text-[13px] font-bold text-purple">Vibration Analysis</div>
                <CriteriaTable params={params.filter((p) => p.category === "vib")} scoreConfig={scoreConfig} />
              </div>
            </div>
            <div className="mt-2 text-[13px] text-t3">
              <Info className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />ค่าที่วัดได้เกิน Warning (แต่ยังไม่ถึง Critical) หักเต็ม <b>Penalty − (Warning)</b> · เกิน Critical หักเต็ม <b>Penalty − (Critical)</b> ของพารามิเตอร์นั้นตามตารางด้านบนเสมอ
            </div>
          </Card>
        </div>
      )}

      {tab === "history" && history && (
        <div id="panel-history" role="tabpanel" aria-labelledby="tab-history">
          <HistoryTab entries={history} />
        </div>
      )}

      {/* Maintenance */}
      {tab === "maint" && (
        <div id="panel-maint" role="tabpanel" aria-labelledby="tab-maint">
          <MaintenanceTab assetId={asset.id} records={maintenance} canManage={canManageMaint} />
        </div>
      )}

      {/* Intelligence */}
      {tab === "intel" && (
        <div id="panel-intel" role="tabpanel" aria-labelledby="tab-intel">
          <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card>
              <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><BrainCircuit className="h-4 w-4" aria-hidden />RCA Failure Mode Risk Index</h2>
              <div className="mb-2 text-[13px] leading-relaxed text-t3">
                ค่าความเสี่ยงสัมพัทธ์จากค่าล่าสุด (heuristic) — ใช้จัดลำดับการตรวจสอบ ไม่ใช่ความน่าจะเป็นทางสถิติ
              </div>
              <RcaChart p={rca} />

              {/* AI analysis of the RCA indices */}
              <div className="mt-2.5 border-t border-border pt-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-t3">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />AI วิเคราะห์ RCA
                  </span>
                  <Button size="sm" variant="ghost" onClick={runRcaAi} disabled={rcaAiLoading}>
                    {rcaAiLoading ? <><GearSpinner className="h-3.5 w-3.5" />กำลังวิเคราะห์…</> : <><Sparkles className="h-3.5 w-3.5" aria-hidden />วิเคราะห์</>}
                  </Button>
                </div>
                {rcaAiErr && (
                  <div className="mt-2 flex items-center gap-1.5 rounded border border-red/30 bg-red/10 px-2.5 py-1.5 text-[14px] text-red">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />{rcaAiErr}
                  </div>
                )}
                {rcaAi && (
                  <div className="mt-2 rounded border border-border bg-bg3 px-2.5 py-2">
                    <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-t1">
                      {rcaAi.analysis}
                    </div>
                    <div className="mt-1.5 text-[13px] font-medium text-t3">
                      source: {SOURCE_LABEL[rcaAi.source] ?? rcaAi.source}
                    </div>
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><ClipboardList className="h-4 w-4" aria-hidden />ข้อมูลจำเพาะเครื่อง</h2>
              <div className="grid grid-cols-2 gap-1.5">
                <Spec label="กำลังมอเตอร์" value={`${asset.motor_kw ?? "—"} kW`} />
                <Spec label="ความเร็วรอบ" value={`${asset.rpm ?? "—"} RPM`} />
                <Spec label="ISO VG Grade" value={`VG ${asset.vg_grade}`} />
                <Spec label="ที่ตั้ง" value={asset.site} />
                <Spec label="ประเภท" value={asset.type} />
                <Spec label="Health" value={`${asset.health} · ${statusLabelTh(asset.status)}`} />
              </div>
            </Card>
          </div>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Sparkles className="h-4 w-4" aria-hidden />AI Diagnostic</h2>
                <div className="text-[14px] text-t2">วิเคราะห์ด้วย AI (multi-provider) — ใช้ rule-based fallback ได้โดยไม่ต้องมี key</div>
              </div>
              <Button size="sm" variant="primary" onClick={runAi} disabled={aiLoading}>{aiLoading ? <><GearSpinner className="h-3.5 w-3.5" />กำลังวิเคราะห์…</> : <><Sparkles className="h-3.5 w-3.5" aria-hidden />วิเคราะห์ด้วย AI</>}</Button>
            </div>
            {aiErr && <div className="mt-2 flex items-center gap-1.5 rounded border border-red/30 bg-red/10 px-2.5 py-1.5 text-[14px] text-red"><TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />{aiErr}</div>}
            {ai && (
              <div className="mt-2.5 space-y-2 border-t border-border pt-2.5">
                <div className="flex items-center justify-between">
                  <span className="badge" style={{ background: ai.confidencePct >= 80 ? "rgba(34,197,94,.12)" : "rgba(245,158,11,.12)", color: readableText(ai.confidencePct >= 80 ? "#22c55e" : "#f59e0b"), border: `1px solid ${ai.confidencePct >= 80 ? "rgba(34,197,94,.3)" : "rgba(245,158,11,.3)"}` }}>Confidence: {ai.confidencePct}%</span>
                  <span className="text-[13px] text-t3">source: {ai._source ?? "fallback"}</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-t3"><Target className="h-3.5 w-3.5" aria-hidden />ปัญหาหลัก</div>
                  <div className="rounded border border-red/20 bg-red/[0.05] px-2 py-1 text-[14px] font-semibold text-red">{ai.primaryAnomaly}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-t3"><ClipboardList className="h-3.5 w-3.5" aria-hidden />ภาพรวม</div>
                  <div className="text-[14px] leading-relaxed text-t2">{ai.summary}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><div className="flex items-center gap-1.5 text-[13px] font-bold text-t3"><Droplet className="h-3.5 w-3.5" aria-hidden />Oil</div><div className="text-[14px] text-t2">{ai.oilAnalysis}</div></div>
                  <div><div className="flex items-center gap-1.5 text-[13px] font-bold text-t3"><Activity className="h-3.5 w-3.5" aria-hidden />Vibration</div><div className="text-[14px] text-t2">{ai.vibrationAnalysis}</div></div>
                </div>
                <div><div className="flex items-center gap-1.5 text-[13px] font-bold text-t3"><Search className="h-3.5 w-3.5" aria-hidden />Root Cause</div><div className="text-[14px] text-t2">{ai.rootCauseHypothesis}</div></div>
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-t3"><ClipboardList className="h-3.5 w-3.5" aria-hidden />แผนปฏิบัติการ</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded border border-red/15 bg-red/[0.04] p-1.5"><div className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-red"><Siren className="h-3.5 w-3.5" aria-hidden />ทันที (24 ชม.)</div><ul className="list-disc space-y-0.5 pl-3 text-[14px] text-t2">{ai.actionPlan.immediate.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                    <div className="rounded border border-yellow/15 bg-yellow/[0.04] p-1.5"><div className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-yellow"><CalendarDays className="h-3.5 w-3.5" aria-hidden />ระยะสั้น</div><ul className="list-disc space-y-0.5 pl-3 text-[14px] text-t2">{ai.actionPlan.shortTerm.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                    <div className="rounded border border-cyan/15 bg-cyan/[0.04] p-1.5"><div className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-cyan"><CalendarDays className="h-3.5 w-3.5" aria-hidden />ระยะยาว</div><ul className="list-disc space-y-0.5 pl-3 text-[14px] text-t2">{ai.actionPlan.longTerm.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Compare */}
      {tab === "compare" && (
        <div id="panel-compare" role="tabpanel" aria-labelledby="tab-compare">
          <Card className="mb-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="compare-asset-select" className="mb-1 block text-[13px] font-bold text-t3">เทียบกับเครื่อง</label>
                <select
                  id="compare-asset-select"
                  value={compareId}
                  onChange={(e) => setCompareId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan"
                >
                  <option value="">— เลือก —</option>
                  {compareOptions.slice(0, 200).map((a) => (
                    <option key={a.id} value={a.id}>{a.id} · {a.name} ({a.health} · {statusLabelTh(a.status)})</option>
                  ))}
                </select>
              </div>
              <Button variant="primary" onClick={runCompare} disabled={compareLoading || !compareId}>
                {compareLoading ? "กำลังเทียบ..." : <><Scale className="h-3.5 w-3.5" aria-hidden />เปรียบเทียบ</>}
              </Button>
            </div>
          </Card>

          {compareData && (
            <div className="grid grid-cols-2 gap-3">
              {[asset, compareData].map((a, i) => (
                <Card key={i}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan/12 text-[15px]">{i === 0 ? "A" : "B"}</span>
                    <div>
                      <h2 className="font-sans text-[18px] max-sm:text-[16px] font-semibold">{a.name}</h2>
                      <div className="font-mono text-[13px] text-t3">{a.id}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-[14px]">
                    <CompareRow label="สถานะ" value={<StatusBadge status={a.status} />} />
                    <CompareRow label="Health Score" value={<HealthBar score={a.health} />} />
                    <CompareRow label="ประเภท" value={a.type} />
                    <CompareRow label="โรงงาน" value={<span className="inline-flex items-center gap-1.5"><Factory className="h-3.5 w-3.5" aria-hidden />{a.site}</span>} />
                    <CompareRow label="กำลัง (kW)" value={a.motor_kw?.toString() ?? "—"} />
                    <CompareRow label="RPM" value={a.rpm?.toString() ?? "—"} />
                    <CompareRow label="ISO VG" value={`VG ${a.vg_grade}`} />
                    <CompareRow label="น้ำมัน" value={a.oil_brand ?? "—"} />
                    <CompareRow label="ปริมาณ (L)" value={`${a.oil_qty_l}`} />
                    <CompareRow label="รอบเปลี่ยน" value={a.oil_change_months ? `${a.oil_change_months} เดือน` : "—"} />
                    <CompareRow label="Last Update" value={a.last_update ?? "—"} />
                  </div>
                </Card>
              ))}

              <Card className="col-span-2">
                <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><ChartColumn className="h-4 w-4" aria-hidden />สรุปความแตกต่าง</h2>
                <div className="grid grid-cols-3 gap-2 text-center text-[14px]">
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-[13px] text-t3">Health Δ</div>
                    <div className="font-mono text-[18px] font-bold" style={{ color: readableText(asset.health >= compareData.health ? "#22c55e" : "#ef4444") }}>
                      {asset.health > compareData.health ? "+" : ""}{asset.health - compareData.health}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-[13px] text-t3">A Status</div>
                    <div className="mt-0.5"><StatusBadge status={asset.status} /></div>
                  </div>
                  <div className="rounded-lg border border-border p-2">
                    <div className="text-[13px] text-t3">B Status</div>
                    <div className="mt-0.5"><StatusBadge status={compareData.status} /></div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      <div className="mt-3">
        <ButtonLink href="/assets" size="xs" variant="ghost">← กลับสู่รายการเครื่องจักร</ButtonLink>
      </div>
    </div>
  );
}

function CriteriaTable({ params, scoreConfig, vgGrade }: { params: AlarmParam[]; scoreConfig: ScoreConfig; vgGrade?: number }) {
  const visc = viscCriteriaText(vgGrade);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[14px]">
        <thead>
          <tr className="border-b border-border text-[13px] text-t3">
            <th scope="col" className="py-1.5">Parameter</th>
            <th scope="col" className="py-1.5 text-right">Warning</th>
            <th scope="col" className="py-1.5 text-right">Critical</th>
            <th scope="col" className="py-1.5 text-right text-yellow">Penalty −</th>
            <th scope="col" className="py-1.5 text-right text-red">Penalty −</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => {
            const wPen = p.warn_penalty ?? scoreConfig.warn_penalty;
            const cPen = p.crit_penalty ?? scoreConfig.crit_penalty;
            return (
              <tr key={p.id} className="border-b border-black/5">
                <td className="py-1.5">
                  {p.name} <span className="text-[13px] text-t3">{p.unit}</span>
                  {p.key === "visc" && vgGrade ? <div className="text-[13px] text-t3">ตามเกรด VG {vgGrade} (ISO 3448)</div> : null}
                </td>
                <td className="py-1.5 text-right font-mono text-yellow">{p.key === "visc" && vgGrade ? visc.warn : `≥ ${p.warn_limit}`}</td>
                <td className="py-1.5 text-right font-mono text-red">{p.key === "visc" && vgGrade ? visc.crit : `≥ ${p.crit_limit}`}</td>
                <td className="py-1.5 text-right font-mono font-bold text-yellow">{wPen}</td>
                <td className="py-1.5 text-right font-mono font-bold text-red">{cPen}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CompareRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-black/[0.03] pb-1">
      <span className="text-t3">{label}</span>
      <span className="font-medium text-t1">{value}</span>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg3 p-2">
      <div className="text-[13px] text-t3">{label}</div>
      <div className="font-mono text-[14px] font-semibold text-t1">{value}</div>
    </div>
  );
}
