"use server";

import { isDemoMode } from "@/lib/env";
import { demoBlocked, type ActionResult } from "./result";
import { logAudit } from "./audit-log";
import { requirePermission } from "./guards";
import { sendEmail } from "@/lib/email/send";
import { execSummaryEmail } from "@/lib/email/exec-summary";
import { getDashboardData } from "@/lib/queries/assets";
import { getNotificationConfig } from "@/lib/queries/notifications";
import { createRateLimiter } from "@/lib/ai/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// (AUD-020) Sending email costs money — cap per user (in-memory, per instance).
const emailRateLimit = createRateLimiter(10, 60 * 60 * 1000); // 10/hour/user

// Email the AI executive summary (or the user-edited version) to recipients.
export async function sendExecSummaryEmail(input: {
  to: string;
  summary: string;
  source?: string;
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
  if (!input.summary?.trim()) return { ok: false, message: "ยังไม่มีบทสรุปให้ส่ง — กดสร้าง AI สรุปก่อน" };

  try {
    const [{ data }, cfg] = await Promise.all([getDashboardData(""), getNotificationConfig()]);
    const email = execSummaryEmail({
      data,
      summary: input.summary.trim(),
      source: input.source ?? "fallback",
    });
    const res = await sendEmail({
      to,
      from: cfg.from_email,
      subject: email.subject,
      html: email.html,
    });
    if (!res.ok) return { ok: false, message: res.message };
    await logAudit({
      action: "SEND",
      table_name: "reports",
      record_id: "exec-summary",
      new_value: { to: to.length },
    });
    return { ok: true, message: res.message };
  } catch (e) {
    return { ok: false, message: "เกิดข้อผิดพลาดภายในระบบ" };
  }
}
