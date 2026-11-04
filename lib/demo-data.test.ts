import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDemoAlarmParams } from "./demo-data";
import { getDeductionBreakdown } from "./scoring/audit";

const sql = (f: string) => readFileSync(join(__dirname, "..", "supabase", f), "utf8");

// alarm_params as the SQL migrations leave it: 0002 seed limits, 0008 penalties,
// 0030 visc row, minus the keys 0031 deletes.
function sqlAlarmParams() {
  const out = new Map<string, { warn: number; crit: number; warnPen?: number; critPen?: number }>();
  for (const m of sql("0002_seed.sql").matchAll(/\('(?:oil|vib)',\s*'(\w+)',\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*([\d.]+),\s*([\d.]+)\)/g)) {
    out.set(m[1], { warn: Number(m[2]), crit: Number(m[3]) });
  }
  for (const m of sql("0008_per_param_penalty.sql").matchAll(/set warn_penalty=([\d.]+), crit_penalty=([\d.]+) where key='(\w+)'/g)) {
    Object.assign(out.get(m[3])!, { warnPen: Number(m[1]), critPen: Number(m[2]) });
  }
  const v = sql("0030_lockdown_and_visc_param.sql").match(/\('oil', 'visc'[\s\S]*?([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\)/)!;
  out.set("visc", { warn: Number(v[1]), crit: Number(v[2]), warnPen: Number(v[3]), critPen: Number(v[4]) });
  const dropped = sql("0031_drop_cu_si_params.sql").match(/delete from public\.alarm_params where .*key in \(([^)]*)\)/)!;
  for (const k of dropped[1].matchAll(/'(\w+)'/g)) out.delete(k[1]);
  return out;
}

describe("Demo alarm params = SQL alarm_params", () => {
  it("has the same parameters, limits and penalties", () => {
    const want = sqlAlarmParams();
    const got = new Map(getDemoAlarmParams().map((p) => [p.key, { warn: p.warn_limit, crit: p.crit_limit, warnPen: p.warn_penalty, critPen: p.crit_penalty }]));
    expect(Object.fromEntries(got)).toEqual(Object.fromEntries(want));
  });
});

describe("readingLevel parity with SQL", () => {
  it("never deducts for a cleared limit (SQL: val > null is not true)", () => {
    const params = getDemoAlarmParams().map((p) => (p.key === "fe" ? { ...p, warn_limit: null, crit_limit: null } : p));
    const cfg = { oil_weight: 100, vib_weight: 0, warn_penalty: 15, crit_penalty: 30 };
    const oil = { fe: 500 } as unknown as Parameters<typeof getDeductionBreakdown>[0];
    expect(getDeductionBreakdown(oil, null, params, cfg).netScore).toBe(100);
  });
});
