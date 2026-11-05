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
