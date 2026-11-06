import { z } from "zod";

export const AssetIdSchema = z.object({ assetId: z.string().trim().min(1).max(50) });

export const StandardQuerySchema = z.object({
  id: z.string().trim().min(1).max(50),
  question: z.string().trim().max(1000).optional(),
});

export const SearchQuerySchema = z.object({ q: z.string().trim().max(100) });

export const CompareQuerySchema = z.object({ id: z.string().trim().min(1).max(50) });

// Health = oil × oil% + vib × vib% (compute_health), so the weights in use must add to 100:
// 60/60 lifts a critical machine to warning, 40/40 caps a healthy one at 80. An empty
// per-machine weight falls back to the system-wide one, as in SQL (coalesce).
export const WEIGHT_MSG = "น้ำหนัก Oil + Vibration ต้องอยู่ระหว่าง 0–100 และรวมกันได้ 100";
export function weightsOk(
  oil: number | null | undefined,
  vib: number | null | undefined,
  base: { oil_weight: number; vib_weight: number } = { oil_weight: NaN, vib_weight: NaN },
): boolean {
  const o = oil ?? base.oil_weight;
  const v = vib ?? base.vib_weight;
  return [o, v].every((w) => Number.isFinite(w) && w >= 0 && w <= 100) && Math.abs(o + v - 100) < 1e-9;
}
