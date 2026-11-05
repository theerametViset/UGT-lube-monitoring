import type { SupabaseClient } from "@supabase/supabase-js";
import { getLatestReadings } from "@/lib/queries/readings";
import { getAlarmConfig, getAssetAlarmConfig } from "@/lib/queries/alarms";
import { getDeductionBreakdown } from "@/lib/scoring/audit";
import { actionReason, type ActionReason } from "@/lib/scoring/advice";
import type { Asset } from "@/lib/types";

// Why each machine in the action list is losing points (see actionReason) — the Dashboard's
// "ต้องดำเนินการ" list and the weekly digest email. `supabase`: the cron's service-role client.
export const NO_REASON: ActionReason = { advice: [], notes: [], keys: [] };

export async function getActionReasons(
  assets: Pick<Asset, "id" | "vg_grade">[],
  supabase?: SupabaseClient,
): Promise<Record<string, ActionReason>> {
  const out: Record<string, ActionReason> = {};
  // once, not once per asset; on failure each asset loads its own instead of the page crashing
  const base = await getAlarmConfig(supabase).catch(() => undefined);
  await Promise.all(
    assets.map(async (a) => {
      try {
        const [{ oil, vib }, cfg] = await Promise.all([getLatestReadings(a.id, supabase), getAssetAlarmConfig(a.id, base, supabase)]);
        const b = getDeductionBreakdown(oil, vib, cfg.params, cfg.scoreConfig, a.vg_grade);
        out[a.id] = actionReason(b, cfg.scoreConfig, oil, vib, a.vg_grade);
      } catch {
        out[a.id] = NO_REASON;
      }
    }),
  );
  return out;
}
