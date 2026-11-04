"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { requirePermission } from "./guards";
import { logAudit } from "./audit-log";

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
