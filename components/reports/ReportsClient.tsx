"use client";

import { useState } from "react";
import { ChartColumn, CircleCheck, Clock, FileChartColumn, FileText, Lightbulb, Lock, Mail, Printer, Settings, Sparkles, TrendingUp, TriangleAlert } from "lucide-react";
import { Card, Button } from "@/components/ui/primitives";
import { GearSpinner } from "@/components/ui/LubeIcons";
import { ReportDoc, type ReportConfig } from "@/components/reports/ReportDoc";
import { sendExecSummaryEmail } from "@/lib/actions/reports";
import { formatThaiDateTime } from "@/lib/format";
import type { DashboardData } from "@/lib/queries/assets";
import type { AlarmConfig } from "@/lib/queries/alarms";
import type { Site } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  glm: "GLM",
  openai: "OpenAI",
  anthropic: "Claude",
  fallback: "Rule-based (ไม่มี AI key)",
};

const INP =
  "w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan";

interface HistoryItem {
  id: number;
  type: string;
  period: string;
  site: string;
  at: string;
}

export function ReportsClient({
  data,
  sites,
  alarm,
  canSendEmail = false,
}: {
  data: DashboardData;
  sites: Site[];
  alarm: AlarmConfig;
  canSendEmail?: boolean;
}) {
  const [site, setSite] = useState("");
  const [period, setPeriod] = useState("ytd");
  const [type, setType] = useState<ReportConfig["type"]>("board");
  const [prepared, setPrepared] = useState("Senior Reliability Engineer");
  const [reviewed, setReviewed] = useState("Maintenance Manager");
  const [approved, setApproved] = useState("Plant Manager");
  const [generated, setGenerated] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [aiSource, setAiSource] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const config: ReportConfig = { type, period, site, prepared, reviewed, approved };

  function buildPrintUrl() {
    const p = new URLSearchParams();
    p.set("type", type);
    p.set("period", period);
    if (site) p.set("site", site);
    p.set("prepared", prepared);
    p.set("reviewed", reviewed);
    p.set("approved", approved);
    if (aiSummary) {
      p.set("summary", aiSummary);
      if (aiSource) p.set("summarySource", aiSource);
    }
    return `/print/report?${p.toString()}`;
  }

  async function genSummary() {
    setAiBusy(true);
    setEmailStatus(null);
    try {
      const res = await fetch("/api/ai/exec-summary", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "เกิดข้อผิดพลาด");
      setAiSummary(data.summary);
      setAiSource(data.source);
    } catch (e) {
      setEmailStatus({ ok: false, text: "เกิดข้อผิดพลาดในการสร้างสรุป" });
    } finally {
      setAiBusy(false);
    }
  }

  async function sendReportEmail() {
    if (emailBusy || !aiSummary.trim()) return;
    setEmailBusy(true);
    setEmailStatus(null);
    try {
      const res = await sendExecSummaryEmail({
        to: recipient,
        summary: aiSummary,
        source: aiSource ?? undefined,
      });
      setEmailStatus({ ok: res.ok, text: res.message });
    } finally {
      setEmailBusy(false);
    }
  }

  function generate() {
    setGenerated(true);
    setHistory((prev) => [
      { id: Date.now(), type, period, site: site || "ALL", at: formatThaiDateTime() },
      ...prev,
    ]);
  }

  return (
    <div className="fade space-y-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 font-sans text-[22px] max-sm:text-[18px] font-bold"><FileChartColumn className="h-4 w-4" aria-hidden />ระบบรายงานผู้บริหาร (Board-Level Reporting)</h2>
            <div className="text-[14px] text-t2">สร้างรายงานมืออาชีพ A4 — เปิดหน้าพิมพ์แล้ว Save as PDF</div>
          </div>
          {generated && (
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                // No noopener: the print page needs window.opener to know it was
                // opened as a real popup and may auto-print (embedded previews
                // fall back to same-tab + manual toolbar button).
                window.open(buildPrintUrl(), "_blank")
              }
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />เปิดหน้าพิมพ์ / Save as PDF
            </Button>
          )}
        </div>
      </Card>

      {/* AI Executive Summary */}
      <Card className="border-cyan/25">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Sparkles className="h-4 w-4" aria-hidden />AI สรุปรายงานอัตโนมัติ (Auto Executive Summary)</h2>
            <div className="text-[14px] text-t2">
              AI เขียนบทสรุปผู้บริหารจากข้อมูล KPI จริง — แก้ไขได้ แล้วส่งเข้า PDF หรืออีเมล
            </div>
          </div>
          <Button size="sm" variant="primary" onClick={genSummary} disabled={aiBusy}>
            {aiBusy ? <><GearSpinner className="h-3.5 w-3.5" />กำลังวิเคราะห์…</> : <><Sparkles className="h-3.5 w-3.5" aria-hidden />{aiSummary ? "สร้างใหม่" : "AI สรุปอัตโนมัติ"}</>}
          </Button>
        </div>

        {aiSummary && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-t3">บทสรุปจาก AI</span>
              {aiSource && (
                <span className="rounded-pill border border-cyan/30 bg-cyan/5 px-1.5 py-0.5 text-[14px] font-medium text-cyan">
                  {SOURCE_LABEL[aiSource] ?? aiSource}
                </span>
              )}
            </div>
            <textarea
              value={aiSummary}
              onChange={(e) => setAiSummary(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-border bg-bg2 px-2.5 py-2 text-[14px] leading-relaxed outline-none focus:border-cyan"
            />
            {canSendEmail ? (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <span className="mb-1 block text-[13px] font-bold text-t3">
                      ส่งอีเมลถึง (คั่นด้วย , หรือ ; สูงสุด 5 ราย)
                    </span>
                    <input
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="manager@company.com, engineer@company.com"
                      className="w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan"
                    />
                  </div>
                  <Button size="sm" variant="primary" onClick={sendReportEmail} disabled={emailBusy || !recipient.trim()}>
                    {emailBusy ? "กำลังส่ง…" : <><Mail className="h-3.5 w-3.5" aria-hidden />ส่งอีเมล</>}
                  </Button>
                </div>
                {emailStatus && (
                  <div className={`flex items-center gap-1.5 text-[14px] ${emailStatus.ok ? "text-green" : "text-yellow"}`}>
                    {emailStatus.ok ? <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                    <span className="text-t1">{emailStatus.text}</span>
                  </div>
                )}
                <div className="text-[13px] text-t3">
                  <Lightbulb className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />บทสรุปนี้จะถูกใช้ในรายงาน (Preview + หน้าพิมพ์) แทนย่อหน้าสรุปมาตรฐาน
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-[13px] text-t3"><Lock className="h-3.5 w-3.5" aria-hidden />ไม่มีสิทธิ์ส่งรายงานทางอีเมล</div>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[360px_1fr]">
        {/* Config */}
        <Card>
          <div className="space-y-2.5">
            <Field label="เลือกโรงงาน (Site)">
              <select value={site} onChange={(e) => setSite(e.target.value)} className={INP}>
                <option value="">ทุกโรงงาน (All Sites)</option>
                {sites.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
              </select>
            </Field>
            <Field label="ช่วงเวลารายงาน (Period)">
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className={INP}>
                <option value="monthly">รายเดือน</option>
                <option value="quarterly">รายไตรมาส</option>
                <option value="ytd">สะสมตั้งแต่ต้นปี (YTD)</option>
              </select>
            </Field>
            <Field label="ประเภทรายงาน (Report type)">
              <div className="space-y-1.5">
                {([
                  ["board", "Full Board Report", "รายงานฉบับสมบูรณ์ — ครบทุกส่วน", ChartColumn],
                  ["exec", "Executive Summary", "บทสรุปผู้บริหาร + KPI", TrendingUp],
                  ["tech", "Technical Deep-Dive", "เจาะลึก + Risk Concentration + Methodology", Settings],
                ] as const).map(([v, t, d, Icon]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setType(v)}
                    className={`w-full rounded-lg border p-2.5 text-left transition ${type === v ? "border-cyan bg-cyan/[0.07]" : "border-border bg-bg3 hover:border-cyan/30"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[14px] font-semibold"><Icon className="h-3.5 w-3.5" aria-hidden />{t}</div>
                    <div className="text-[14px] text-t2">{d}</div>
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-1 gap-2.5">
              <Field label="ผู้จัดทำ (Prepared by)"><input value={prepared} onChange={(e) => setPrepared(e.target.value)} className={INP} /></Field>
              <Field label="ผู้ทบทวน (Reviewed by)"><input value={reviewed} onChange={(e) => setReviewed(e.target.value)} className={INP} /></Field>
              <Field label="ผู้อนุมัติ (Approved by)"><input value={approved} onChange={(e) => setApproved(e.target.value)} className={INP} /></Field>
            </div>
            <Button variant="primary" onClick={generate} className="w-full justify-center py-2.5"><FileText className="h-3.5 w-3.5" aria-hidden />สร้างตัวอย่างรายงาน (Generate Preview)</Button>
          </div>
        </Card>

        {/* Preview */}
        <div className="min-w-0">
          {!generated ? (
            <Card>
              <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                <FileText className="mb-3 h-12 w-12 opacity-20" aria-hidden />
                <h2 className="font-sans text-[18px] max-sm:text-[16px] font-semibold">พร้อมสร้างรายงานมืออาชีพ</h2>
                <div className="mt-1.5 max-w-[260px] text-[14px] leading-relaxed text-t2">
                  กด &quot;สร้างตัวอย่างรายงาน&quot; เพื่อดูพรีวิว แล้วใช้ &quot;เปิดหน้าพิมพ์ / Save as PDF&quot; เพื่อบันทึกเป็น PDF
                </div>
              </div>
            </Card>
          ) : (
            <div className="overflow-auto">
              <ReportDoc
                data={data}
                alarm={alarm}
                config={config}
                execSummaryOverride={aiSummary || undefined}
                execSummarySource={aiSource ?? undefined}
              />
            </div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <Card>
          <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Clock className="h-4 w-4" aria-hidden />ประวัติการสร้างรายงาน (สำหรับ session นี้)</h2>
          <div className="space-y-1">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded border border-border bg-bg3 px-2.5 py-1.5 text-[14px]">
                <span><b>{h.type.toUpperCase()}</b> · {h.period} · {h.site}</span>
                <span className="text-t3">{h.at}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
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
