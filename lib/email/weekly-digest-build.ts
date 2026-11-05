import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardData } from "@/lib/queries/assets";
import { getActionReasons } from "@/lib/queries/action-reasons";
import { causeLine, weeklyDigestEmail } from "./weekly-digest";

// The weekly digest from live data — one builder for the Monday cron and the manual
// preview / send buttons, so both send the same email. `supabase`: the service-role
// client (the whole fleet, like the cron); omitted in Demo Mode.
export async function buildWeeklyDigest(supabase?: SupabaseClient): Promise<{ subject: string; html: string }> {
  const { data } = await getDashboardData("", supabase);
  const top = data.topCritical.slice(0, 5);
  const reasons = await getActionReasons(top, supabase);
  return weeklyDigestEmail({
    totalAssets: data.kpis.total,
    critical: data.kpis.critical,
    warning: data.kpis.warning,
    healthy: data.kpis.healthy,
    avgHealth: data.kpis.avgHealth,
    topCritical: top.map((a) => ({ id: a.id, name: a.name, health: a.health, cause: causeLine(reasons[a.id]) })),
  });
}
