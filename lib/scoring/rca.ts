// DISPLAY-ONLY rule-based Root Cause Analysis (parity prototype rrca/intelH).
// Heuristic failure-mode risk indices (0-100) from the latest readings + thresholds.
//
// Values are `null` when the sensor data a mode depends on is missing — the UI
// shows those modes as "ไม่มีข้อมูล" instead of hiding missing data behind fake
// defaults (which made machines with no readings look mildly at risk).
import type { AlarmParam, OilReading, VibReading } from "@/lib/types";

const clamp = (n: number) => Math.max(2, Math.min(95, Math.round(n)));
const num = (o: Record<string, number | null> | null, k: string, d: number) =>
  o && o[k] != null ? (o[k] as number) : d;

export interface RcaProbabilities {
  bearingFatigue: number | null;
  lubeFailure: number | null;
  misalignment: number | null;
  imbalance: number | null;
  sealWear: number | null;
  contamination: number | null;
}

export function getRcaProbabilities(
  oil: OilReading | null,
  vib: VibReading | null,
  params: AlarmParam[],
): RcaProbabilities {
  const lim = (cat: string, key: string) =>
    params.find((p) => p.category === cat && p.key === key);
  const feC = lim("oil", "fe")?.crit_limit ?? 200;
  const waterC = lim("oil", "water")?.crit_limit ?? 1000;
  const tanC = lim("oil", "tan")?.crit_limit ?? 1.0;
  const velC = lim("vib", "vel")?.crit_limit ?? 7.1;
  const accC = lim("vib", "acc")?.crit_limit ?? 10;

  const o = oil as unknown as Record<string, number | null> | null;
  const v = vib as unknown as Record<string, number | null> | null;
  const hasOil = o != null;
  const hasVib = v != null;

  // A mode is `null` (shown as "ไม่มีข้อมูล") unless every sensor it needs is
  // present — never invent a risk score from missing data.
  const bearingFatigue =
    hasOil && hasVib ? clamp((num(o, "fe", 0) / feC) * 55 + (num(v, "acc", 0) / accC) * 25) : null;
  const lubeFailure = hasOil ? clamp((num(o, "water", 0) / waterC) * 50 + (num(o, "tan", 0) / tanC) * 30) : null;
  const misalignment = hasVib ? clamp((num(v, "vel", 0) / velC) * 60) : null;
  const imbalance = hasVib ? clamp((num(v, "vel", 0) / velC) * 40 + (num(v, "acc", 0) / accC) * 10) : null;
  const sealWear = hasOil ? clamp((num(o, "water", 0) / waterC) * 45 + (num(o, "fe", 0) / feC) * 20) : null;
  // Water only: Si is not measured (dropped 2026-10-28); weight 80 keeps the old 0-100 range.
  const contamination = hasOil ? clamp((num(o, "water", 0) / waterC) * 80) : null;

  return {
    bearingFatigue,
    lubeFailure,
    misalignment,
    imbalance,
    sealWear,
    contamination,
  };
}
