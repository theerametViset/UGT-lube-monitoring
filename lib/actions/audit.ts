"use server";

import { getLatestReadings } from "@/lib/queries/readings";
import { getAsset } from "@/lib/queries/assets";
import { getAssetAlarmConfig } from "@/lib/queries/alarms";
import { BLANK_OIL, BLANK_VIB } from "@/lib/local-store";
import { getDeductionBreakdown, readingLevel, type DeductionBreakdown, type ReadingLevel } from "@/lib/scoring/audit";
import type { AlarmParam, OilReading, ScoreConfig, VibReading } from "@/lib/types";

// Live audit preview: computes the deduction breakdown for an asset using the
// CURRENT (possibly unsaved) threshold values passed from the form. Runs the
// SAME penalty math as the DB compute_health (display only).
export async function getAssetAudit(input: {
  assetId: string;
  params: AlarmParam[];
  scoreConfig: ScoreConfig;
}): Promise<DeductionBreakdown> {
  try {
    const [{ oil, vib }, asset] = await Promise.all([getLatestReadings(input.assetId), getAsset(input.assetId)]);
    return getDeductionBreakdown(oil, vib, input.params, input.scoreConfig, asset?.vg_grade);
  } catch (e) {
    console.error("[getAssetAudit]", e);
    return getDeductionBreakdown(null, null, input.params, input.scoreConfig);
  }
}

export interface ReadingPreview {
  current: DeductionBreakdown;
  preview: DeductionBreakdown;
  levels: Record<string, ReadingLevel>;
  // A newer reading already exists, so saving this one won't change the score.
  olderThanLatest: boolean;
}


// What the asset's Health Score would become if this (unsaved) reading were
// saved — same formula and the asset's own effective config, display only.
export async function previewReading(input: {
  assetId: string;
  kind: "oil" | "vib";
  period: string;
  values: Record<string, number>;
}): Promise<ReadingPreview | null> {
  try {
    const [asset, latest, alarm] = await Promise.all([
      getAsset(input.assetId),
      getLatestReadings(input.assetId),
      getAssetAlarmConfig(input.assetId),
    ]);
    if (!asset) return null;
    const vg = asset.vg_grade;
    const current = getDeductionBreakdown(latest.oil, latest.vib, alarm.params, alarm.scoreConfig, vg);

    const existing = input.kind === "oil" ? latest.oil : latest.vib;
    const olderThanLatest = !!existing && existing.period > input.period;
    const oil = input.kind === "oil" && !olderThanLatest ? { ...BLANK_OIL, period: input.period, ...input.values } : latest.oil;
    const vib = input.kind === "vib" && !olderThanLatest ? { ...BLANK_VIB, period: input.period, ...input.values } : latest.vib;
    const preview = getDeductionBreakdown(oil, vib, alarm.params, alarm.scoreConfig, vg);

    const levels: Record<string, ReadingLevel> = {};
    for (const p of alarm.params.filter((x) => x.category === input.kind)) {
      const v = input.values[p.key];
      if (v != null) levels[p.key] = readingLevel(p, v, vg);
    }
    return { current, preview, levels, olderThanLatest };
  } catch (e) {
    console.error("[previewReading]", e);
    return null;
  }
}
