"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { requirePermission } from "./guards";
import { logAudit } from "./audit-log";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { buildWeeklyDigest } from "@/lib/email/weekly-digest-build";
import { getNotificationConfig } from "@/lib/queries/notifications";
import { demoCan } from "@/lib/queries/permissions";
import { createRateLimiter } from "@/lib/ai/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Sending costs Resend quota and lands in people's inboxes — cap per user (in-memory, per instance).
const testLimit = createRateLimiter(10, 60 * 60 * 1000); // 10 test sends / hour
const allLimit = createRateLimiter(3, 24 * 60 * 60 * 1000); // 3 sends to everyone / day

export interface NotificationConfigInput {
  from_email: string;
  email_recipients: string[];
  enable_critical_alerts: boolean;
  enable_weekly_summary: boolean;
}

export async function saveNotificationConfig(input: NotificationConfigInput): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("notifications:manage");
    if (!auth.ok) return auth.error;
    if (!input.from_email.trim()) return { ok: false, message: "กรุณาระบุอีเมลผู้ส่ง" };

    const supabase = createClient();
    const { error } = await supabase
      .from("notification_config")
      .update({
        from_email: input.from_email.trim(),
        email_recipients: input.email_recipients,
        enable_critical_alerts: input.enable_critical_alerts,
        enable_weekly_summary: input.enable_weekly_summary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) return { ok: false, message: error.message };
    await logAudit({ action: "UPDATE", table_name: "notification_config", record_id: "1", new_value: { ...input } });
    revalidatePath("/admin/notifications");
    return { ok: true, message: "บันทึกการตั้งค่าแจ้งเตือนสำเร็จ" };
  });
}

// The email the Monday cron would send now — shown in the settings page, nothing is sent.
// Built with the caller's own client, so RLS shows only the plants they may see.
export async function previewWeeklyDigest(): Promise<{ ok: boolean; message: string; subject?: string; html?: string }> {
  if (isDemoMode()) {
    if (!demoCan("notifications:manage")) return { ok: false, message: "ไม่มีสิทธิ์ดำเนินการนี้ (notifications:manage)" };
  } else {
    const auth = await requirePermission("notifications:manage");
    if (!auth.ok) return auth.error;
  }
  try {
    const email = await buildWeeklyDigest(isDemoMode() ? undefined : createClient());
    return { ok: true, message: "ok", ...email };
  } catch {
    return { ok: false, message: "สร้างตัวอย่างอีเมลไม่สำเร็จ" };
  }
}

// Send the weekly digest now: `test` to up to 3 typed addresses (subject marked [ทดสอบ]),
// otherwise to the SAVED recipients — the same list the cron uses.
export async function sendWeeklyDigestNow(input: { test: boolean; to?: string }): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("notifications:manage");
    if (!auth.ok) return auth.error;

    const cfg = await getNotificationConfig();
    const to = input.test
      ? (input.to ?? "").split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean)
      : cfg.email_recipients;
    if (to.length === 0) return { ok: false, message: input.test ? "กรุณาระบุอีเมลที่จะส่งทดสอบ" : "ยังไม่มีผู้รับที่บันทึกไว้" };
    if (input.test && to.length > 3) return { ok: false, message: "ส่งทดสอบได้สูงสุด 3 อีเมล" };
    if (!to.every((e) => EMAIL_RE.test(e))) return { ok: false, message: "รูปแบบอีเมลไม่ถูกต้อง" };
    if ((input.test ? testLimit : allLimit)(auth.userId)) {
      return { ok: false, message: input.test ? "ส่งทดสอบถี่เกินไป — รอ 1 ชั่วโมงแล้วลองใหม่" : "ส่งให้ผู้รับทั้งหมดได้ไม่เกิน 3 ครั้งต่อวัน" };
    }

    // A test is built from what the caller may see (RLS). Sending to every saved recipient is the
    // cron's fleet-wide email, so only someone who can see every plant may trigger it.
    const own = createClient();
    if (!input.test) {
      const admin = createAdminClient();
      const [mine, all] = await Promise.all([
        own.from("assets").select("id", { count: "exact", head: true }),
        admin.from("assets").select("id", { count: "exact", head: true }),
      ]);
      if (mine.error || all.error) return { ok: false, message: "ตรวจสิทธิ์การเข้าถึงโรงงานไม่สำเร็จ" };
      if ((mine.count ?? 0) < (all.count ?? 0)) {
        return { ok: false, message: "ส่งให้ผู้รับทั้งหมดได้เฉพาะผู้ที่เข้าถึงทุกโรงงาน — ใช้ส่งทดสอบแทน" };
      }
    }
    const email = await buildWeeklyDigest(input.test ? own : createAdminClient());
    const res = await sendEmail({
      to,
      from: cfg.from_email,
      subject: input.test ? `[ทดสอบ] ${email.subject}` : email.subject,
      html: email.html,
    });
    if (!res.ok) return { ok: false, message: res.message };
    await logAudit({ action: "SEND", table_name: "weekly_digest", record_id: input.test ? "test" : "all", new_value: { to: to.length } });
    return { ok: true, message: res.message };
  });
}
