"use client";

import { useEffect, useRef, useState } from "react";
import { SiteReliabilityChart } from "@/components/charts/SiteReliabilityChart";
import { formatNumber } from "@/lib/utils";
import { formatThaiDateTime } from "@/lib/format";
import { exportElementToPdf } from "@/lib/pdf-export";
import { viscCriteriaText } from "@/lib/viscosity-limits";
import type { DashboardData } from "@/lib/queries/assets";
import type { AlarmConfig } from "@/lib/queries/alarms";
import { readableText } from "@/lib/color";
import { healthColor, statusFromHealth } from "@/lib/scoring/health";

export interface ReportConfig {
  type: "exec" | "tech" | "board";
  period: string;
  site: string;
  prepared: string;
  reviewed: string;
  approved: string;
}

const PERIOD_LABEL: Record<string, string> = {
  monthly: "รายเดือน — กรกฎาคม 2026",
  quarterly: "รายไตรมาส — Q3/2026",
  ytd: "สะสมตั้งแต่ต้นปี (YTD 2026)",
};
const TYPE_LABEL: Record<string, string> = {
  exec: "Executive Summary",
  tech: "Technical Deep-Dive Report",
  board: "Full Board Report",
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
            <td className="py-1 text-right font-mono text-yellow">{p.key === "visc" ? visc.warn : `≥ ${p.warn_limit}`}</td>
            <td className="py-1 text-right font-mono text-red">{p.key === "visc" ? visc.crit : `≥ ${p.crit_limit}`}</td>
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
  autoPrint = false,
  execSummaryOverride,
  execSummarySource,
  showToolbar = false,
}: {
  data: DashboardData;
  alarm: AlarmConfig;
  config: ReportConfig;
  autoPrint?: boolean;
  /** AI-written executive summary (replaces the static rule-based paragraph). */
  execSummaryOverride?: string;
  execSummarySource?: string;
  /** Show the on-screen print toolbar (only on the print route, not inline preview). */
  showToolbar?: boolean;
}) {
  const isExec = config.type === "exec";
  const scoped = config.site
    ? data.perSite.find((p) => p.code === config.site) ?? data.kpis
    : data.kpis;
  const verdict = { Healthy: "Stable (ปกติ)", Warning: "At Risk (เฝ้าระวัง)", Critical: "Critical (วิกฤต)" }[statusFromHealth(data.kpis.avgHealth)];
  const verdictColor = healthColor(data.kpis.avgHealth);

  // rule-based recommendations (derived from real data)
  const recs: string[] = [];
  if (data.kpis.critical > 0)
    recs.push(
      `เร่งดำเนินการ Corrective Action สำหรับเครื่องจักรสถานะวิกฤต ${data.kpis.critical} เครื่องภายใน 2 สัปดาห์ เพื่อลดความเสี่ยงการหยุดผลิตฉุกเฉิน`,
    );
  if (data.kpis.avgHealth < 80)
    recs.push(
      `คะแนนสุขภาพเฉลี่ย ${data.kpis.avgHealth}% อยู่ในระดับเฝ้าระวัง — ควรเร่งตรวจสอบเครื่องจักรที่เสื่อมสภาพและทบทวนรอบการเก็บตัวอย่าง`,
    );
  const worst = [...data.perSite]
    .filter((s) => s.total > 0)
    .sort((a, b) => a.avgHealth - b.avgHealth)[0];
  if (worst)
    recs.push(
      `โรงงาน ${worst.code} มีคะแนนสุขภาพเฉลี่ยต่ำสุด ${worst.avgHealth}% — พิจารณาเพิ่มทรัพยากรตรวจสอบและลดภาระงาน CM`,
    );
  const wType = data.perType.find((t) => t.critical > 0);
  if (wType)
    recs.push(
      `ประเภท ${wType.type} มีความเสี่ยงสูงสุด (${wType.critical} วิกฤต) — ตรวจสอบรอบการหล่อลื่นและสภาพแบริ่งอย่างใกล้ชิด`,
    );
  recs.push(
    "รักษาการเก็บตัวอย่าง Oil Analysis ทุก 3 เดือน และ Vibration Survey ตาม ISO 10816-3 อย่างสม่ำเสมอ เพื่อรักษาเสถียรภาพของ Health Score",
  );

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

  const [generatedAt, setGeneratedAt] = useState("");
  useEffect(() => {
    setGeneratedAt(formatThaiDateTime());
  }, []);

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

      <div ref={docRef} className="p-8">
      {/* 1. Cover band */}
      <header className="mb-5 overflow-hidden rounded-md bg-cyan px-5 py-4 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15 text-[18px] font-extrabold">
              ⚙
            </div>
            <div>
              <div className="text-[13px] font-extrabold tracking-tight">
                UGT RELIABILITY · Lube Monitoring
              </div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/80">
                Condition Monitoring & Reliability
              </div>
            </div>
          </div>
          <div className="text-right text-[8.5px] uppercase tracking-[0.1em] text-white/70">
            Confidential
          </div>
        </div>
        <div className="mt-4 border-t border-white/20 pt-3">
          <div className="text-[18px] font-bold leading-tight">
            {TYPE_LABEL[config.type] ?? "Reliability Report"}
          </div>
          <div className="mt-1 text-[10.5px] text-white/85">
            {PERIOD_LABEL[config.period] ?? config.period} · ขอบเขต:{" "}
            {config.site ? `โรงงาน ${config.site}` : "ทุกโรงงาน (All Sites)"}
          </div>
          <div className="mt-0.5 text-[9px] text-white/70">
            ออกรายงานเมื่อ {generatedAt}
          </div>
        </div>
      </header>

      {/* 2. Executive Summary */}
      <Section no="1" title="บทสรุปผู้บริหาร (Executive Summary)">
        {execSummaryOverride ? (
          <div className="space-y-2">
            {execSummaryOverride.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="text-justify text-[11px] leading-relaxed text-t2">
                {p}
              </p>
            ))}
            {execSummarySource && (
              <div className="text-[8.5px] font-medium text-t3">
                ✨ สรุปโดย AI ({execSummarySource})
              </div>
            )}
          </div>
        ) : (
          <p className="text-justify text-[11px] leading-relaxed text-t2">
            กองเครื่องจักรภายใต้ขอบเขตรายงานมีจำนวนทั้งสิ้น{" "}
            <b className="text-t1">{formatNumber(data.kpis.total)}</b> เครื่อง คะแนนสุขภาพเฉลี่ย{" "}
            <b style={{ color: readableText(verdictColor) }}>{data.kpis.avgHealth}%</b> จัดอยู่ในระดับ{" "}
            <b style={{ color: readableText(verdictColor) }}>{verdict}</b> โดยพบเครื่องจักรสถานะวิกฤต{" "}
            <b className="text-red">{data.kpis.critical}</b> เครื่อง และสถานะเฝ้าระวัง{" "}
            <b className="text-yellow">{data.kpis.warning}</b> เครื่อง ที่ต้องการการติดตามและแทรกแซง
            คะแนนสุขภาพคำนวณจากผล Oil Analysis และ Vibration Analysis ตามเกณฑ์ ISO/ASTM/ISO 10816-3
            โดยใช้สูตรเดียวกันทั้งระบบ (compute_health)
          </p>
        )}
        <div
          className="mt-2 rounded border px-3 py-2 text-[10.5px]"
          style={{ borderColor: verdictColor + "55", background: verdictColor + "0d", color: readableText(verdictColor) }}
        >
          <b>สรุปคำตัดสิน (Overall Verdict): </b>
          สถานะกองเครื่องจักรโดยรวม = <b>{verdict}</b>
        </div>
      </Section>

      {/* 3. Fleet Health Overview */}
      <Section no="2" title="ภาพรวมสุขภาพกองเครื่องจักร (Fleet Health Overview)">
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
          คะแนนสุขภาพเฉลี่ย: <b className="text-cyan">{scoped.avgHealth}%</b>
          {"  ·  ขอบเขต: "}
          {config.site ? `โรงงาน ${config.site}` : "ทุกโรงงาน"}
        </div>
      </Section>

      {/* 4. Site Reliability */}
      <Section no="3" title="ประสิทธิภาพรายโรงงาน (Site Reliability)">
        <table className="w-full border-collapse text-left text-[10px]">
          <thead>
            <tr className="border-b border-border bg-black/[0.03] text-[8.5px] uppercase text-t3">
              <th scope="col" className="py-1.5 pl-1">Site</th>
              <th scope="col" className="py-1.5 text-right">Healthy</th>
              <th scope="col" className="py-1.5 text-right">Warning</th>
              <th scope="col" className="py-1.5 text-right">Critical</th>
              <th scope="col" className="py-1.5 text-right">Total</th>
              <th scope="col" className="py-1.5 pr-1 text-right">Avg Health</th>
            </tr>
          </thead>
          <tbody>
            {data.perSite.map((s) => (
              <tr
                key={s.code}
                className="rp-row border-b border-black/5"
                style={config.site === s.code ? { background: "#0066cc0d" } : undefined}
              >
                <td className="py-1.5 pl-1 font-semibold">{s.code}</td>
                <td className="py-1.5 text-right font-mono text-green">{s.healthy}</td>
                <td className="py-1.5 text-right font-mono text-yellow">{s.warning}</td>
                <td className="py-1.5 text-right font-mono text-red">{s.critical}</td>
                <td className="py-1.5 text-right font-mono">{s.total}</td>
                <td className="py-1.5 pr-1 text-right font-mono font-semibold">{s.avgHealth}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2">
          <SiteReliabilityChart data={data.perSite} noAnimation />
        </div>
      </Section>

      {/* 5. Risk Concentration by Equipment Type (Tech/Full) */}
      {!isExec && data.perType.length > 0 && (
        <Section no="4" title="ความเสี่ยงแยกตามประเภทเครื่องจักร (Risk Concentration)">
          <table className="w-full border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-b border-border bg-black/[0.03] text-[8.5px] uppercase text-t3">
                <th scope="col" className="py-1.5 pl-1">ประเภทเครื่องจักร</th>
                <th scope="col" className="py-1.5 text-right">Healthy</th>
                <th scope="col" className="py-1.5 text-right">Warning</th>
                <th scope="col" className="py-1.5 text-right">Critical</th>
                <th scope="col" className="py-1.5 pr-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.perType.map((t) => (
                <tr key={t.type} className="rp-row border-b border-black/5">
                  <td className="py-1.5 pl-1">
                    <span className="font-semibold">{t.abbr}</span> · {t.type}
                  </td>
                  <td className="py-1.5 text-right font-mono text-green">{t.healthy}</td>
                  <td className="py-1.5 text-right font-mono text-yellow">{t.warning}</td>
                  <td className="py-1.5 text-right font-mono text-red">{t.critical}</td>
                  <td className="py-1.5 pr-1 text-right font-mono">{t.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* 6. Top Critical Assets */}
      <Section no={isExec ? "4" : "5"} title="เครื่องจักรที่ต้องดำเนินการ (Warning & Critical — เรียงตามคะแนนสุขภาพ)">
        {data.topCritical.length === 0 ? (
          <div className="py-2 text-[10.5px] text-green">
            ไม่มีเครื่องจักรในสถานะ Warning หรือ Critical ในขอบเขตนี้
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-b border-border bg-black/[0.03] text-[8.5px] uppercase text-t3">
                <th scope="col" className="py-1.5 pl-1">#</th>
                <th scope="col" className="py-1.5">Asset ID</th>
                <th scope="col" className="py-1.5">ชื่อ</th>
                <th scope="col" className="py-1.5">Site</th>
                <th scope="col" className="py-1.5">Status</th>
                <th scope="col" className="py-1.5 pr-1 text-right">Health</th>
              </tr>
            </thead>
            <tbody>
              {data.topCritical.map((a, i) => (
                <tr key={a.id} className="rp-row border-b border-black/5">
                  <td className="py-1.5 pl-1 font-mono text-t3">{i + 1}</td>
                  <td className="py-1.5 font-mono text-cyan">{a.id}</td>
                  <td className="py-1.5">{a.name}</td>
                  <td className="py-1.5">{a.site}</td>
                  <td className="py-1.5">
                    <span className={a.status === "Critical" ? "text-red font-semibold" : "text-yellow font-semibold"}>
                      {a.status === "Critical" ? "🔴 Critical" : "⚠️ Warning"}
                    </span>
                  </td>
                  <td className="py-1.5 pr-1 text-right font-mono font-bold" style={{ color: readableText(a.status === "Critical" ? "#ef4444" : "#eab308") }}>
                    {a.health}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* 7. Scoring Methodology (Tech/Full) */}
      {!isExec && (
        <Section no="6" title="ระเบียบวิธีและเกณฑ์การให้คะแนน (Scoring Methodology)">
          <div className="mb-1.5 text-[10px] text-t2">
            ค่า Health Score คำนวณฝั่งเซิร์ฟเวอร์ด้วยฟังก์ชัน <b>compute_health</b>:
            เกิน Warning หักเต็ม Penalty (Warning) · เกิน Critical หักเต็ม Penalty (Critical) ของแต่ละพารามิเตอร์ตามตารางด้านล่าง · น้ำหนัก Oil {alarm.scoreConfig.oil_weight}% /
            Vibration {alarm.scoreConfig.vib_weight}%
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[8.5px] font-bold uppercase text-yellow">Oil Analysis</div>
              <MethodologyTable params={alarm.params.filter((p) => p.category === "oil")} scoreConfig={alarm.scoreConfig} />
            </div>
            <div>
              <div className="mb-1 text-[8.5px] font-bold uppercase text-purple">Vibration</div>
              <MethodologyTable params={alarm.params.filter((p) => p.category === "vib")} scoreConfig={alarm.scoreConfig} />
            </div>
          </div>
          {alarm.params.some((p) => p.key === "visc") && (
            <div className="mt-1 text-[8.5px] text-t3">Viscosity ใช้เกณฑ์ตามเกรด ISO VG ของแต่ละเครื่อง (ISO 3448) ทั้งด้านสูงและต่ำ</div>
          )}
        </Section>
      )}

      {/* 8+9. Recommendations + Signatures — อยู่ด้วยกัน ไม่แยกหน้า */}
      <div className="rp-section">
        <Section no={isExec ? "5" : "7"} title="ข้อเสนอแนะ (Recommendations)">
          <ul className="list-disc space-y-1 pl-5 text-[10.5px] leading-relaxed text-t2">
            {recs.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>

        <Section no={isExec ? "6" : "8"} title="การลงนาม (Signatures)">
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
        <div>
          UGT Reliability Lube Monitoring · ออกรายงานเมื่อ {generatedAt} · ข้อมูลจาก Health
          Score (compute_health) คำนวณฝั่งเซิร์ฟเวอร์ตามมาตรฐาน ISO 4406 / ASTM D4378 / ISO 10816-3 /
          AGMA 9005 / ISO 17359
        </div>
      </footer>
      </div>
    </div>
  );
}
