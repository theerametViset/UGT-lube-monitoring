/**
 * Viscosity alarm limits based on ISO 3448:1992
 * Reference: PM_Master_Plan_Lubrication_2026_Equipment.xlsx
 *
 * Warning  = ±5%  of ISO VG nominal
 * Critical = ±10% of ISO VG nominal
 *
 *   warn_limit = nominal × 1.05  (upper warn)
 *   crit_limit = nominal × 1.10  (upper crit)
 *   warn_min   = nominal × 0.95  (lower warn)
 *   crit_min   = nominal × 0.90  (lower crit)
 */

export interface ViscosityLimits {
  normalMin: number;  // nominal × 0.95  (lower warning)
  normalMax: number;  // nominal × 1.05  (upper warning)
  cautionMin: number; // nominal × 0.90  (lower critical)
  cautionMax: number; // nominal × 1.10  (upper critical)
  warn: number;       // = normalMax  (upper warning threshold)
  crit: number;       // = cautionMax (upper critical threshold)
}

// Warning / Critical cell text for criteria tables. With a grade (one asset)
// it shows that asset's real bands; without one (fleet-wide views, global
// config) it shows the rule, since the numbers differ per asset.
export function viscCriteriaText(vgGrade?: number | null): { warn: string; crit: string } {
  if (!vgGrade) return { warn: "±5% ของ VG", crit: "±10% ของ VG" };
  const l = getViscosityLimits(vgGrade);
  return { warn: `< ${l.normalMin} หรือ > ${l.warn}`, crit: `< ${l.cautionMin} หรือ > ${l.crit}` };
}

export function getViscosityLimits(vgGrade: number): ViscosityLimits {
  const normalMin = Math.round(vgGrade * 0.95 * 100) / 100;
  const normalMax = Math.round(vgGrade * 1.05 * 100) / 100;
  const cautionMin = Math.round(vgGrade * 0.90 * 100) / 100;
  const cautionMax = Math.round(vgGrade * 1.10 * 100) / 100;
  return {
    normalMin,
    normalMax,
    cautionMin,
    cautionMax,
    warn: normalMax,
    crit: cautionMax,
  };
}

// ISO 3448 viscosity grades.
export const ISO_VG = [2, 3, 5, 7, 10, 15, 22, 32, 46, 68, 100, 150, 220, 320, 460, 680, 1000, 1500, 2200, 3200];

// A measured viscosity at least 2× off the asset's grade is not wear — the grade
// on record is almost certainly wrong (e.g. VG 2 entered for a VG 220 gearbox),
// and every viscosity score for that asset is then wrong too. Returns the grade
// the reading is closest to, or null when the grade looks plausible.
export function suspectVgGrade(visc: number | null | undefined, vgGrade: number | null | undefined): number | null {
  if (visc == null || !(visc > 0) || !vgGrade) return null;
  if (visc / vgGrade < 2 && vgGrade / visc < 2) return null;
  return ISO_VG.reduce((best, g) => (Math.abs(Math.log(visc / g)) < Math.abs(Math.log(visc / best)) ? g : best));
}
