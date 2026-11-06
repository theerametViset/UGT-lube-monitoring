"use client";

import { useMemo, useState } from "react";
import { ChartColumn, CircleCheck, Clock, FileChartColumn, FileText, Mail, PenLine, Printer, RotateCcw, Settings, TrendingUp, TriangleAlert } from "lucide-react";
import { Card, Button } from "@/components/ui/primitives";
import { REPORT_EDITS_KEY, ReportDoc, type ReportConfig } from "@/components/reports/ReportDoc";
import { logReportEdits, sendReportEmail } from "@/lib/actions/reports";
import { reportSlots, reportTexts, scopeReport, type ReportEdits } from "@/lib/exec-summary-text";
import { formatThaiDateTime } from "@/lib/format";
import type { DashboardData } from "@/lib/queries/assets";
import type { AlarmConfig } from "@/lib/queries/alarms";
import type { Site } from "@/lib/types";
import type { ActionReason } from "@/lib/scoring/advice";

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
  reasons,
  canSendEmail = false,
  canEdit = false,
}: {
  data: DashboardData;
  sites: Site[];
  alarm: AlarmConfig;
  reasons: Record<string, ActionReason>;
  canSendEmail?: boolean;
  /** reports:edit — may reword the narrative (numbers stay locked). */
  canEdit?: boolean;
}) {
  const [site, setSite] = useState("");
  const period = "ytd"; // no period filter yet: reports show the latest state (kept for print-link compatibility)
  const [type, setType] = useState<ReportConfig["type"]>("board");
  const [prepared, setPrepared] = useState("Reliability Engineer");
  const [reviewed, setReviewed] = useState("Maintenance Manager");
  const [approved, setApproved] = useState("Plant Manager");
  const [generated, setGenerated] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [note, setNote] = useState("");
  const [edits, setEdits] = useState<ReportEdits>({});
  const [editOpen, setEditOpen] = useState(false);
  // the generated text of every editable part, for the panel's starting values
  const slots = useMemo(() => reportSlots(reportTexts(scopeReport(data, site), site, reasons)), [data, site, reasons]);
  const editCount = slots.filter((s) => edits[s.key]?.trim()).length;
  const [emailOpen, setEmailOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const config: ReportConfig = { type, period, site, prepared, reviewed, approved, note };

  function buildPrintUrl() {
    const p = new URLSearchParams();
    p.set("type", type);
    p.set("period", period);
    if (site) p.set("site", site);
    p.set("prepared", prepared);
    p.set("reviewed", reviewed);
    p.set("approved", approved);
    if (note.trim()) p.set("note", note.trim());
    return `/print/report?${p.toString()}`;
  }

  async function sendEmail() {
    if (emailBusy) return;
    setEmailBusy(true);
    setEmailStatus(null);
    try {
      // the server rebuilds the summary for this plant and report type
      const res = await sendReportEmail({ to: recipient, site, type, note, edits: canEdit ? edits : undefined });
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
            <h2 className="page-title flex items-center gap-2.5 font-sans text-[22px] max-sm:text-[18px] font-bold"><FileChartColumn className="h-4 w-4" aria-hidden />ระบบรายงานผู้บริหาร (Board-Level Reporting)</h2>
            <div className="text-[14px] text-t2">สร้างรายงานมืออาชีพ A4 — เปิดหน้าพิมพ์แล้ว Save as PDF</div>
          </div>
          {generated && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  // the print tab reads the edits from here (too long for the URL)
                  try {
                    localStorage.setItem(REPORT_EDITS_KEY, JSON.stringify({ site, type, edits: canEdit ? edits : {}, at: Date.now() }));
                  } catch {
                    // storage blocked: the print shows the generated text
                  }
                  if (canEdit && editCount) void logReportEdits({ site, type, edits });
                  // No noopener: the print page needs window.opener to know it was
                  // opened as a real popup and may auto-print (embedded previews
                  // fall back to same-tab + manual toolbar button).
                  window.open(buildPrintUrl(), "_blank");
                }}
              >
                <Printer className="h-3.5 w-3.5" aria-hidden />เปิดหน้าพิมพ์ / Save as PDF
              </Button>
              {canSendEmail && (
                <Button size="sm" onClick={() => setEmailOpen((o) => !o)} aria-expanded={emailOpen}>
                  <Mail className="h-3.5 w-3.5" aria-hidden />ส่งอีเมล
                </Button>
              )}
            </div>
          )}
        </div>
        {generated && canSendEmail && emailOpen && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[220px] flex-1">
                <span className="mb-1 block text-[13px] font-bold text-t3">ส่งถึง (คั่นด้วย , หรือ ; สูงสุด 5 ราย)</span>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="manager@company.com, engineer@company.com"
                  className={INP}
                />
              </label>
              <Button size="sm" variant="primary" onClick={sendEmail} disabled={emailBusy || !recipient.trim()}>
                {emailBusy ? "กำลังส่ง…" : <><Mail className="h-3.5 w-3.5" aria-hidden />ส่ง</>}
              </Button>
            </div>
            <div className="text-[13px] text-t3">
              ส่งบทสรุปของรายงานนี้ ({site ? `โรงงาน ${site}` : "ทุกโรงงาน"}) พร้อมผลการประเมินและหมายเหตุ ถ้าต้องการไฟล์ PDF ให้แนบจากหน้าพิมพ์
            </div>
            {emailStatus && (
              <div className={`flex items-center gap-1.5 text-[14px] ${emailStatus.ok ? "text-green" : "text-yellow"}`}>
                {emailStatus.ok ? <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                <span className="text-t1">{emailStatus.text}</span>
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
        {/* Config */}
        <Card>
          <div className="space-y-2.5">
            <Field label="เลือกโรงงาน (Site)">
              <select value={site} onChange={(e) => { setSite(e.target.value); setEdits({}); }} className={INP}>
                <option value="">ทุกโรงงาน (All Sites)</option>
                {sites.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
              </select>
            </Field>
            <Field label="ประเภทรายงาน (Report type)">
              <div className="space-y-1.5">
                {([
                  ["exec", "Executive Summary", "ผู้บริหาร — ผลการประเมิน, บทสรุป, KPI, เปรียบเทียบรายโรงงาน", TrendingUp],
                  ["board", "Plant Report", "ผู้จัดการโรงงาน — เทียบรายโรงงาน, ประเภทเครื่อง, เครื่องต้องดำเนินการพร้อมสาเหตุ", ChartColumn],
                  ["tech", "Oil Analysis Technical Report", "วิศวกร — ค่าที่วัดได้เทียบเกณฑ์รายเครื่อง, สิ่งที่ควรทำ, เกณฑ์ให้คะแนน", Settings],
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
            <Field label="หมายเหตุผู้จัดทำ (ไม่บังคับ)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={2}
                placeholder="เช่น TSL หยุดซ่อมบำรุงสัปดาห์หน้า"
                className={INP}
              />
            </Field>
            <Button variant="primary" onClick={generate} className="w-full justify-center py-2.5"><FileText className="h-3.5 w-3.5" aria-hidden />สร้างตัวอย่างรายงาน (Generate Preview)</Button>
          </div>
        </Card>

        {/* Reword the narrative: numbers, verdict and tables are not slots, so they stay locked */}
        {generated && canEdit && (
          <Card>
            <button
              type="button"
              onClick={() => setEditOpen((o) => !o)}
              aria-expanded={editOpen}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="flex items-center gap-1.5 text-[15px] font-semibold"><PenLine className="h-4 w-4" aria-hidden />แก้ไขข้อความรายงาน</span>
              <span className="text-[13px] text-t3">{editCount ? `แก้ไขแล้ว ${editCount} จุด` : "ยังไม่แก้"} {editOpen ? "▴" : "▾"}</span>
            </button>
            {editOpen && (
              <div className="mt-3 space-y-3">
                <div className="text-[13px] text-t3">
                  แก้ได้เฉพาะข้อความ ตัวเลข ผลการประเมิน และตารางล็อกไว้ ข้อความที่แก้ใช้ทั้งในพรีวิว หน้าพิมพ์ และอีเมล และบันทึกใน Audit
                </div>
                {slots.map((slot) => {
                  const changed = !!edits[slot.key]?.trim();
                  return (
                    <label key={slot.key} className="block">
                      <span className="mb-1 flex items-center justify-between gap-2 text-[13px] font-bold text-t3">
                        <span>{slot.label}</span>
                        {changed && (
                          <span className="flex items-center gap-1.5">
                            <span className="rounded-pill bg-cyan/10 px-1.5 text-[12px] font-semibold text-cyan">แก้ไขแล้ว</span>
                            <button
                              type="button"
                              onClick={() => setEdits(({ [slot.key]: _, ...rest }) => rest)}
                              className="flex items-center gap-0.5 text-[12px] font-medium text-t3 hover:text-cyan"
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden />คืนค่า
                            </button>
                          </span>
                        )}
                      </span>
                      <textarea
                        value={edits[slot.key] ?? slot.text}
                        onChange={(e) =>
                          setEdits((prev) => {
                            const v = e.target.value.slice(0, 1000);
                            const { [slot.key]: _, ...rest } = prev;
                            // typing the generated text back counts as no edit
                            return v.trim() === slot.text ? rest : { ...rest, [slot.key]: v };
                          })
                        }
                        rows={slot.text.length > 90 ? 3 : 2}
                        className={INP}
                      />
                    </label>
                  );
                })}
                {editCount > 0 && (
                  <Button size="sm" onClick={() => setEdits({})}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />คืนค่าข้อความระบบทั้งหมด
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}
        </div>

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
                reasons={reasons}
                edits={canEdit ? edits : {}}
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
