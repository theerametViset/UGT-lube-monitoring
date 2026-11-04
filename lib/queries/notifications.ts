import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { NotificationConfig } from "@/lib/types";

const DEMO_CONFIG: NotificationConfig = {
  id: 1,
  from_email: "alerts@ugt-reliability.com",
  email_recipients: ["engineer@ugt.co.th", "manager@ugt.co.th"],
  enable_critical_alerts: true,
  enable_weekly_summary: false,
};

// `supabase` is passed only by the cron route, which has no user session.
export async function getNotificationConfig(supabase?: SupabaseClient): Promise<NotificationConfig> {
  if (isDemoMode()) return DEMO_CONFIG;
  supabase ??= createClient();
  const { data } = await supabase.from("notification_config").select("*").eq("id", 1).maybeSingle();
  return (data as NotificationConfig) ?? DEMO_CONFIG;
}
