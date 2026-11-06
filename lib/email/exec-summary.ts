import type { DashboardData } from "@/lib/queries/assets";
import { reportDate, type ReportTexts } from "@/lib/exec-summary-text";

// Escape user text before embedding in HTML email (XSS guard).
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TONE: Record<"crit" | "warn" | "ok", string> = { crit: "#c62828", warn: "#a16207", ok: "#15803d" };

// The report emailed after "สร้างตัวอย่างรายงาน": same scope, verdict and summary as the report.
export function execSummaryEmail(opts: {
  data: DashboardData; // already scoped to the report's plant
  texts: ReportTexts; // reportTexts — the report's own words, edits applied
  edited?: boolean;
  verdict: { label: string; detail: string; tone: "crit" | "warn" | "ok" };
  scopeLabel: string; // "ทุกโรงงาน" | "โรงงาน TSL"
  scopeCode: string; // "ALL" | "TSL"
  typeLabel: string; // "Executive Summary" ...
  reportNo: string;
  note?: string;
}): { subject: string; html: string } {
  const { kpis } = opts.data;
  const date = reportDate();
  const color = TONE[opts.verdict.tone];
  const p = (t: string, style = "") =>
    `<p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#333;${style}">${escapeHtml(t)}</p>`;
  const t = opts.texts;
  const crit = t.critical
    .map(
      (c) => `
      <div style="border-left:3px solid #c62828;padding:2px 0 2px 10px;margin:0 0 10px;font-size:13px;line-height:1.6;color:#333;">
        <b style="color:#1d1d1f;">${escapeHtml(c.asset.name)}</b> <span style="font-family:monospace;font-size:11px;color:#777;">${escapeHtml(c.asset.id)} · ${escapeHtml(c.asset.site)}</span><br/>
        <b>ปัญหาที่พบ:</b> ${escapeHtml(c.what)}<br/>
        <b>สิ่งที่ควรทำ:</b> ${escapeHtml(c.act)}
      </div>`,
    )
    .join("");
  const recs = t.recs.length
    ? `<div style="font-size:12px;font-weight:700;color:#1d1d1f;margin:6px 0 6px;">ข้อเสนอแนะ</div>
       <ul style="margin:0 0 10px;padding-left:18px;font-size:13px;line-height:1.6;color:#333;">${t.recs
         .map((r) => `<li><b>[${escapeHtml(r.tag)}]</b> ${escapeHtml(r.text)}</li>`)
         .join("")}</ul>`
    : "";
  const note = opts.note?.trim();
  const kpi = (label: string, v: number, c: string) => `
    <td style="padding:10px;text-align:center;border:1px solid #eee;">
      <div style="font-size:10px;color:#777;text-transform:uppercase;">${label}</div>
      <div style="font-size:24px;font-weight:700;color:${v === 0 ? "#9ca3af" : c};">${v}</div>
    </td>`;

  return {
    subject: `[UGT Lube] ${opts.typeLabel} · ${opts.scopeCode} · ${date} · ${opts.verdict.label}`,
    html: `
    <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-top:4px solid #0066cc;">
            <tr><td style="padding:20px 28px 8px;">
              <div style="font-size:12px;font-weight:800;color:#1d1d1f;">UGT RELIABILITY · Lube Monitoring</div>
              <div style="font-size:18px;font-weight:700;color:#1d1d1f;margin-top:10px;">${escapeHtml(opts.typeLabel)}</div>
              <div style="font-size:11px;color:#777;margin-top:2px;">${escapeHtml(opts.scopeLabel)} · ข้อมูล ณ ${date} · ${escapeHtml(opts.reportNo)}</div>
            </td></tr>
            <tr><td style="padding:12px 28px 4px;">
              <div style="padding:10px 14px;border:1px solid ${color}55;background:${color}12;color:${color};font-size:13px;">
                <b>ผลการประเมิน (${escapeHtml(opts.scopeLabel)}): ${escapeHtml(opts.verdict.label)}</b> · ${escapeHtml(opts.verdict.detail)}
              </div>
            </td></tr>
            <tr><td style="padding:12px 28px 0;">
              ${p(t.headline, "font-weight:700;color:#1d1d1f;")}
              ${crit}
              ${t.more ? p(t.more, "color:#777;") : ""}
              ${t.warning ? `<div style="border-left:3px solid #a16207;padding:2px 0 2px 10px;margin:0 0 10px;font-size:13px;line-height:1.6;color:#333;">${escapeHtml(t.warning)}</div>` : ""}
              ${recs}
              ${note ? p(`หมายเหตุผู้จัดทำ: ${note}`, "color:#555;font-style:italic;") : ""}
            </td></tr>
            <tr><td style="padding:8px 28px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  ${kpi("เครื่องจักรทั้งหมด", kpis.total, "#1d1d1f")}
                  ${kpi("วิกฤต", kpis.critical, "#c62828")}
                  ${kpi("เฝ้าระวัง", kpis.warning, "#a16207")}
                  ${kpi("ปกติ", kpis.healthy, "#15803d")}
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:12px 28px;background:#fafafc;border-top:1px solid #e5e5e5;">
              <p style="font-size:10px;color:#777;margin:0;">UGT Reliability Lube Monitoring · ${escapeHtml(opts.reportNo)}${opts.edited ? " · ข้อความบางส่วนแก้ไขโดยผู้จัดทำ" : ""} · รายงานฉบับเต็มเปิดได้ที่หน้า Reports</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>`,
  };
}
