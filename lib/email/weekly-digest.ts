// Weekly Digest Email template — summary of fleet health
import { healthColor } from "@/lib/scoring/health";
import { execVerdict } from "@/lib/exec-summary-text";
import { escapeHtml } from "./exec-summary";

/** Machines listed per plant in the digest; more than this becomes "และอีก N เครื่อง →". */
export const PER_PLANT = 10;

const RED = "#c62828";
const AMBER = "#b45309";
const GREEN = "#15803d";
const MUTED = "#6b6b6b";

export interface DigestMachine {
  id: string;
  name: string;
  site?: string;
  health: number;
  /** the readings over their limits, worst first, as on the Dashboard (one line each) */
  readings?: { label: string; over: string; limit: string | null; crit: boolean }[];
  /** the worst reading's next step */
  action?: string;
  /** "พ.ย. 69", or "" when the machine has no lab result yet */
  lab?: string;
  /** plain-text line shown when there are no readings (e.g. a note) */
  cause?: string;
}

// Email clients (Outlook above all) handle little CSS: tables, background colours and borders only.
export function weeklyDigestEmail(opts: {
  totalAssets: number;
  critical: number;
  warning: number;
  healthy: number;
  avgHealth: number;
  /** every plant's counts, for the plant table */
  sites?: { code: string; critical: number; warning: number; healthy: number; total: number }[];
  /** the worst Critical/Warning machines, at most PER_PLANT per plant; the rest are a link to that plant */
  topCritical: DigestMachine[];
}): { subject: string; html: string } {
  // Bangkok date: the cron runs on UTC (Monday 06:00 UTC = 13:00 in Thailand).
  const date = new Date().toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "2-digit" });
  const app = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const sites = [...(opts.sites ?? [])].sort((a, b) => b.critical - a.critical || b.warning - a.warning || a.code.localeCompare(b.code));

  // ① the verdict first — from the counts, as in the reports; a fleet average hides one critical machine
  const v = execVerdict(opts, sites);
  const tone = { crit: RED, warn: AMBER, ok: GREEN }[v.tone];
  const [button, href] =
    opts.critical > 0 ? ["ดูเครื่องวิกฤตทั้งหมด →", "/dashboard?status=Critical"]
    : opts.warning > 0 ? ["ดูเครื่องเฝ้าระวังทั้งหมด →", "/dashboard?status=Warning"]
    : ["เปิด Dashboard →", "/dashboard"];

  // ② three counts
  const count = (label: string, value: number, fg: string, bg: string) => `
                  <td width="33%" style="padding:10px 6px;background:${bg};text-align:center;">
                    <div style="font-size:13px;color:${fg};">${label}</div>
                    <div style="font-size:26px;font-weight:800;color:${value ? fg : "#b0b0b0"};line-height:1.2;">${value}</div>
                  </td>`;

  // plant table: worst plant first, a 0 in grey, plus the fleet total
  const n = (v: number, c: string, bold = false) =>
    `<td style="padding:7px 10px;text-align:right;font-size:14px;${bold ? "font-weight:700;" : ""}color:${v ? c : "#b0b0b0"};">${v}</td>`;
  const siteTable = sites.length ? `
              <div style="font-size:15px;font-weight:700;color:#1d1d1f;margin:0 0 6px;">สรุปรายโรงงาน</div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;border-collapse:collapse;">
                <tr style="background:#f4f5f7;">
                  <th style="padding:7px 10px;text-align:left;font-size:13px;color:${MUTED};font-weight:600;">โรงงาน</th>
                  <th style="padding:7px 10px;text-align:right;font-size:13px;color:${MUTED};font-weight:600;">วิกฤต</th>
                  <th style="padding:7px 10px;text-align:right;font-size:13px;color:${MUTED};font-weight:600;">เฝ้าระวัง</th>
                  <th style="padding:7px 10px;text-align:right;font-size:13px;color:${MUTED};font-weight:600;">ปกติ</th>
                  <th style="padding:7px 10px;text-align:right;font-size:13px;color:${MUTED};font-weight:600;">ทั้งหมด</th>
                </tr>
                ${sites.map((s) => `
                <tr style="border-bottom:1px solid #eeeeee;">
                  <td style="padding:7px 10px;font-size:14px;font-weight:600;"><a href="${app}/dashboard?site=${encodeURIComponent(s.code)}" style="color:#0066cc;text-decoration:none;">${escapeHtml(s.code)}</a></td>
                  ${n(s.critical, RED, true)}${n(s.warning, AMBER, true)}${n(s.healthy, "#333")}${n(s.total, "#333")}
                </tr>`).join("")}
                <tr style="border-top:2px solid #dddddd;">
                  <td style="padding:7px 10px;font-size:14px;font-weight:700;color:#1d1d1f;">รวม</td>
                  ${n(opts.critical, RED, true)}${n(opts.warning, AMBER, true)}${n(opts.healthy, "#333", true)}${n(opts.totalAssets, "#333", true)}
                </tr>
              </table>` : "";

  // ④–⑦ one machine: side line by status, its readings one per line, the next step, the lab month
  const machine = (a: DigestMachine) => {
    const c = healthColor(a.health);
    const readings = a.readings?.length
      ? a.readings.map((r) => `
          <div style="font-size:13px;color:#333;margin-top:3px;">
            <span style="color:${r.crit ? RED : AMBER};">&#9679;</span>&nbsp;${escapeHtml(r.label)}
            &nbsp;<b style="color:${r.crit ? RED : AMBER};">${escapeHtml(r.over)}</b>${r.limit ? `&nbsp;<span style="color:${MUTED};">(${escapeHtml(r.limit)})</span>` : ""}
          </div>`).join("")
      : a.cause ? `<div style="font-size:13px;color:${RED};margin-top:3px;">${escapeHtml(a.cause)}</div>` : "";
    return `
      <tr><td style="padding:10px 0 10px 12px;border-left:3px solid ${c};border-bottom:1px solid #eeeeee;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:14px;font-weight:700;color:#1d1d1f;">${escapeHtml(a.name)}
            <a href="${app}/assets/${encodeURIComponent(a.id)}" style="font-family:monospace;font-size:13px;font-weight:400;color:#0066cc;text-decoration:none;white-space:nowrap;">${escapeHtml(a.id)}</a></td>
          <td width="56" style="text-align:right;font-size:18px;font-weight:800;color:${c};padding-right:10px;">${a.health}</td>
        </tr></table>
        ${readings}
        ${a.action ? `<div style="font-size:13px;color:#444;margin-top:5px;">&rarr; ${escapeHtml(a.action)}</div>` : ""}
        ${a.lab !== undefined ? `<div style="font-size:12px;color:${MUTED};margin-top:4px;">ผลแล็บ ${a.lab ? escapeHtml(a.lab) : "—"}</div>` : ""}
      </td></tr>`;
  };

  // ③ machines grouped under a plant band; plants with nothing to do share one line
  const groups = sites
    .filter((s) => s.critical + s.warning > 0)
    .map((s) => {
      const list = opts.topCritical.filter((a) => a.site === s.code);
      const more = s.critical + s.warning - list.length;
      const counts = [s.critical && `วิกฤต ${s.critical}`, s.warning && `เฝ้าระวัง ${s.warning}`].filter(Boolean).join(" · ");
      return `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 2px;"><tr>
                <td style="padding:8px 12px;background:#eef3fb;font-size:14px;font-weight:700;color:#1d1d1f;">${escapeHtml(s.code)}
                  <span style="font-weight:400;color:${MUTED};">&nbsp;· ${counts}</span></td>
              </tr></table>
              <table width="100%" cellpadding="0" cellspacing="0">${list.map(machine).join("")}</table>
              ${more > 0 ? `<div style="margin-top:6px;"><a href="${app}/dashboard?site=${encodeURIComponent(s.code)}" style="font-size:13px;color:#0066cc;text-decoration:none;">และอีก ${more} เครื่อง →</a></div>` : ""}`;
    })
    .join("");
  const allClear = sites.filter((s) => s.critical + s.warning === 0).map((s) => escapeHtml(s.code));
  // without plant counts, fall back to one flat list
  const machines = sites.length
    ? groups + (allClear.length ? `<p style="font-size:13px;color:${GREEN};margin:14px 0 0;">${allClear.join(", ")} · ปกติทั้งหมด</p>` : "")
    : opts.topCritical.length ? `<table width="100%" cellpadding="0" cellspacing="0">${opts.topCritical.map(machine).join("")}</table>` : "";

  // Which plants, in the subject and the inbox preview: a plant manager spots their own without opening it.
  const plantsWith = (key: "critical" | "warning") => {
    const codes = sites.filter((s) => s[key] > 0).map((s) => s.code);
    return codes.length ? ` (${codes.slice(0, 3).join(", ")}${codes.length > 3 ? ` +${codes.length - 3}` : ""})` : "";
  };
  const counts =
    opts.critical > 0 ? `วิกฤต ${opts.critical}${plantsWith("critical")} · เฝ้าระวัง ${opts.warning}`
    : opts.warning > 0 ? `วิกฤต 0 · เฝ้าระวัง ${opts.warning}${plantsWith("warning")}`
    : "ปกติทั้งหมด";
  // preheader: the line an inbox shows under the subject before the email is opened
  const preheader = [
    v.label,
    ...sites
      .filter((s) => s.critical + s.warning > 0)
      .map((s) => `${s.code} ${[s.critical && `วิกฤต ${s.critical}`, s.warning && `เฝ้าระวัง ${s.warning}`].filter(Boolean).join(" ")}`),
  ].join(" · ");

  return {
    // Tag first (easy mail rules), the counts before a phone cuts the line off.
    subject: `[UGT Lube] สรุปสัปดาห์ ${date} — ${counts}`,
    html: `
    <body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f5f5f7;">${escapeHtml(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 8px;">
        <tr><td align="center">
          <!-- ⑧ shrinks with a phone screen, 560 px at most -->
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;">
            <!-- bgcolor + background-color: Outlook drops the gradient -->
            <tr><td bgcolor="#0d2847" style="background-color:#0d2847;background-image:linear-gradient(135deg,#0066cc,#0d2847);padding:22px 24px;">
              <div style="font-size:19px;font-weight:800;color:#fff;">UGT RELIABILITY · <span style="color:#fbbf24;">Lube Monitoring</span></div>
              <div style="font-size:13px;color:rgba(255,255,255,.8);">สรุปประจำสัปดาห์ · ${date}</div>
            </td></tr>
            <tr><td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;"><tr>
                <td style="padding:11px 14px;border-left:4px solid ${tone};background:${tone}14;font-size:15px;color:${tone};">
                  <b>ผลการประเมิน: ${v.label}</b> · ${v.detail}
                </td>
              </tr></table>

              <table width="100%" cellpadding="0" cellspacing="6" style="margin:0 -6px 18px;"><tr>
                ${count("วิกฤต", opts.critical, RED, "#fdeceb")}
                ${count("เฝ้าระวัง", opts.warning, AMBER, "#fdf3e3")}
                ${count("ปกติ", opts.healthy, GREEN, "#eaf6ee")}
              </tr></table>

              ${siteTable}

              ${machines ? `
              <div style="font-size:15px;font-weight:700;color:#1d1d1f;">เครื่องที่ต้องดำเนินการ</div>
              ${machines}
              <div style="height:20px;"></div>` : ""}

              <a href="${app}${href}" style="display:inline-block;padding:11px 24px;background:#0066cc;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${button}</a>
            </td></tr>
            <tr><td style="padding:14px 24px;background:#fafafc;border-top:1px solid #e5e5e5;">
              <p style="font-size:12px;color:${MUTED};margin:0;line-height:1.6;">อีเมลนี้ส่งอัตโนมัติทุกวันจันทร์ · ปรับผู้รับหรือปิดการส่งได้ที่ ผู้ดูแลระบบ → ตั้งค่าแจ้งเตือนอีเมล<br>UGT Reliability Lube Monitoring</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>`,
  };
}
