import type { DashboardData } from "@/lib/queries/assets";
import { healthColor } from "@/lib/scoring/health";

// Escape user/LLM text before embedding in HTML email (XSS guard).
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SOURCE_LABEL: Record<string, string> = {
  glm: "GLM",
  openai: "OpenAI",
  anthropic: "Claude",
  fallback: "Rule-based (ไม่มี AI key)",
};

export function execSummaryEmail(opts: {
  data: DashboardData;
  summary: string;
  source: string;
}): { subject: string; html: string } {
  const { kpis } = opts.data;
  const date = new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const color = healthColor(kpis.avgHealth);

  const paragraphs = opts.summary
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;font-size:13px;line-height:1.7;color:#333;">${escapeHtml(p)}</p>`)
    .join("");

  const topRows = opts.data.topCritical
    .slice(0, 5)
    .map(
      (a) => `
    <tr>
      <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:12px;color:#0066cc;">${escapeHtml(a.id)}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#333;">${escapeHtml(a.name)}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:14px;font-weight:700;color:#ef4444;text-align:right;">${a.health}%</td>
    </tr>`,
    )
    .join("");

  return {
    subject: `📊 UGT Executive Summary — ${date} | Health ${kpis.avgHealth}% | ${kpis.critical} Critical`,
    html: `
    <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
            <tr><td style="background:linear-gradient(135deg,#0066cc,#0d2847);padding:24px 32px;">
              <div style="font-size:22px;font-weight:800;color:#fff;">⚙ UGT RELIABILITY</div>
              <div style="font-size:11px;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:1.4px;">Executive Summary · ${date}</div>
            </td></tr>
            <tr><td style="padding:24px 32px;">
              <h1 style="font-size:18px;font-weight:700;color:#1d1d1f;margin:0 0 16px;">📊 สรุปสถานะกองเครื่องจักร (AI Executive Summary)</h1>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="width:33%;padding:12px;background:#f9fafc;border-radius:8px;text-align:center;">
                    <div style="font-size:10px;color:#7a7a7a;text-transform:uppercase;">Avg Health</div>
                    <div style="font-size:30px;font-weight:800;color:${color};">${kpis.avgHealth}%</div>
                  </td>
                  <td style="width:3%;"></td>
                  <td style="width:30%;padding:12px;background:rgba(239,68,68,.06);border-radius:8px;text-align:center;">
                    <div style="font-size:10px;color:#ef4444;text-transform:uppercase;">Critical</div>
                    <div style="font-size:30px;font-weight:800;color:#ef4444;">${kpis.critical}</div>
                  </td>
                  <td style="width:3%;"></td>
                  <td style="width:30%;padding:12px;background:rgba(245,158,11,.06);border-radius:8px;text-align:center;">
                    <div style="font-size:10px;color:#f59e0b;text-transform:uppercase;">Warning</div>
                    <div style="font-size:30px;font-weight:800;color:#f59e0b;">${kpis.warning}</div>
                  </td>
                </tr>
              </table>

              <div style="font-size:11px;color:#7a7a7a;text-transform:uppercase;letter-spacing:.6px;margin:0 0 8px;">บทสรุปจาก AI</div>
              ${paragraphs}

              <div style="font-size:10px;color:#9a9a9a;margin:4px 0 20px;">แหล่งข้อมูล: ${escapeHtml(SOURCE_LABEL[opts.source] ?? opts.source)} · ข้อมูลจาก Health Score (compute_health)</div>

              ${topRows ? `
              <h2 style="font-size:14px;font-weight:700;color:#1d1d1f;margin:0 0 8px;">🚨 เครื่องจักรวิกฤต Top ${opts.data.topCritical.slice(0, 5).length}</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <thead>
                  <tr style="background:#f9fafc;">
                    <th style="padding:8px 16px;text-align:left;font-size:10px;color:#7a7a7a;text-transform:uppercase;">Asset</th>
                    <th style="padding:8px 16px;text-align:left;font-size:10px;color:#7a7a7a;text-transform:uppercase;">ชื่อ</th>
                    <th style="padding:8px 16px;text-align:right;font-size:10px;color:#7a7a7a;text-transform:uppercase;">Health</th>
                  </tr>
                </thead>
                <tbody>${topRows}</tbody>
              </table>` : ""}

              <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reports" style="display:inline-block;padding:10px 24px;background:#0066cc;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">📄 เปิดหน้าสร้างรายงาน →</a>
            </td></tr>
            <tr><td style="padding:16px 32px;background:#fafafc;border-top:1px solid #e0e0e0;">
              <p style="font-size:10px;color:#7a7a7a;margin:0;">อีเมลนี้สร้างจาก AI Executive Summary · UGT Reliability Lube Monitoring · © 2026</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>`,
  };
}
