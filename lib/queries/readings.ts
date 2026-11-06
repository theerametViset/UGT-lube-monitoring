import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getDemoOilHistory, getDemoVibHistory } from "@/lib/demo-data";
import type { OilReading, VibReading } from "@/lib/types";

// Latest readings for an asset. `supabase`: the cron's service-role client (no user session).
export async function getLatestReadings(assetId: string, supabase?: SupabaseClient): Promise<{
  oil: OilReading | null;
  vib: VibReading | null;
}> {
  if (isDemoMode()) {
    const oil = getDemoOilHistory(assetId);
    const vib = getDemoVibHistory(assetId);
    return {
      oil: oil.length ? oil[oil.length - 1] : null,
      vib: vib.length ? vib[vib.length - 1] : null,
    };
  }
  supabase ??= createClient();
  const [oilRes, vibRes] = await Promise.all([
    supabase
      .from("oil_readings")
      .select("period,fe,cu,si,water,visc,tan,iso_code,particle_4,particle_6,particle_14")
      .eq("asset_id", assetId)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vib_readings")
      .select("period,vel,acc,cf,temp")
      .eq("asset_id", assetId)
      .order("period", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    oil: (oilRes.data as OilReading | null) ?? null,
    vib: (vibRes.data as VibReading | null) ?? null,
  };
}

/** getLatestReadings for many assets in a few queries (10 assets each: a reply holds at most 1000 rows). */
export async function getLatestReadingsMany(
  assetIds: string[],
  supabase?: SupabaseClient,
): Promise<Map<string, { oil: OilReading | null; vib: VibReading | null }>> {
  const out = new Map<string, { oil: OilReading | null; vib: VibReading | null }>();
  for (const id of assetIds) out.set(id, { oil: null, vib: null });
  if (isDemoMode()) {
    for (const id of assetIds) out.set(id, { oil: getDemoOilHistory(id).at(-1) ?? null, vib: getDemoVibHistory(id).at(-1) ?? null });
    return out;
  }
  supabase ??= createClient();
  const db = supabase;
  const chunks: string[][] = [];
  // shortcut: rows come newest first, capped at 1000 per chunk — a machine whose latest result is older than
  // ~1000 newer rows of the other 9 (about 8 years of monthly results) loses it; then switch to a latest-per-machine view.
  for (let i = 0; i < assetIds.length; i += 10) chunks.push(assetIds.slice(i, i + 10));
  await Promise.all(
    chunks.flatMap((ids) => [
      db.from("oil_readings").select("asset_id,period,fe,cu,si,water,visc,tan,iso_code,particle_4,particle_6,particle_14").in("asset_id", ids).order("period", { ascending: false }),
      db.from("vib_readings").select("asset_id,period,vel,acc,cf,temp").in("asset_id", ids).order("period", { ascending: false }),
    ]).map(async (q, i) => {
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const kind = i % 2 === 0 ? "oil" : "vib";
      // newest first: the first row seen for an asset is its latest
      for (const row of (data ?? []) as ({ asset_id: string } & Record<string, unknown>)[]) {
        const cur = out.get(row.asset_id);
        if (cur && !cur[kind]) {
          const { asset_id: _a, ...reading } = row;
          cur[kind] = reading as never;
        }
      }
    }),
  );
  return out;
}

// Full readings history (asc by period) for trend charts.
export async function getReadingsHistory(assetId: string): Promise<{
  oil: OilReading[];
  vib: VibReading[];
}> {
  if (isDemoMode()) {
    return {
      oil: getDemoOilHistory(assetId),
      vib: getDemoVibHistory(assetId),
    };
  }
  const supabase = createClient();
  const [oilRes, vibRes] = await Promise.all([
    supabase
      .from("oil_readings")
      .select("period,fe,cu,si,water,visc,tan,iso_code,particle_4,particle_6,particle_14")
      .eq("asset_id", assetId)
      .order("period", { ascending: true }),
    supabase
      .from("vib_readings")
      .select("period,vel,acc,cf,temp")
      .eq("asset_id", assetId)
      .order("period", { ascending: true }),
  ]);
  return {
    oil: (oilRes.data as OilReading[]) ?? [],
    vib: (vibRes.data as VibReading[]) ?? [],
  };
}
