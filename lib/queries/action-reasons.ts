import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestReadingsMany } from "@/lib/queries/readings";
import { getAlarmConfig, getAssetAlarmConfigs } from "@/lib/queries/alarms";
import { getDeductionBreakdown } from "@/lib/scoring/audit";
import { actionReason, type ActionReason } from "@/lib/scoring/advice";
import type { Asset } from "@/lib/types";

// Why each machine in the action list is losing points (see actionReason) — the Dashboard's
// "ต้องดำเนินการ" list, the reports and the weekly digest email. `supabase`: the cron's service-role client.
export const NO_REASON: ActionReason = { advice: [], notes: [], keys: [] };

export async function getActionReasons(
  assets: Pick<Asset, "id" | "vg_grade">[],
  supabase?: SupabaseClient,
): Promise<Record<string, ActionReason>> {
  const out: Record<string, ActionReason> = {};
  if (!assets.length) return out;
  try {
    // a few queries for all machines (the Reports page asks for up to 50), not four per machine
    const ids = assets.map((a) => a.id);
    const base = await getAlarmConfig(supabase);
    const [readings, configs] = await Promise.all([getLatestReadingsMany(ids, supabase), getAssetAlarmConfigs(ids, base, supabase)]);
    for (const a of assets) {
      const { oil, vib } = readings.get(a.id) ?? { oil: null, vib: null };
      const cfg = configs.get(a.id);
      if (!cfg) { out[a.id] = NO_REASON; continue; }
      const b = getDeductionBreakdown(oil, vib, cfg.params, cfg.scoreConfig, a.vg_grade);
      out[a.id] = actionReason(b, cfg.scoreConfig, oil, vib, a.vg_grade);
    }
  } catch {
    // the page must not crash over its "why" text: machines show without a cause instead
    for (const a of assets) out[a.id] ??= NO_REASON;
  }
  return out;
}
