import { describe, it, expect } from "vitest";
import { getDeductionBreakdown, readingLevel } from "./audit";
import type { AlarmParam, OilReading, ScoreConfig, VibReading } from "@/lib/types";

const oil = (o: Partial<OilReading>) =>
  ({
    period: "2026-07",
    fe: null,
    cu: null,
    si: null,
    water: null,
    visc: null,
    tan: null,
    iso_code: null,
    particle_4: null,
    particle_6: null,
    particle_14: null,
    ...o,
  }) as OilReading;

const vib = (v: Partial<VibReading>) =>
  ({ period: "2026-07", vel: null, acc: null, cf: null, temp: null, ...v }) as VibReading;

const param = (p: Partial<AlarmParam> & Pick<AlarmParam, "category" | "key">): AlarmParam => ({
  id: p.key,
  name: p.key,
  unit: null,
  description: null,
  warn_limit: null,
  crit_limit: null,
  warn_penalty: null,
  crit_penalty: null,
  ...p,
});

const PARAMS: AlarmParam[] = [
  param({ category: "oil", key: "fe", name: "Iron (Fe)", unit: "ppm", warn_limit: 50, crit_limit: 100 }),
  param({ category: "oil", key: "water", name: "Water", unit: "ppm", warn_limit: 200, crit_limit: 500 }),
  param({ category: "vib", key: "vel", name: "Velocity", unit: "mm/s", warn_limit: 4.5, crit_limit: 7.1 }),
  param({ category: "vib", key: "temp", name: "Temperature", unit: "°C", warn_limit: 70, crit_limit: 90 }),
];

const CFG: ScoreConfig = { oil_weight: 60, vib_weight: 40, warn_penalty: 10, crit_penalty: 30 };

describe("readingLevel", () => {
  const fe = PARAMS[0]; // warn 50, crit 100
  it("is ok for a null value or below warn", () => {
    expect(readingLevel(fe, null)).toBe("ok");
    expect(readingLevel(fe, 10)).toBe("ok");
    expect(readingLevel(fe, 50)).toBe("ok");
  });
  it("is warn anywhere above warn up to crit", () => {
    expect(readingLevel(fe, 51)).toBe("warn");
    expect(readingLevel(fe, 100)).toBe("warn");
  });
  it("is crit above crit", () => {
    expect(readingLevel(fe, 101)).toBe("crit");
  });
});

describe("step penalty", () => {
  const fePenalty = (v: number) => getDeductionBreakdown(oil({ fe: v }), null, PARAMS, CFG).items[0]?.penalty ?? 0;
  it("applies the flat warn penalty anywhere between warn and crit (step, not interpolated)", () => {
    expect(fePenalty(75)).toBe(10);
    expect(fePenalty(99)).toBe(10);
  });
  it("applies the flat crit penalty above crit", () => {
    expect(fePenalty(150)).toBe(30);
  });
  it("deducts nothing below warn", () => {
    expect(fePenalty(10)).toBe(0);
  });
});

