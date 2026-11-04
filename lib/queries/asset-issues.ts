import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { isDemoMode } from "@/lib/env";
import { getDemoAssets, getDemoOilHistory } from "@/lib/demo-data";
import { getAllAssets } from "@/lib/queries/assets";
import { ISSUES, assetIssues, type IssueKey } from "@/lib/asset-issues";
import type { Asset } from "@/lib/types";

// Every asset with its data issues, grouped by issue (RLS-scoped like the list).
// Only each machine's latest oil reading is read (view latest_oil_readings, 0033),
// so the cost follows the fleet size, not the years of history.
export async function getAssetIssues(): Promise<Record<IssueKey, Asset[]>> {
  let assets: Asset[];
  const latestOil = new Map<string, { visc: number | null }>();
  if (isDemoMode()) {
    assets = getDemoAssets();
    for (const a of assets) {
      const h = getDemoOilHistory(a.id);
      if (h.length) latestOil.set(a.id, h[h.length - 1]);
    }
  } else {
    const supabase = createClient();
    const [all, oil] = await Promise.all([
      getAllAssets(),
      fetchAll<{ asset_id: string; visc: number | null }>((from, to) =>
        supabase.from("latest_oil_readings").select("asset_id,visc").order("asset_id").range(from, to),
      ),
    ]);
    assets = all;
    for (const r of oil) latestOil.set(r.asset_id, r);
  }
  const out = Object.fromEntries(Object.keys(ISSUES).map((k) => [k, [] as Asset[]])) as Record<IssueKey, Asset[]>;
  for (const a of assets) for (const k of assetIssues(a, latestOil.get(a.id) ?? null)) out[k].push(a);
  return out;
}
