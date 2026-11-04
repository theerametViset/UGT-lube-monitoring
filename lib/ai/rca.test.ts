import { describe, it, expect } from "vitest";
import { ruleBasedRcaAnalysis, type RcaContext } from "./rca";
import type { AlarmParam } from "@/lib/types";

const base: RcaContext = {
  asset: { id: "RE-1141", name: "Pump 141", type: "Pump", site: "UT", health: 12, status: "Critical" },
  rca: {
    bearingFatigue: 95,
    lubeFailure: 95,
    misalignment: 67,
    imbalance: 58,
    sealWear: 87,
    contamination: 39,
  },
  oil: { fe: 220.2, water: 1453, tan: 1.377 },
  vib: { vel: 7.93, acc: 13.67 },
  params: [] as AlarmParam[],
};

describe("ruleBasedRcaAnalysis", () => {
  it("names the riskiest failure mode with driving factors", () => {
    const a = ruleBasedRcaAnalysis(base);
    expect(a).toContain("Bearing Fatigue");
    expect(a).toContain("Fe 220.2");
    expect(a).toContain("Peak Accel 13.7");
  });

  it("explains factor levels relative to the critical limit", () => {
    const a = ruleBasedRcaAnalysis(base);
    expect(a).toContain("110% ของวิกฤต 200");
    expect(a).toContain("145% ของวิกฤต 1000");
  });

  it("includes a severity summary and recommendations", () => {
    const a = ruleBasedRcaAnalysis(base);
    expect(a).toContain("ความเสี่ยงสูง");
    expect(a).toContain("ข้อเสนอแนะ");
  });

  it("says there is not enough data when all indices are null", () => {
    const empty: RcaContext = {
      ...base,
      rca: {
        bearingFatigue: null,
        lubeFailure: null,
        misalignment: null,
        imbalance: null,
        sealWear: null,
        contamination: null,
      },
    };
    const a = ruleBasedRcaAnalysis(empty);
    expect(a).toContain("ยังไม่มีข้อมูล");
  });
});
