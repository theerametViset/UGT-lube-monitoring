"use client";

import { useEffect, useRef, useState } from "react";
import { execVerdict, reportDate, reportNumber, reportTexts, scopeReport, type ReportEdits } from "@/lib/exec-summary-text";
import type { ActionReason } from "@/lib/scoring/advice";
import { formatNumber } from "@/lib/utils";
import { exportElementToPdf } from "@/lib/pdf-export";
import { viscCriteriaText } from "@/lib/viscosity-limits";
import type { DashboardData } from "@/lib/queries/assets";
import type { AlarmConfig } from "@/lib/queries/alarms";
import { readableText } from "@/lib/color";

export interface ReportConfig {
  type: "exec" | "tech" | "board";
  period: string;
  site: string;
  prepared: string;
  reviewed: string;
  approved: string;
  /** Preparer's note, shown under the summary (and in the email). */
  note?: string;
}

/** localStorage key the Reports page uses to hand its text edits to the print tab. */
export const REPORT_EDITS_KEY = "ugt-report-edits";

// one report per reader: "board" is the plant manager's report (key kept for old print links)
const TYPE_LABEL: Record<string, string> = {
  exec: "Executive Summary",
  board: "Plant Report",
  tech: "Oil Analysis Technical Report",
};

function Section({
  no,
  title,
  children,
}: {
  no: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rp-section mb-3">
      <div className="mb-2 flex items-center gap-2 border-b-2 border-cyan pb-1">
        <span className="font-mono text-[11px] font-bold text-cyan">{no}</span>
        <h2 className="font-sans text-[13px] font-bold tracking-tight text-t1">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// one look for every report table: same header row, numbers right-aligned in fixed columns, a 0 greyed out
const TH_ROW = "border-b border-border bg-black/[0.03] text-[8px] font-semibold uppercase tracking-wide text-t3";
function Num({ v, color, bold }: { v: number; color?: string; bold?: boolean }) {
  return (
    <td
      className={`py-1.5 pr-2 text-right tabular-nums ${bold ? "font-semibold" : ""}`}
      style={{ color: v === 0 ? "#9ca3af" : color ? readableText(color) : undefined }}
    >
      {formatNumber(v)}
    </td>
  );
}

function MethodologyTable({ params, scoreConfig }: { params: AlarmConfig["params"]; scoreConfig: AlarmConfig["scoreConfig"] }) {
  const visc = viscCriteriaText();
  return (
    <table className="w-full border-collapse text-left text-[9.5px]">
      <thead>
        <tr className="border-b border-black/10 text-[8px] uppercase text-t3">
          <th className="py-1 font-semibold">Parameter</th>
          <th className="py-1 text-right font-semibold">Warning</th>
          <th className="py-1 text-right font-semibold">Critical</th>
          <th className="py-1 text-right font-semibold">หัก (W)</th>
          <th className="py-1 text-right font-semibold">หัก (C)</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p) => (
          <tr key={p.id} className="border-b border-black/5">
            <td className="py-1">{p.name}</td>
            <td className="py-1 text-right font-mono text-yellow">{p.key === "visc" ? visc.warn : `> ${p.warn_limit}`}</td>
            <td className="py-1 text-right font-mono text-red">{p.key === "visc" ? visc.crit : `> ${p.crit_limit}`}</td>
            <td className="py-1 text-right font-mono text-yellow">−{p.warn_penalty ?? scoreConfig.warn_penalty}</td>
            <td className="py-1 text-right font-mono text-red">−{p.crit_penalty ?? scoreConfig.crit_penalty}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ReportDoc({
  data,
  alarm,
  config,
  reasons = {},
  edits: editsProp,
  autoPrint = false,
  showToolbar = false,
}: {
  data: DashboardData;
  alarm: AlarmConfig;
  config: ReportConfig;
  /** Cause + action per critical machine (server, getActionReasons). */
  reasons?: Record<string, ActionReason>;
  /** Reworded narrative (ReportsClient's edit panel); the print page reads it from localStorage. */
  edits?: ReportEdits;
  autoPrint?: boolean;
  /** Show the on-screen print toolbar (only on the print route, not inline preview). */
  showToolbar?: boolean;
}) {
  const isExec = config.type === "exec";
  const isTech = config.type === "tech";
  let sec = 0;
  const no = () => String(++sec); // sections differ per report type, so number them as they render
  // every section below (except the plant comparison table) speaks about the chosen plant only
  const d = scopeReport(data, config.site);
  const scoped = d.kpis;
  const sites = d.siteReliability;
  const scopeLabel = config.site ? `โรงงาน ${config.site}` : "ทุกโรงงาน";
  // from the counts, not the average: one critical machine among hundreds still needs action
  const v = execVerdict(scoped, sites);
  const verdictColor = { crit: "#ef4444", warn: "#f59e0b", ok: "#22c55e" }[v.tone];
  // technical report lists every type; the others list only the types with a problem
  const riskTypes = isTech ? d.perType : d.perType.filter((t) => t.critical + t.warning > 0);
  const okTypes = isTech ? [] : d.perType.filter((t) => t.critical + t.warning === 0);

  // the print tab gets the edits the Reports page stored just before opening it
  const [storedEdits, setStoredEdits] = useState<ReportEdits>({});
  useEffect(() => {
    if (!showToolbar) return;
    try {
      const saved = JSON.parse(localStorage.getItem(REPORT_EDITS_KEY) ?? "null");
      const fresh = Date.now() - (saved?.at ?? 0) < 60 * 60 * 1000; // an old bookmark must not pick up last week's wording
      if (fresh && saved?.site === config.site && saved?.type === config.type && saved.edits) setStoredEdits(saved.edits);
    } catch {
      // no stored edits: print the generated text
    }
  }, [showToolbar, config.site, config.type]);
  const edits = editsProp ?? storedEdits;
  const t = reportTexts(d, config.site, reasons, edits);
  const edited = Object.keys(edits).length > 0;

  const [hasOpener, setHasOpener] = useState(false);
  useEffect(() => {
    setHasOpener(!!window.opener);
  }, []);

  useEffect(() => {
    // Auto-print ONLY when opened as a real popup (window.open without noopener).
    // Same-tab navigation (embedded previews) has no opener — auto window.print()
    // there can block the tab with an undismissable native dialog, so fall back
    // to the manual toolbar button instead.
    if (!autoPrint || !window.opener) return;
    const t = setTimeout(() => {
      window.print();
      window.onafterprint = () => window.close();
    }, 600);
    return () => clearTimeout(t);
  }, [autoPrint]);

  const [reportNo, setReportNo] = useState("");
  // shortcut: the report shows the latest state, so "data as of" is today; add a period filter before restoring a period choice
  const [dataAsOf, setDataAsOf] = useState("");
  useEffect(() => {
    const now = new Date();
    setDataAsOf(reportDate(now));
    setReportNo(reportNumber(config.site, config.type, now));
  }, [config.site, config.type]);

  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  async function onDownloadPdf() {
    if (!docRef.current) return;
    setDownloading(true);
    try {
      await exportElementToPdf(docRef.current, `report-${config.type}-${config.period}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="report-doc mx-auto bg-white text-t1" style={{ maxWidth: "210mm" }}>
      {/* On-screen print toolbar — hidden when printed (print:hidden) */}
      {showToolbar && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 shadow-sm print:hidden">
          <div className="text-[10.5px] text-t2">
            🖨 หน้าพิมพ์พร้อมแล้ว
            {!hasOpener && " — เปิดจากปุ่มในหน้าแอปเพื่อให้พิมพ์อัตโนมัติ หรือกดปุ่มด้านขวา"}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={downloading}
              className="rounded-pill border border-cyan/40 bg-cyan px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-cyan-focus disabled:opacity-50"
            >
              {downloading ? "กำลังสร้าง PDF…" : "⬇️ ดาวน์โหลด PDF"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-pill border border-cyan/40 bg-cyan/5 px-3 py-1 text-[11px] font-semibold text-cyan transition hover:bg-cyan/10"
            >
              🖨 พิมพ์ / Save as PDF
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-pill border border-border/70 bg-bg2 px-3 py-1 text-[11px] text-t3 transition hover:border-cyan/40 hover:text-cyan"
            >
              ← กลับ
            </button>
          </div>
        </div>
      )}

      <div ref={docRef} className="p-8 print:p-0">
      {/* Cover: white with a thin accent bar — prints cleanly, no ink-heavy block */}
      <header className="mb-5 border-b-2 border-cyan pb-3">
        <div className="flex items-center justify-between border-l-4 border-cyan pl-2.5">
          <div>
            <div className="text-[11px] font-extrabold tracking-tight text-t1">UGT RELIABILITY · Lube Monitoring</div>
            <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-t3">Condition Monitoring & Reliability</div>
          </div>
          <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-t3">Confidential</div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-t1">{TYPE_LABEL[config.type] ?? "Reliability Report"}</h1>
            <div className="mt-0.5 text-[10.5px] text-t2">รายงานวิเคราะห์สภาพน้ำมันหล่อลื่น</div>
          </div>
          <table className="shrink-0 text-[9px]">
            <tbody>
              {[
                ["ขอบเขต", `${scopeLabel} · ${formatNumber(scoped.total)} เครื่อง`],
                ["ข้อมูล ณ", dataAsOf],
                ["เลขที่รายงาน", reportNo],
              ].map(([k, val]) => (
                <tr key={k}>
                  <td className="py-px pr-3 text-t3">{k}</td>
                  <td className="py-px font-semibold text-t1">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </header>

      {/* 2. Executive Summary */}
      <Section no={no()} title="บทสรุปผู้บริหาร (Executive Summary)">
        {/* the verdict first and the only coloured block on the page; the cards below carry just a side line */}
        <div
          className="mb-2.5 rounded border px-3 py-2 text-[11px]"
          style={{ borderColor: verdictColor + "55", background: verdictColor + "12", color: readableText(verdictColor) }}
        >
          <b>ผลการประเมิน ({scopeLabel}): {v.label}</b> · {v.detail}
        </div>
          {/* same content as the emailed summary (lib/ai/exec-summary.ts), laid out for reading */}
          <div className="space-y-2 text-[10.5px] leading-relaxed text-t2">
            <p className="text-[12px] font-bold text-t1">{t.headline}</p>
            {t.critical.map(({ asset: a, what, act }) => {
              return (
                <div key={a.id} className="border-l-[3px] border-red py-0.5 pl-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-bold text-t1">{a.name}</span>
                    <span className="font-mono text-[8.5px] text-t3"><span className="text-cyan">{a.id}</span> · {a.site}</span>
                    <span className="ml-auto font-mono text-[9px] font-bold" style={{ color: readableText("#ef4444") }}>Health {a.health}</span>
                  </div>
                  <div className="mt-0.5"><span className="font-semibold text-t1">ปัญหาที่พบ: </span>{what}</div>
                  <div><span className="font-semibold text-t1">สิ่งที่ควรทำ: </span>{act}</div>
                </div>
              );
            })}
            {t.more && <p className="text-t3">{t.more}</p>}
            {t.warning && (
              <div className="border-l-[3px] border-yellow py-0.5 pl-2.5">{t.warning}</div>
            )}
            {config.note?.trim() && (
              <p className="italic text-t2">
                <span className="font-semibold not-italic text-t1">หมายเหตุผู้จัดทำ: </span>
                {config.note.trim()}
              </p>
            )}
          </div>
      </Section>

      {/* 3. Fleet Health Overview */}
      <Section no={no()} title="ภาพรวมสุขภาพเครื่องจักร (Health Overview)">
        <div className="grid grid-cols-4 gap-2">
          {[
            ["สินทรัพย์รวม", scoped.total, "#0066cc"],
            ["วิกฤต", scoped.critical, "#ef4444"],
            ["เฝ้าระวัง", scoped.warning, "#f59e0b"],
            ["ปกติ", scoped.healthy, "#22c55e"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="rounded border border-border p-2 text-center">
              <div className="text-[8px] uppercase tracking-wide text-t3">{l}</div>
              <div className="font-sans text-[20px] font-bold leading-none" style={{ color: readableText(c as string) }}>
                {formatNumber(v as number)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 text-[10px] text-t2">
          Health Score เฉลี่ย: <b className="text-cyan">{scoped.avgHealth}</b>
          {"  ·  ขอบเขต: "}
          {scopeLabel}
        </div>
      </Section>

      {/* Plant comparison — executive + plant reports */}
      {!isTech && (
      <Section no={no()} title={config.site && !isExec ? `ข้อมูลโรงงาน ${config.site} (Site Summary)` : "เปรียบเทียบรายโรงงาน (Site Comparison)"}>
        <table className="w-full table-fixed border-collapse text-left text-[10px]">
          <colgroup><col /><col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[15%]" /></colgroup>
          <thead>
            <tr className={TH_ROW}>
              <th scope="col" className="py-1.5 pl-2">Site</th>
              <th scope="col" className="py-1.5 pr-2 text-right">Critical</th>
              <th scope="col" className="py-1.5 pr-2 text-right">Warning</th>
              <th scope="col" className="py-1.5 pr-2 text-right">Healthy</th>
              <th scope="col" className="py-1.5 pr-2 text-right">Total</th>
              <th scope="col" className="py-1.5 pr-2 text-right">Avg Health</th>
            </tr>
          </thead>
          <tbody>
            {/* plant report on one plant: that plant only; executive keeps the comparison */}
            {(config.site && !isExec ? sites : data.perSite).map((s) => (
              <tr
                key={s.code}
                className="rp-row border-b border-black/5"
                style={config.site === s.code ? { background: "#0066cc0d" } : undefined}
              >
                <td className="py-1.5 pl-2 font-semibold text-t1">{s.code}</td>
                <Num v={s.critical} color="#ef4444" bold />
                <Num v={s.warning} color="#eab308" bold />
                <Num v={s.healthy} />
                <Num v={s.total} />
                <td className="py-1.5 pr-2 text-right tabular-nums">{s.avgHealth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      )}

      {/* 5. Risk Concentration by Equipment Type (Tech/Full) */}
      {!isExec && d.perType.length > 0 && (
        <Section no={no()} title="ความเสี่ยงแยกตามประเภทเครื่องจักร (Risk Concentration)">
          {/* only the types with a problem; the healthy rest is one line, not dozens of 0 / 0 rows */}
          {riskTypes.length === 0 ? (
            <div className="py-2 text-[10.5px] text-green">ทุกประเภทเครื่องจักรอยู่ในเกณฑ์ปกติ</div>
          ) : (
            <table className="w-full table-fixed border-collapse text-left text-[10px]">
              <colgroup><col /><col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[15%]" /></colgroup>
              <thead>
                <tr className={TH_ROW}>
                  <th scope="col" className="py-1.5 pl-2">ประเภทเครื่องจักร</th>
                  <th scope="col" className="py-1.5 pr-2 text-right">Critical</th>
                  <th scope="col" className="py-1.5 pr-2 text-right">Warning</th>
                  <th scope="col" className="py-1.5 pr-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {riskTypes.map((t) => (
                  <tr key={t.type} className="rp-row border-b border-black/5">
                    <td className="py-1.5 pl-2 text-t1">
                      <span className="inline-block w-6 font-semibold">{t.abbr}</span>{t.type}
                    </td>
                    <Num v={t.critical} color="#ef4444" bold />
                    <Num v={t.warning} color="#eab308" bold />
                    <Num v={t.total} />
                  </tr>
                ))}
                {okTypes.length > 0 && (
                  <tr className="rp-row border-b border-black/5">
                    <td colSpan={4} className="py-1.5 pl-2 text-t3">
                      อีก {okTypes.length} ประเภท ({formatNumber(okTypes.reduce((n, t) => n + t.total, 0))} เครื่อง) อยู่ในเกณฑ์ปกติ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {/* Machines needing action — exec: critical names · plant: with cause · tech: every reading over its limit */}
      {isTech ? (
        <Section no={no()} title="ผลวิเคราะห์รายเครื่อง (Findings per Machine — ค่าที่วัดได้เทียบเกณฑ์)">
          {d.topCritical.length === 0 ? (
            <div className="py-2 text-[10.5px] text-green">ไม่มีเครื่องจักรในสถานะ Warning หรือ Critical ในขอบเขตนี้</div>
          ) : (
            // per machine: header, the readings over their limits, then one plan box (same action listed once)
            <div className="space-y-3">
              {d.topCritical.map((a) => {
                const adv = reasons[a.id]?.advice ?? [];
                const c = a.status === "Critical" ? "#ef4444" : "#eab308";
                const plan = [...new Set(adv.map((x) => x.action))];
                return (
                  <div key={a.id} className="rp-row border-l-[3px] pl-2.5" style={{ borderColor: c }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10.5px] font-bold text-t1">{a.name}</span>
                      <span className="font-mono text-[8.5px] text-t3">{a.id} · {a.site}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <span className="whitespace-nowrap rounded px-1.5 py-px text-[8px] font-semibold" style={{ color: readableText(c), background: c + "1a" }}>
                          {a.status}
                        </span>
                        <span className="text-[9px] text-t3">Health</span>
                        <span className="w-5 text-right text-[11px] font-bold tabular-nums" style={{ color: readableText(c) }}>{a.health}</span>
                      </span>
                    </div>
                    {adv.length === 0 ? (
                      <div className="mt-1 text-[9.5px] text-t3">ไม่มีรายละเอียดค่าที่เกินเกณฑ์ ตรวจสอบผลแล็บล่าสุดในหน้ารายละเอียดเครื่อง</div>
                    ) : (
                      <>
                        <table className="mt-1 w-full table-fixed border-collapse text-left text-[9.5px]">
                          <colgroup><col className="w-[40%]" /><col className="w-[22%]" /><col /></colgroup>
                          <thead>
                            <tr className={TH_ROW}>
                              <th scope="col" className="py-1 pl-2">ค่าที่วัดได้</th>
                              <th scope="col" className="py-1">เกณฑ์</th>
                              <th scope="col" className="py-1 pr-2">ระดับ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adv.map((x) => (
                              <tr key={x.label} className="border-b border-black/5">
                                <td className="py-1 pl-2 text-t1">{x.label}</td>
                                <td className="py-1 tabular-nums text-t2">{x.limit?.replace(/^เกณฑ์\s*/, "") ?? "—"}</td>
                                <td className="py-1 pr-2 font-semibold" style={{ color: readableText(x.level === "crit" ? "#ef4444" : "#eab308") }}>
                                  {x.badge}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-1.5 rounded border border-black/10 bg-black/[0.02] px-2.5 py-1.5 text-[9.5px] leading-snug">
                          <div className="mb-0.5 text-[8px] font-semibold uppercase tracking-wide text-t3">แผนดำเนินการ</div>
                          <ul className="list-disc space-y-0.5 pl-4 text-t2">
                            {plan.map((p) => <li key={p}>{p}</li>)}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      ) : (
        // executive report: none — the summary's machine cards already cover it
        !isExec && (
        <Section no={no()} title="เครื่องจักรที่ต้องดำเนินการ (Warning & Critical — เรียงตามคะแนนสุขภาพ)">
          {d.topCritical.length === 0 ? (
            <div className="py-2 text-[10.5px] text-green">ไม่มีเครื่องจักรในสถานะ Warning หรือ Critical ในขอบเขตนี้</div>
          ) : (
            <table className="w-full table-fixed border-collapse text-left text-[10px]">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[33%]" />
                <col />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className={TH_ROW}>
                  <th scope="col" className="py-1.5 pl-2">#</th>
                  <th scope="col" className="py-1.5">เครื่องจักร</th>
                  <th scope="col" className="py-1.5">สาเหตุ (ค่าที่เกินเกณฑ์)</th>
                  <th scope="col" className="py-1.5 pr-2 text-right">สถานะ</th>
                  <th scope="col" className="py-1.5 pr-2 text-right">Health</th>
                </tr>
              </thead>
              <tbody>
                {d.topCritical.map((a, i) => {
                  const c = a.status === "Critical" ? "#ef4444" : "#eab308";
                  const adv = reasons[a.id]?.advice ?? [];
                  return (
                    <tr key={a.id} className="rp-row border-b border-black/5 align-top">
                      <td className="py-1.5 pl-2 tabular-nums text-t3">{i + 1}</td>
                      <td className="py-1.5 pr-2">
                        <div className="font-semibold text-t1">{a.name}</div>
                        <div className="whitespace-nowrap font-mono text-[8.5px] text-t3">{a.id} · {a.site}</div>
                      </td>
                        <td className="py-1.5 pr-2 text-[9px] leading-snug text-t2">
                          {adv.length === 0
                            ? "—"
                            : adv.map((x) => (
                                <div key={x.label}>
                                  {x.label}{" "}
                                  <span className="font-semibold" style={{ color: readableText(x.level === "crit" ? "#ef4444" : "#eab308") }}>
                                    ({x.badge})
                                  </span>
                                </div>
                              ))}
                        </td>
                      <td className="py-1.5 pr-2 text-right">
                        <span
                          className="inline-block whitespace-nowrap rounded px-1.5 py-px text-[8px] font-semibold"
                          style={{ color: readableText(c), background: c + "1a" }}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right text-[11px] font-bold tabular-nums" style={{ color: readableText(c) }}>
                        {a.health}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Section>
        )
      )}

      {/* 7. Scoring Methodology (Tech/Full) */}
      {isTech && (
        <Section no={no()} title="ระเบียบวิธีและเกณฑ์การให้คะแนน (Scoring Methodology)">
          {/* oil only: this program scores lubricant condition, vibration is not part of the report */}
          <div className="mb-1.5 text-[10px] text-t2">
            Health Score หักคะแนนตามค่าที่เกินเกณฑ์: เกิน Warning หักตามช่อง หัก (W) · เกิน Critical หักตามช่อง หัก (C) ของแต่ละพารามิเตอร์
          </div>
          <div className="mb-1 text-[8.5px] font-bold uppercase text-yellow">Oil Analysis</div>
          <MethodologyTable params={alarm.params.filter((p) => p.category === "oil")} scoreConfig={alarm.scoreConfig} />
          {alarm.params.some((p) => p.key === "visc") && (
            <div className="mt-1 text-[8.5px] text-t3">Viscosity ใช้เกณฑ์ตามเกรด ISO VG ของแต่ละเครื่อง (ISO 3448) ทั้งด้านสูงและต่ำ</div>
          )}
        </Section>
      )}

      {/* 8+9. Recommendations + Signatures — อยู่ด้วยกัน ไม่แยกหน้า */}
      <div className="rp-section">
        <Section no={no()} title="ข้อเสนอแนะ (Recommendations)">
          <ul className="list-disc space-y-1 pl-5 text-[10.5px] leading-relaxed text-t2">
            {t.recs.map((r) => (
              <li key={r.tag}>
                <b className="text-t1">[{r.tag}]</b> {r.text}
              </li>
            ))}
          </ul>
        </Section>

        <Section no={no()} title="การลงนาม (Signatures)">
          <div className="grid grid-cols-3 gap-5 pt-3">
            {[
              ["ผู้จัดทำ (Prepared)", config.prepared],
              ["ผู้ทบทวน (Reviewed)", config.reviewed],
              ["ผู้อนุมัติ (Approved)", config.approved],
            ].map(([l, n]) => (
              <div key={l} className="text-center">
                <div className="mx-auto mb-1 h-8 border-b border-black/40" />
                <div className="text-[8px] uppercase tracking-wide text-t3">{l}</div>
                <div className="text-[10px] font-semibold text-t1">{n}</div>
                <div className="text-[8.5px] text-t3">วันที่: …………………</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Footer */}
      <footer className="mt-3 border-t border-border pt-2 text-[8.5px] leading-relaxed text-t3">
        {/* page numbers come from @page in globals.css when printed */}
        <div>
          UGT Reliability Lube Monitoring · {reportNo}
          {edited && " · ข้อความบางส่วนแก้ไขโดยผู้จัดทำ"}
        </div>
      </footer>
      </div>
    </div>
  );
}
