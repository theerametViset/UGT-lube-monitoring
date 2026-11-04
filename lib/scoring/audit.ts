// Health Score breakdown — TypeScript parity port of compute_health()
// (latest definition: 0020 + 0026 + 0027). Used for the breakdown UI and as the
// demo-mode stand-in for the DB cache; it never writes health back to the DB.
// An asset with no readings at all scores 100.
import { getViscosityLimits } from "@/lib/viscosity-limits";
import type {
  AlarmParam,
  OilReading,
  ScoreConfig,
  VibReading,
} from "@/lib/types";


export interface DeductionItem {
  name: string;
  reason: string;
  value: number;
  unit: string;
  penalty: number; // points actually taken
  // Set when the category had already reached 0, so fewer points were taken
  // than this reading's criteria penalty (which is the value stored here).
  cappedFrom?: number;
  category: "oil" | "vib";
  // Display only (Action Required list): which parameter, how bad, and the
  // limit it crossed on which side. Unset on the "no readings" placeholders.
  key?: string;
  level?: "warn" | "crit";
  limit?: number;
  side?: "high" | "low";
}

// A category score can't go below 0: apply its deductions largest-first and
// stop at 100, so the listed deductions always add up to 100 − category score.
// Returns the total points taken.
function capAt100(items: DeductionItem[]): number {
  let taken = 0;
  for (const it of [...items].sort((a, b) => b.penalty - a.penalty)) {
    const take = Math.min(it.penalty, 100 - taken);
    if (take < it.penalty) it.cappedFrom = it.penalty;
    it.penalty = take;
    taken += take;
  }
  return taken;
}

export interface DeductionBreakdown {
  items: DeductionItem[];
  netScore: number;
  // Separately-clamped 0-100 sub-scores that netScore is weighted-blended
  // from — oil and vib deductions are each floored at 0 independently.
  oilScore: number;
  vibScore: number;
}

export type ReadingLevel = "ok" | "warn" | "crit";

// Step penalty: past Warning deducts the flat Warning penalty, past Critical
// the flat Critical penalty — always one of the two values in the Deduction
// Criteria Reference table (health_penalty() in 0026 / health_penalty_band()
// in 0027 mirror this).
//
// Which band one reading falls in — the only place that decides it, used both
// for scoring and for the Warning/Critical badges on the Data Entry form.
// Viscosity limits always come from the asset's ISO VG grade (ISO 3448,
// ±5% / ±10%, too high OR too low) — alarm_params.warn/crit_limit are not used
// for it. 0027_visc_by_vg_grade.sql mirrors this.
export function readingLevel(p: AlarmParam, val: number | null, vgGrade?: number): ReadingLevel {
  if (val == null) return "ok";
  if (p.key === "visc" && vgGrade) {
    const vl = getViscosityLimits(vgGrade);
    if (val > vl.crit || val < vl.cautionMin) return "crit";
    if (val > vl.warn || val < vl.normalMin) return "warn";
    return "ok";
  }
  // A cleared limit never deducts, like SQL's `val > null` (0026).
  if (p.crit_limit != null && val > p.crit_limit) return "crit";
  if (p.warn_limit != null && val > p.warn_limit) return "warn";
  return "ok";
}

function deductionReason(p: AlarmParam, val: number, level: ReadingLevel, vgGrade?: number): string {
  const unitText = p.unit === "ppm" ? " ppm" : p.unit ? ` ${p.unit}` : "";
  if (p.key === "visc" && vgGrade) {
    const side = val < getViscosityLimits(vgGrade).normalMin ? "ต่ำกว่า" : "สูงกว่า";
    return `${level === "crit" ? "Critical Reading" : "Abnormal Reading"} — ${side}ช่วง VG ${vgGrade} (${val}${unitText})`;
  }
  return `${level === "crit" ? "Critical Reading" : "Abnormal Wear"} (${val}${unitText})`;
}

// The limit a reading crossed for its band, and on which side (viscosity can
// fail low). Same limits as readingLevel.
function crossedLimit(p: AlarmParam, val: number, level: "warn" | "crit", vgGrade?: number): { limit: number; side: "high" | "low" } {
  if (p.key === "visc" && vgGrade) {
    const vl = getViscosityLimits(vgGrade);
    if (val < vl.normalMin) return { limit: level === "crit" ? vl.cautionMin : vl.normalMin, side: "low" };
    return { limit: level === "crit" ? vl.crit : vl.warn, side: "high" };
  }
  return { limit: (level === "crit" ? p.crit_limit : p.warn_limit) ?? 0, side: "high" };
}

export function getDeductionBreakdown(
  oil: OilReading | null,
  vib: VibReading | null,
  params: AlarmParam[],
  cfg: ScoreConfig,
  vgGrade?: number): DeductionBreakdown {
  const hasOil = !!oil;
  const hasVib = !!vib;

  // If we have real readings, compute from readings
  if (hasOil || hasVib) {
    const items: DeductionItem[] = [];

    for (const [category, reading] of [["oil", oil], ["vib", vib]] as const) {
      if (!reading) continue;
      for (const p of params.filter((x) => x.category === category)) {
        const val = (reading as unknown as Record<string, number | null>)[p.key];
        if (val == null) continue;
        const level = readingLevel(p, val, vgGrade);
        const pen = level === "crit" ? p.crit_penalty ?? cfg.crit_penalty
          : level === "warn" ? p.warn_penalty ?? cfg.warn_penalty
          : 0;
        if (pen > 0 && level !== "ok") {
          items.push({
            name: p.name, reason: deductionReason(p, val, level, vgGrade), value: val, unit: p.unit ?? "", penalty: pen, category,
            key: p.key, level, ...crossedLimit(p, val, level, vgGrade),
          });
        }
      }
    }

    // Unrounded on purpose: same as compute_health's greatest(0, 100 − Σ penalty).
    const oilScore = 100 - capAt100(items.filter((i) => i.category === "oil"));
    const vibScore = 100 - capAt100(items.filter((i) => i.category === "vib"));
    for (const it of items) {
      it.penalty = Math.round(it.penalty);
      if (it.cappedFrom != null) it.cappedFrom = Math.round(it.cappedFrom);
    }

    let raw: number;
    if (hasOil && hasVib) {
      raw = (oilScore * cfg.oil_weight + vibScore * cfg.vib_weight) / 100;
    } else if (hasOil) {
      raw = oilScore;
    } else {
      raw = vibScore;
    }

    const netScore = Math.max(0, Math.min(100, Math.round(raw)));
    items.sort((a, b) => b.penalty - a.penalty);
    return { items, netScore, oilScore, vibScore };
  }

  // No readings — asset is at default health (100).
  // Health score decreases ONLY when actual oil/vibration readings exceed thresholds.
  // Show informational items explaining the current state.
  const items: DeductionItem[] = [
    {
      name: "ยังไม่ได้ลงผลตรวจ",
      reason: "ไม่มีผลการวิเคราะห์น้ำมัน (Oil Analysis) — เครื่องจักรอยู่ในสถานะปกติ",
      value: 0,
      unit: "",
      penalty: 0,
      category: "oil",
    },
    {
      name: "ยังไม่ได้ลงผลตรวจ",
      reason: "ไม่มีผลการวัดสั่นสะเทือน (Vibration Analysis) — เครื่องจักรอยู่ในสถานะปกติ",
      value: 0,
      unit: "",
      penalty: 0,
      category: "vib",
    },
  ];
  return { items, netScore: 100, oilScore: 100, vibScore: 100 };
}
