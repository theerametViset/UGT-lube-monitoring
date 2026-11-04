// Weekly Digest Email template — summary of fleet health
import { healthColor } from "@/lib/scoring/health";

export function weeklyDigestEmail(opts: {
  totalAssets: number;
  critical: number;
  warning: number;
  avgHealth: number;
  topCritical: { id: string; name: string; health: number }[];
}): { subject: string; html: string } {
  const date = new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const color = healthColor(opts.avgHealth);

  const criticalRows = opts.topCritical.map((a) => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:12px;color:#0066cc;">${a.id}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;">${a.name}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:14px;font-weight:700;color:#ef4444;text-align:right;">${a.health}%</td>
    </tr>`).join("");

  return {
    subject: `📅 UGT Weekly Digest — ${date} | Health ${opts.avgHealth}% | ${opts.critical} Critical`,
    html: `
    <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 0;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            <tr><td style="background:linear-gradient(135deg,#0066cc,#0d2847);padding:24px 32px;">
              <div style="font-size:22px;font-weight:800;color:#fff;">⚙ UGT RELIABILITY</div>
              <div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:1.4px;">Weekly Digest · ${date}</div>
            </td></tr>
            <tr><td style="padding:24px 32px;">
              <h1 style="font-size:18px;font-weight:700;color:#1d1d1f;margin:0 0 16px;">📊 สรุปประจำสัปดาห์</h1>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:12px;background:#f9fafc;border-radius:8px;text-align:center;">
                    <div style="font-size:10px;color:#7a7a7a;text-transform:uppercase;">Avg Health</div>
                    <div style="font-size:32px;font-weight:800;color:${color};">${opts.avgHealth}%</div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="padding:10px 16px;background:#f9fafc;border-radius:8px;">
                    <span style="font-size:11px;color:#7a7a7a;">สินทรัพย์รวม</span>
                    <span style="float:right;font-size:16px;font-weight:700;color:#1d1d1f;">${opts.totalAssets}</span>
                  </td>
                </tr>
                <tr><td style="height:4px;"></td></tr>
                <tr>
                  <td style="padding:10px 16px;background:rgba(239,68,68,.06);border-radius:8px;">
                    <span style="font-size:11px;color:#ef4444;">🔴 Critical</span>
                    <span style="float:right;font-size:16px;font-weight:700;color:#ef4444;">${opts.critical}</span>
                  </td>
                </tr>
                <tr><td style="height:4px;"></td></tr>
                <tr>
                  <td style="padding:10px 16px;background:rgba(245,158,11,.06);border-radius:8px;">
                    <span style="font-size:11px;color:#f59e0b;">🟡 Warning</span>
                    <span style="float:right;font-size:16px;font-weight:700;color:#f59e0b;">${opts.warning}</span>
                  </td>
                </tr>
              </table>

              ${opts.topCritical.length > 0 ? `
              <h2 style="font-size:14px;font-weight:700;color:#1d1d1f;margin:0 0 8px;">🚨 เครื่องจักรวิกฤต Top ${opts.topCritical.length}</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <thead>
                  <tr style="background:#f9fafc;">
                    <th style="padding:8px 16px;text-align:left;font-size:10px;color:#7a7a7a;text-transform:uppercase;">Asset</th>
                    <th style="padding:8px 16px;text-align:left;font-size:10px;color:#7a7a7a;text-transform:uppercase;">ชื่อ</th>
                    <th style="padding:8px 16px;text-align:right;font-size:10px;color:#7a7a7a;text-transform:uppercase;">Health</th>
                  </tr>
                </thead>
                <tbody>${criticalRows}</tbody>
              </table>` : ""}

              <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard" style="display:inline-block;padding:10px 24px;background:#0066cc;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">📊 เปิด Dashboard →</a>
            </td></tr>
            <tr><td style="padding:16px 32px;background:#fafafc;border-top:1px solid #e0e0e0;">
              <p style="font-size:10px;color:#7a7a7a;margin:0;">อีเมลนี้ส่งอัตโนมัติทุกวันจันทร์ · UGT Reliability Lube Monitoring · © 2026</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>`,
  };
}