describe("getDeductionBreakdown", () => {
  it("falls back to netScore 100 with no readings at all", () => {
    const b = getDeductionBreakdown(null, null, PARAMS, CFG);
    expect(b.netScore).toBe(100);
    expect(b.oilScore).toBe(100);
    expect(b.vibScore).toBe(100);
    expect(b.items).toHaveLength(2);
    expect(b.items.every((it) => it.penalty === 0)).toBe(true);
  });

  it("tags every deduction item with its category (oil vs vib)", () => {
    const b = getDeductionBreakdown(oil({ fe: 150 }), vib({ vel: 10 }), PARAMS, CFG);
    expect(b.items.every((it) => it.category === "oil" || it.category === "vib")).toBe(true);
    expect(b.items.find((it) => it.name === "Iron (Fe)")?.category).toBe("oil");
    expect(b.items.find((it) => it.name === "Velocity")?.category).toBe("vib");
  });

  it("computes oil-only score when only an oil reading exists", () => {
    // fe=150 > crit(100) => full crit_penalty (30) off oilScore
    const b = getDeductionBreakdown(oil({ fe: 150 }), null, PARAMS, CFG);
    expect(b.oilScore).toBe(70);
    expect(b.vibScore).toBe(100);
    expect(b.netScore).toBe(70); // oil-only reading => raw = oilScore directly
    expect(b.items).toHaveLength(1);
    expect(b.items[0].category).toBe("oil");
  });

  it("computes vib-only score when only a vibration reading exists", () => {
    // vel=10 > crit(7.1) => full crit_penalty (30) off vibScore
    const b = getDeductionBreakdown(null, vib({ vel: 10 }), PARAMS, CFG);
    expect(b.vibScore).toBe(70);
    expect(b.oilScore).toBe(100);
    expect(b.netScore).toBe(70);
  });

  it("blends oil and vib scores by their configured weights when both exist", () => {
    // oilScore = 70 (fe crit), vibScore = 70 (vel crit)
    // blended = (70*60 + 70*40)/100 = 70
    const b = getDeductionBreakdown(oil({ fe: 150 }), vib({ vel: 10 }), PARAMS, CFG);
    expect(b.oilScore).toBe(70);
    expect(b.vibScore).toBe(70);
    expect(b.netScore).toBe(70);
  });

  it("blends asymmetric scores using oil_weight/vib_weight, not a flat average", () => {
    // oilScore stays 100 (no oil penalty), vibScore = 70 (vel crit)
    // blended = (100*60 + 70*40)/100 = 88, NOT (100+70)/2 = 85
    const b = getDeductionBreakdown(oil({ fe: 10 }), vib({ vel: 10 }), PARAMS, CFG);
    expect(b.oilScore).toBe(100);
    expect(b.vibScore).toBe(70);
    expect(b.netScore).toBe(88);
  });

  it("floors oilScore and vibScore at 0 independently even with stacked penalties", () => {
    const heavyParams: AlarmParam[] = [
      param({ category: "oil", key: "fe", name: "Fe", warn_limit: 50, crit_limit: 100, crit_penalty: 60 }),
      param({ category: "oil", key: "water", name: "Water", warn_limit: 200, crit_limit: 500, crit_penalty: 60 }),
    ];
    const b = getDeductionBreakdown(oil({ fe: 500, water: 900 }), null, heavyParams, CFG);
    // Two stacked crit penalties of 60 each would go to -20, but must floor at 0.
    expect(b.oilScore).toBe(0);
    expect(b.netScore).toBe(0);
  });

  it("never lists more than 100 points of deductions in one category", () => {
    const heavyParams: AlarmParam[] = [
      param({ category: "oil", key: "fe", name: "Fe", warn_limit: 50, crit_limit: 100, crit_penalty: 60 }),
      param({ category: "oil", key: "water", name: "Water", warn_limit: 200, crit_limit: 500, crit_penalty: 60 }),
    ];
    const b = getDeductionBreakdown(oil({ fe: 500, water: 900 }), null, heavyParams, CFG);
    expect(b.items.reduce((s, it) => s + it.penalty, 0)).toBe(100);
    const capped = b.items.filter((it) => it.cappedFrom != null);
    expect(capped).toHaveLength(1);
    expect(capped[0].penalty).toBe(40);
    expect(capped[0].cappedFrom).toBe(60);
  });

  it("keeps a reading in the list with 0 taken when the category was already at 0", () => {
    const heavyParams: AlarmParam[] = [
      param({ category: "oil", key: "fe", name: "Fe", warn_limit: 50, crit_limit: 100, crit_penalty: 100 }),
      param({ category: "oil", key: "water", name: "Water", warn_limit: 200, crit_limit: 500, crit_penalty: 30 }),
    ];
    const b = getDeductionBreakdown(oil({ fe: 500, water: 900 }), null, heavyParams, CFG);
    const water = b.items.find((it) => it.name === "Water")!;
    expect(water.penalty).toBe(0);
    expect(water.cappedFrom).toBe(30);
    expect(b.oilScore).toBe(0);
  });

  it("caps oil and vib separately", () => {
    const b = getDeductionBreakdown(oil({ fe: 150 }), vib({ vel: 10 }), PARAMS, CFG);
    expect(b.items.every((it) => it.cappedFrom == null)).toBe(true);
  });

  it("ignores null-valued params (no reading for that key) without throwing", () => {
    const b = getDeductionBreakdown(oil({ fe: null, water: 900 }), null, PARAMS, CFG);
    expect(b.items).toHaveLength(1);
    expect(b.items[0].name).toBe("Water");
  });
});

describe("viscosity uses the asset's VG grade, not the stored limits", () => {
  // Stored limits 242/264 are deliberately different from the VG 220 bands
  // (warn 209–231, crit <198 or >242) so these tests prove they're ignored.
  const VISC: AlarmParam[] = [
    param({ category: "oil", key: "visc", name: "Viscosity", unit: "cSt", warn_limit: 242, crit_limit: 264, warn_penalty: 10, crit_penalty: 25 }),
  ];
  const visc = (v: number) => getDeductionBreakdown(oil({ visc: v }), null, VISC, CFG, 220);

  it("deducts nothing inside VG ±5%", () => {
    expect(visc(220).items).toHaveLength(0);
    expect(visc(231).items).toHaveLength(0);
    expect(visc(209).items).toHaveLength(0);
  });
  it("applies the warn penalty above +5%, even though the stored warn limit is higher", () => {
    expect(visc(235).items[0].penalty).toBe(10);
  });
  it("applies the crit penalty above +10%", () => {
    expect(visc(250).items[0].penalty).toBe(25);
  });
  it("penalizes low viscosity too, and says so in the reason", () => {
    const warnLow = visc(205).items[0];
    expect(warnLow.penalty).toBe(10);
    expect(warnLow.reason).toContain("ต่ำกว่า");
    const critLow = visc(190).items[0];
    expect(critLow.penalty).toBe(25);
    expect(critLow.reason).toContain("Critical");
  });
});
