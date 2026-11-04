import { describe, it, expect } from "vitest";
import { ruleBasedExecSummary } from "./exec-summary";
import type { DashboardData } from "@/lib/queries/assets";

const data = {
  kpis: { total: 100, critical: 5, warning: 10, healthy: 85, avgHealth: 72.5 },
  perSite: [
    { code: "UT", healthy: 10, warning: 5, critical: 4, total: 60, avgHealth: 60 },
    { code: "NY1", healthy: 75, warning: 5, critical: 1, total: 40, avgHealth: 91 },
  ],
  siteReliability: [],
  perType: [
    { type: "Pump", abbr: "PU", color: "#000", healthy: 3, warning: 4, critical: 5, total: 30 },
    { type: "Motor", abbr: "MO", color: "#000", healthy: 82, warning: 6, critical: 0, total: 70 },
  ],
  topCritical: [
    { id: "PU-101", name: "Pump A", site: "UT", health: 35 },
  ] as DashboardData["topCritical"],
  scopedAssets: [],
} as unknown as DashboardData;

describe("ruleBasedExecSummary", () => {
  it("includes the real KPI numbers", () => {
    const s = ruleBasedExecSummary(data);
    expect(s).toContain("100");
    expect(s).toContain("72.5%");
    expect(s).toContain("5");
    expect(s).toContain("10");
  });

  it("names the worst site", () => {
    const s = ruleBasedExecSummary(data);
    expect(s).toContain("โรงงาน UT");
    expect(s).toContain("60%");
  });

  it("names the riskiest asset type", () => {
    const s = ruleBasedExecSummary(data);
    expect(s).toContain("Pump");
  });

  it("recommends action on critical assets", () => {
    const s = ruleBasedExecSummary(data);
    expect(s).toContain("PU-101");
    expect(s).toContain("ข้อเสนอแนะ");
  });

  it("flags a healthy fleet without critical assets", () => {
    const healthy = {
      ...data,
      kpis: { total: 10, critical: 0, warning: 1, healthy: 9, avgHealth: 92 },
      topCritical: [] as DashboardData["topCritical"],
      perType: data.perType.map((t) => ({ ...t, critical: 0 })),
    } as unknown as DashboardData;
    const s = ruleBasedExecSummary(healthy);
    expect(s).toContain("92%");
    expect(s).toContain("อยู่ในเกณฑ์ปกติ");
  });
});
