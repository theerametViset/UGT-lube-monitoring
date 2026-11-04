import { describe, it, expect } from "vitest";
import { getRcaProbabilities } from "./rca";
import type { OilReading, VibReading } from "@/lib/types";

const oil = (o: Partial<OilReading>) => ({ period: "2026-07", ...o }) as OilReading;
const vib = (v: Partial<VibReading>) => ({ period: "2026-07", ...v }) as VibReading;

describe("getRcaProbabilities", () => {
  it("returns all null when there is no oil AND no vib reading", () => {
    const rca = getRcaProbabilities(null, null, []);
    expect(rca).toEqual({
      bearingFatigue: null,
      lubeFailure: null,
      misalignment: null,
      imbalance: null,
      sealWear: null,
      contamination: null,
    });
  });

  it("only scores oil-driven modes when vib is missing", () => {
    const rca = getRcaProbabilities(oil({ fe: 100, water: 500, tan: 0.5 }), null, []);
    expect(rca.lubeFailure).toBe(40);
    expect(rca.contamination).toBe(40);
    expect(rca.sealWear).toBe(33);
    // Vib-driven modes have no data → null, not a default-based number.
    expect(rca.misalignment).toBeNull();
    expect(rca.imbalance).toBeNull();
    expect(rca.bearingFatigue).toBeNull(); // needs both oil (fe) and vib (acc)
  });

  it("only scores vib-driven modes when oil is missing", () => {
    const rca = getRcaProbabilities(null, vib({ vel: 7.1, acc: 10 }), []);
    expect(rca.misalignment).toBe(60);
    expect(rca.imbalance).toBe(50);
    expect(rca.lubeFailure).toBeNull();
    expect(rca.contamination).toBeNull();
    expect(rca.bearingFatigue).toBeNull();
  });

  it("computes all modes when both readings exist", () => {
    const rca = getRcaProbabilities(
      oil({ fe: 100, water: 500, tan: 0.5 }),
      vib({ vel: 3.55, acc: 5 }),
      [],
    );
    expect(rca.bearingFatigue).not.toBeNull();
    expect(rca.misalignment).toBe(30); // (3.55/7.1)*60
    expect(rca.imbalance).toBe(25); // (3.55/7.1)*40 + (5/10)*10
  });

  it("clamps extreme values to 95", () => {
    const rca = getRcaProbabilities(
      oil({ fe: 400, water: 3000, tan: 2 }),
      vib({ vel: 20, acc: 25 }),
      [],
    );
    expect(rca.bearingFatigue).toBe(95);
    expect(rca.lubeFailure).toBe(95);
    expect(rca.misalignment).toBe(95);
    expect(rca.contamination).toBe(95);
  });

  it("clamps near-zero values to the 2 floor", () => {
    const rca = getRcaProbabilities(
      oil({ fe: 1, water: 1, tan: 0.01 }),
      vib({ vel: 0.1, acc: 0.1 }),
      [],
    );
    expect(rca.lubeFailure).toBe(2);
    expect(rca.misalignment).toBe(2);
  });

  it("respects custom crit limits from alarm params", () => {
    const params = [
      { id: 1, category: "oil", key: "fe", name: "Iron", unit: "ppm", warn_limit: 100, crit_limit: 100 },
      { id: 2, category: "vib", key: "acc", name: "Peak Accel", unit: "g-PK", warn_limit: 5, crit_limit: 10 },
    ] as unknown as import("@/lib/types").AlarmParam[];
    // fe == crit (100/100) -> 55; acc contribution is 0 -> total 55
    const rca = getRcaProbabilities(oil({ fe: 100 }), vib({ vel: 0.5, acc: 0 }), params);
    expect(rca.bearingFatigue).toBe(55);
  });
});
