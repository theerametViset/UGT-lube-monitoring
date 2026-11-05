// Weekly Digest Email template — summary of fleet health
import { healthColor } from "@/lib/scoring/health";
import type { ActionReason } from "@/lib/scoring/advice";
import { escapeHtml } from "./exec-summary";

// The cause shown under a machine in the email: its worst readings, as on the Dashboard.
export function causeLine(r: ActionReason | undefined): string {
  if (!r) return "";
  const top = r.advice.slice(0, 2).map((a) => `${a.label} (${a.badge})`);
  return (top.length ? top.join(" · ") + (r.advice.length > 2 ? ` · อีก ${r.advice.length - 2} ค่า` : "") : r.notes[0]) ?? "";
}

export function weeklyDigestEmail(opts: {
  totalAssets: number;
  critical: number;
  warning: number;
  healthy: number;
  avgHealth: number;
  /** cause: causeLine() text, "" when unknown */
  topCritical: { id: string; name: string; health: number; cause?: string }[];
}): { subject: string; html: string } {
  // Bangkok date: the cron runs on UTC (Monday 06:00 UTC = 13:00 in Thailand).
  const date = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });
  const app = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const color = healthColor(opts.avgHealth);

  // One line that says what to do, and the button that goes there.
  const [headline, button, href] =
    opts.critical > 0
      ? [`สัปดาห์นี้มีเครื่องวิกฤต <b style="color:#ef4444;">${opts.critical} เครื่อง</b> ควรดำเนินการ`, "ดูเครื่องวิกฤตทั้งหมด →", "/dashboard?status=Critical"]
      : opts.warning > 0
        ? [`ไม่มีเครื่องวิกฤต · มีเครื่องเฝ้าระวัง <b style="color:#f59e0b;">${opts.warning} เครื่อง</b> ควรติดตาม`, "ดูเครื่องเฝ้าระวังทั้งหมด →", "/dashboard?status=Warning"]
        : ["เครื่องจักรทั้งหมดอยู่ในเกณฑ์ปกติ ✅", "เปิด Dashboard →", "/dashboard"];

  const row = (label: string, value: number, fg: string, bg: string) => `
                <tr>
                  <td style="padding:10px 16px;background:${bg};border-radius:8px;">
                    <span style="font-size:12px;color:${fg};">${label}</span>
                    <span style="float:right;font-size:16px;font-weight:700;color:${fg};">${value}</span>
                  </td>
                </tr>
                <tr><td style="height:4px;"></td></tr>`;

  const criticalRows = opts.topCritical.map((a) => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:12px;"><a href="${app}/assets/${encodeURIComponent(a.id)}" style="color:#0066cc;text-decoration:none;">${escapeHtml(a.id)}</a></td>
      <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;">${escapeHtml(a.name)}${a.cause ? `<div style="font-size:11px;color:#b91c1c;margin-top:2px;">${escapeHtml(a.cause)}</div>` : ""}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:14px;font-weight:700;color:${healthColor(a.health)};text-align:right;">${a.health}</td>
    </tr>`).join("");

  return {
    // Tag first (easy mail rules), the counts before a phone cuts the line off.
    subject: `[UGT Lube] สรุปสัปดาห์ ${date} — วิกฤต ${opts.critical} · เฝ้าระวัง ${opts.warning}`,
    html: `
    <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            <!-- bgcolor + background-color: Outlook drops the gradient -->
            <tr><td bgcolor="#0d2847" style="background-color:#0d2847;background-image:linear-gradient(135deg,#0066cc,#0d2847);padding:24px 32px;">
              <div style="font-size:20px;font-weight:800;color:#fff;">UGT RELIABILITY · <span style="color:#fbbf24;">Lube Monitoring</span></div>
              <div style="font-size:12px;color:rgba(255,255,255,.75);">สรุปประจำสัปดาห์ · ${date}</div>
            </td></tr>
            <tr><td style="padding:24px 32px;">
              <p style="font-size:16px;color:#1d1d1f;margin:0 0 16px;line-height:1.6;">${headline}</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:12px;background:#f9fafc;border-radius:8px;text-align:center;">
                    <div style="font-size:11px;color:#7a7a7a;">Health เฉลี่ย</div>
                    <div style="font-size:32px;font-weight:800;color:${color};">${opts.avgHealth}</div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                ${row("เครื่องจักรทั้งหมด", opts.totalAssets, "#1d1d1f", "#f9fafc")}
                ${row("🔴 วิกฤต", opts.critical, "#ef4444", "rgba(239,68,68,.06)")}
                ${row("🟡 เฝ้าระวัง", opts.warning, "#b45309", "rgba(245,158,11,.08)")}
                ${row("🟢 ปกติ", opts.healthy, "#15803d", "rgba(34,197,94,.08)")}
              </table>

              ${opts.topCritical.length > 0 ? `
              <!-- topCritical = the worst Critical AND Warning machines (lib/queries/assets.ts) -->
              <h2 style="font-size:14px;font-weight:700;color:#1d1d1f;margin:0 0 8px;">🚨 เครื่องที่ต้องดำเนินการ ${opts.topCritical.length} อันดับแรก</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <thead>
                  <tr style="background:#f9fafc;">
                    <th style="padding:8px 16px;text-align:left;font-size:11px;color:#7a7a7a;">รหัสเครื่อง</th>
                    <th style="padding:8px 16px;text-align:left;font-size:11px;color:#7a7a7a;">ชื่อ / สาเหตุ</th>
                    <th style="padding:8px 16px;text-align:right;font-size:11px;color:#7a7a7a;">Health</th>
                  </tr>
                </thead>
                <tbody>${criticalRows}</tbody>
              </table>` : ""}

              <a href="${app}${href}" style="display:inline-block;padding:10px 24px;background:#0066cc;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">${button}</a>
            </td></tr>
            <tr><td style="padding:16px 32px;background:#fafafc;border-top:1px solid #e0e0e0;">
              <p style="font-size:11px;color:#7a7a7a;margin:0;line-height:1.6;">อีเมลนี้ส่งอัตโนมัติทุกวันจันทร์ · ปรับผู้รับหรือปิดการส่งได้ที่ ผู้ดูแลระบบ → ตั้งค่าแจ้งเตือนอีเมล<br>UGT Reliability Lube Monitoring · © 2026</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>`,
  };
}
