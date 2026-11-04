import { describe, expect, it } from "vitest";
import { assetIssues } from "./asset-issues";

const asset = (over: Partial<Parameters<typeof assetIssues>[0]>) => ({ id: "12-P11", vg_grade: 220, oil_brand: "MOBIL", oil_qty_l: 19, oil_change_months: 12, ...over });

describe("assetIssues", () => {
  it("passes a complete, consistent asset", () => {
    expect(assetIssues(asset({}), { visc: 230 })).toEqual([]);
  });
  it("flags a VG the measured viscosity contradicts", () => {
    expect(assetIssues(asset({ vg_grade: 2 }), { visc: 218 })).toEqual(["vg_mismatch", "vg_2"]);
  });
  it("flags missing and non-standard grades", () => {
    expect(assetIssues(asset({ vg_grade: 0 }), { visc: null })).toEqual(["vg_missing"]);
    expect(assetIssues(asset({ vg_grade: 329 }), { visc: null })).toEqual(["vg_nonstandard"]);
  });
  it("flags missing oil info, odd ids and no readings", () => {
    expect(assetIssues(asset({ id: "34-U02A* (VCU)", oil_brand: "", oil_qty_l: 0 }), null)).toEqual(["oil_info", "odd_id", "no_readings"]);
    expect(assetIssues(asset({ oil_change_months: 0 }), { visc: 230 })).toEqual(["oil_info"]);
    // a lubrication point of a split machine is named on purpose
    expect(assetIssues(asset({ id: "31-A02 (Gear Box)" }), null)).not.toContain("odd_id");
    expect(assetIssues(asset({ id: "NEW EQS. No.1" }), null)).toContain("odd_id");
  });
});
