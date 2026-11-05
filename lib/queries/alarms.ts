import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import {
  getDemoAlarmParams,
  getDemoAssetAlarmOverrides,
  getDemoAssetScoreOverride,
  getDemoScoreConfig,
} from "@/lib/demo-data";
import type { AlarmParam, AssetAlarmOverride, AssetScoreOverride, ScoreConfig } from "@/lib/types";

export interface AlarmConfig {
  params: AlarmParam[];
  scoreConfig: ScoreConfig;
}

export interface AssetAlarmConfig extends AlarmConfig {
  hasOverride: boolean;
}

// `supabase` (here and below): the cron's service-role client; omitted = the user's session.
export async function getAlarmConfig(supabase?: SupabaseClient): Promise<AlarmConfig> {
  if (isDemoMode()) {
    return { params: getDemoAlarmParams(), scoreConfig: getDemoScoreConfig() };
  }
  supabase ??= createClient();
  const [paramsRes, cfgRes] = await Promise.all([
    supabase
      .from("alarm_params")
      .select("id,category,key,name,unit,description,warn_limit,crit_limit,warn_penalty,crit_penalty")
      .order("category")
      .order("key"),
    supabase.from("score_config").select("oil_weight,vib_weight,warn_penalty,crit_penalty").eq("id", 1).maybeSingle(),
  ]);
  if (paramsRes.error) throw new Error(paramsRes.error.message);
  return {
    params: (paramsRes.data ?? []) as AlarmParam[],
    scoreConfig: (cfgRes.data as ScoreConfig) ?? {
      oil_weight: 100,
      vib_weight: 0,
      warn_penalty: 15,
      crit_penalty: 30,
    },
  };
}

async function getAssetAlarmOverrides(assetId: string, supabase?: SupabaseClient): Promise<AssetAlarmOverride[]> {
  if (isDemoMode()) return getDemoAssetAlarmOverrides(assetId);
  supabase ??= createClient();
  const { data } = await supabase.from("asset_alarm_overrides").select("*").eq("asset_id", assetId);
  return (data ?? []) as AssetAlarmOverride[];
}

async function getAssetScoreOverride(assetId: string, supabase?: SupabaseClient): Promise<AssetScoreOverride | null> {
  if (isDemoMode()) return getDemoAssetScoreOverride(assetId);
  supabase ??= createClient();
  const { data } = await supabase.from("asset_score_overrides").select("*").eq("asset_id", assetId).maybeSingle();
  return (data as AssetScoreOverride) ?? null;
}

/** Effective (merged) alarm config for one asset — global config with any
 * asset-level overrides applied on top, param-by-param / field-by-field. */
// `base`: the global config, when the caller already loaded it for many assets.
export async function getAssetAlarmConfig(assetId: string, base?: AlarmConfig, supabase?: SupabaseClient): Promise<AssetAlarmConfig> {
  const [{ params, scoreConfig }, paramOverrides, scoreOverride] = await Promise.all([
    base ?? getAlarmConfig(supabase),
    getAssetAlarmOverrides(assetId, supabase),
    getAssetScoreOverride(assetId, supabase),
  ]);

  const mergedParams = params.map((p) => {
    const ov = paramOverrides.find((o) => o.category === p.category && o.key === p.key);
    if (!ov) return p;
    return {
      ...p,
      warn_limit: ov.warn_limit ?? p.warn_limit,
      crit_limit: ov.crit_limit ?? p.crit_limit,
      warn_penalty: ov.warn_penalty ?? p.warn_penalty,
      crit_penalty: ov.crit_penalty ?? p.crit_penalty,
    };
  });

  const mergedScore: ScoreConfig = scoreOverride
    ? {
        oil_weight: scoreOverride.oil_weight ?? scoreConfig.oil_weight,
        vib_weight: scoreOverride.vib_weight ?? scoreConfig.vib_weight,
        warn_penalty: scoreOverride.warn_penalty ?? scoreConfig.warn_penalty,
        crit_penalty: scoreOverride.crit_penalty ?? scoreConfig.crit_penalty,
      }
    : scoreConfig;

  return {
    params: mergedParams,
    scoreConfig: mergedScore,
    hasOverride: paramOverrides.length > 0 || !!scoreOverride,
  };
}
