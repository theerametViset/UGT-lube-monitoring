"use server";

import { isDemoMode } from "@/lib/env";
import { demoBlocked, type ActionResult } from "./result";
import { logAudit } from "./audit-log";
import { requirePermission } from "./guards";
import { sendEmail } from "@/lib/email/send";
import { execSummaryEmail } from "@/lib/email/exec-summary";
import { getDashboardData } from "@/lib/queries/assets";
import { getNotificationConfig } from "@/lib/queries/notifications";
import { getActionReasons } from "@/lib/queries/action-reasons";
import { EXEC_MAX_CRITICAL, cleanEdits, execVerdict, reportNumber, reportTexts } from "@/lib/exec-summary-text";
import { createRateLimiter } from "@/lib/ai/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_RE = /^[A-Za-z0-9_-]{1,16}$/;
const TYPE_LABEL: Record<string, string> = {
  exec: "Executive Summary",
  board: "Plant Report",
  tech: "Oil Analysis Technical Report",
};

// (AUD-020) Sending email costs money — cap per user (in-memory, per instance).
const emailRateLimit = createRateLimiter(10, 60 * 60 * 1000); // 10/hour/user

// Email the generated report's summary. The server rebuilds the summary from the plant's
// data (RLS-scoped) — the client only says which report, never the text itself.
export async function sendReportEmail(input: {
  to: string;
  site: string;
  type: string;
  note?: string;
  /** Reworded narrative from the edit panel — needs reports:edit; numbers can't be edited. */
  edits?: Record<string, string>;
}): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();

  // (AUD-019) Only admin/engineer may send report emails to arbitrary addresses.
  const auth = await requirePermission("reports:send_email");
  if (!auth.ok) return auth.error;
  if (emailRateLimit(auth.userId)) {
    return { ok: false, message: "ส่งอีเมลถี่เกินไป — กรุณารอ 1 ชั่วโมงแล้วลองใหม่" };
  }

  const to = (input.to ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (to.length === 0) return { ok: false, message: "กรุณาระบุอีเมลผู้รับอย่างน้อย 1 ราย" };
  if (!to.every((e) => EMAIL_RE.test(e))) return { ok: false, message: "รูปแบบอีเมลไม่ถูกต้อง" };
  const site = input.site && SITE_RE.test(input.site) ? input.site : "";
  const typeLabel = TYPE_LABEL[input.type] ?? TYPE_LABEL.exec;
  const reportNo = reportNumber(site, TYPE_LABEL[input.type] ? input.type : "exec");
  const note = String(input.note ?? "").slice(0, 500);

  try {
    const [{ data }, cfg] = await Promise.all([getDashboardData(site), getNotificationConfig()]);
    const crit = data.topCritical.filter((a) => a.status === "Critical").slice(0, EXEC_MAX_CRITICAL);
    const reasons = await getActionReasons(crit).catch(() => ({}));
    const edits = cleanEdits(reportTexts(data, site, reasons), input.edits);
    if (Object.keys(edits).length) {
      const canEdit = await requirePermission("reports:edit");
      if (!canEdit.ok) return canEdit.error;
    }
    const texts = reportTexts(data, site, reasons, edits);
    const email = execSummaryEmail({
      data,
      texts,
      edited: Object.keys(edits).length > 0,
      verdict: execVerdict(data.kpis, data.siteReliability),
      scopeLabel: site ? `โรงงาน ${site}` : "ทุกโรงงาน",
      scopeCode: site || "ALL",
      typeLabel,
      reportNo,
      note,
    });
    const res = await sendEmail({ to, from: cfg.from_email, subject: email.subject, html: email.html });
    if (!res.ok) return { ok: false, message: res.message };
    await logAudit({
      action: "SEND",
      table_name: "reports",
      record_id: reportNo,
      new_value: { to: to.length, site: site || "ALL", type: input.type, edited: Object.keys(edits) },
    });
    return { ok: true, message: res.message };
  } catch {
    return { ok: false, message: "เกิดข้อผิดพลาดภายในระบบ" };
  }
}

// Audit: who printed a report with reworded text, and which parts (the text itself stays in the PDF).
export async function logReportEdits(input: { site: string; type: string; edits: Record<string, string> }): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  const auth = await requirePermission("reports:edit");
  if (!auth.ok) return auth.error;
  const site = input.site && SITE_RE.test(input.site) ? input.site : "";
  try {
    const { data } = await getDashboardData(site);
    const crit = data.topCritical.filter((a) => a.status === "Critical").slice(0, EXEC_MAX_CRITICAL);
    const reasons = await getActionReasons(crit).catch(() => ({}));
    const edits = cleanEdits(reportTexts(data, site, reasons), input.edits);
    await logAudit({
      action: "EDIT",
      table_name: "reports",
      record_id: reportNumber(site, TYPE_LABEL[input.type] ? input.type : "exec"),
      new_value: { site: site || "ALL", type: input.type, edits } as Record<string, unknown>,
    });
    return { ok: true, message: "บันทึกแล้ว" };
  } catch {
    return { ok: false, message: "เกิดข้อผิดพลาดภายในระบบ" };
  }
}

