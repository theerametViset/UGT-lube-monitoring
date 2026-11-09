import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardData } from "@/lib/queries/assets";
import { getActionReasons } from "@/lib/queries/action-reasons";
import { getLatestLabPeriods } from "@/lib/queries/readings";
import { formatPeriodTh } from "@/lib/format";
import { PER_PLANT, weeklyDigestEmail } from "./weekly-digest";

// The weekly digest from live data — one builder for the Monday cron and the manual
// preview / send buttons, so both send the same email. `supabase`: the service-role
// client (the whole fleet, like the cron); omitted in Demo Mode.
export async function buildWeeklyDigest(supabase?: SupabaseClient): Promise<{ subject: string; html: string }> {
  const { data } = await getDashboardData("", supabase);
  // each plant's worst machines (not the fleet's), at most PER_PLANT, so every plant manager finds their own
  const shown = new Map<string, number>();
  const top = data.scopedAssets
    .filter((a) => a.status !== "Healthy")
    .sort((a, b) => a.health - b.health)
    .filter((a) => {
      const n = shown.get(a.site) ?? 0;
      shown.set(a.site, n + 1);
      return n < PER_PLANT;
    });
  const [reasons, lab] = await Promise.all([
    getActionReasons(top, supabase),
    getLatestLabPeriods(top.map((a) => a.id), supabase),
  ]);
  return weeklyDigestEmail({
    totalAssets: data.kpis.total,
    critical: data.kpis.critical,
    warning: data.kpis.warning,
    healthy: data.kpis.healthy,
    avgHealth: data.kpis.avgHealth,
    sites: data.perSite,
    topCritical: top.map((a) => {
      const advice = reasons[a.id]?.advice ?? [];
      return {
        id: a.id,
        name: a.name,
        site: a.site,
        health: a.health,
        // the same lines as the Dashboard's action list: the badge minus its level word (the dot shows it)
        readings: advice.slice(0, 3).map((r) => ({
          label: r.label,
          over: r.badge.replace(/^(วิกฤต|เฝ้าระวัง)\s*/, "") || r.badge,
          limit: r.limit,
          crit: r.level === "crit",
        })),
        action: advice[0]?.action,
        lab: lab[a.id] ? formatPeriodTh(lab[a.id]) : "",
        cause: reasons[a.id]?.notes[0],
      };
    }),
  });
}
