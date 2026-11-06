import { describe, it, expect } from "vitest";
import { ruleBasedExecSummary } from "./exec-summary";
import { cleanEdits, reportNumber, criticalLine, execHeadline, execVerdict, reportActionAssets, reportTexts, scopeReport, warningLine } from "@/lib/exec-summary-text";
import type { DashboardData } from "@/lib/queries/assets";
import type { ActionReason } from "@/lib/scoring/advice";

const data = {
  kpis: { total: 569, critical: 1, warning: 6, healthy: 562, avgHealth: 99.4 },
  perSite: [
    { code: "CPL", healthy: 135, warning: 0, critical: 0, total: 135, avgHealth: 99.7 },
    { code: "TSL", healthy: 243, warning: 5, critical: 1, total: 249, avgHealth: 98.9 },
    { code: "UNT", healthy: 152, warning: 1, critical: 0, total: 153, avgHealth: 99.7 },
  ],
  siteReliability: [
    { code: "CPL", healthy: 135, warning: 0, critical: 0, total: 135, avgHealth: 99.7 },
    { code: "TSL", healthy: 243, warning: 5, critical: 1, total: 249, avgHealth: 98.9 },
    { code: "UNT", healthy: 152, warning: 1, critical: 0, total: 153, avgHealth: 99.7 },
  ],
  perType: [{ type: "Blower", abbr: "BL", color: "#000", healthy: 0, warning: 0, critical: 1, total: 1 }, { type: "Pump", abbr: "PU", color: "#000", healthy: 1, warning: 1, critical: 0, total: 2 }],
  topCritical: [
    { id: "01-B01-A", name: "ADSORBER BLOWER A", site: "TSL", health: 15, status: "Critical" },
    { id: "12-P11", name: "MELT PUMP", site: "UNT", health: 50, status: "Warning" },
  ] as DashboardData["topCritical"],
  scopedAssets: [
    { id: "01-B01-A", name: "ADSORBER BLOWER A", site: "TSL", type: "Blower", health: 15, status: "Critical" },
    { id: "12-P11", name: "MELT PUMP", site: "UNT", type: "Pump", health: 50, status: "Warning" },
    { id: "12-P12", name: "PUMP B", site: "UNT", type: "Pump", health: 100, status: "Healthy" },
  ] as DashboardData["scopedAssets"],
} as unknown as DashboardData;

const tan: ActionReason = {
  keys: ["tan"],
  notes: [],
  advice: [{ level: "crit", label: "TAN 2 mgKOH/g", badge: "วิกฤต เกิน 2 เท่า", limit: "เกณฑ์ 1", short: "น้ำมันเสื่อม กรดสูง", meaning: null, action: "เปลี่ยนน้ำมันและไส้กรอง" }],
};

describe("ruleBasedExecSummary", () => {
  it("writes headline, each critical machine with its cause, then the warnings per plant", () => {
    const parts = ruleBasedExecSummary(data, { "01-B01-A": tan }).split("\n\n");
    expect(parts).toEqual([
      "มี 1 เครื่องต้องแก้ไขด่วนที่โรงงาน TSL และ 6 เครื่องอยู่ระหว่างเฝ้าระวัง",
      "ADSORBER BLOWER A (01-B01-A, TSL) น้ำมันเสื่อม กรดสูง (TAN 2 mgKOH/g เกิน 2 เท่า) ควรเปลี่ยนน้ำมันและไส้กรอง",
      "เครื่องเฝ้าระวัง 6 เครื่อง (TSL 5, UNT 1) ค่าเกินเกณฑ์เล็กน้อย ให้เก็บตัวอย่างซ้ำในรอบถัดไป ยังไม่ต้องหยุดเครื่อง",
    ]);
  });

  it("never puts % on the score or mentions the fleet average", () => {
    const s = ruleBasedExecSummary(data);
    expect(s).not.toContain("%");
    expect(s).not.toContain("99.4");
  });

  it("lists only critical machines as urgent, not warnings", () => {
    expect(ruleBasedExecSummary(data)).not.toContain("MELT PUMP");
  });
});

describe("exec summary wording", () => {
  it("headline covers every situation", () => {
    const sites = data.perSite;
    expect(execHeadline({ critical: 0, warning: 3 }, sites)).toBe("ไม่มีเครื่องที่ต้องแก้ไขด่วน มี 3 เครื่องอยู่ระหว่างเฝ้าระวัง");
    expect(execHeadline({ critical: 0, warning: 0 }, sites)).toBe("ทุกเครื่องอยู่ในเกณฑ์ปกติ ไม่มีเครื่องที่ต้องแก้ไขด่วนหรือเฝ้าระวัง");
    expect(warningLine({ critical: 0, warning: 0 }, sites)).toBeNull();
  });

  it("falls back to the score when a machine has no advice", () => {
    expect(criticalLine({ id: "X-1", name: "PUMP", site: "CPL", health: 30 })).toBe("PUMP (X-1, CPL) Health Score 30 ควรตรวจสอบผลแล็บล่าสุดในหน้ารายละเอียดเครื่อง");
  });

  it("verdict follows the counts, not the average", () => {
    expect(execVerdict({ critical: 1, warning: 0 }).tone).toBe("crit");
    expect(execVerdict({ critical: 0, warning: 2 }).tone).toBe("warn");
    expect(execVerdict({ critical: 0, warning: 0 }).tone).toBe("ok");
    const v = execVerdict(data.kpis, data.siteReliability);
    expect(`${v.label} ${v.detail}`).toBe("ต้องดำเนินการแก้ไข พบเครื่องจักรสภาวะวิกฤต 1 เครื่อง (TSL)");
  });
});

describe("scopeReport", () => {
  it("a one-plant report talks about that plant only", () => {
    const unt = scopeReport(data, "UNT");
    expect(unt.kpis).toMatchObject({ critical: 0, warning: 1, total: 153 });
    expect(unt.topCritical.map((a) => a.id)).toEqual(["12-P11"]);
    expect(unt.perType.map((t) => t.type)).toEqual(["Pump"]);
    const s = ruleBasedExecSummary(unt);
    expect(s).not.toContain("TSL");
    expect(s).not.toContain("ADSORBER");
    expect(s).toContain("เครื่องเฝ้าระวัง 1 เครื่อง ค่าเกินเกณฑ์"); // no "(UNT 1)" — one plant
    expect(s.startsWith("โรงงาน UNT: ไม่มีเครื่องที่ต้องแก้ไขด่วน")).toBe(true);
    expect(execVerdict(unt.kpis).tone).toBe("warn");
  });

  it("all plants is unchanged", () => {
    expect(scopeReport(data, "")).toBe(data);
  });

  it("loads causes for the machines every scope can list", () => {
    expect(reportActionAssets(data.scopedAssets).map((a) => a.id)).toEqual(["01-B01-A", "12-P11"]);
  });
});

describe("report edits", () => {
  const tsl = scopeReport(data, "TSL");
  it("an edit replaces only its own slot; numbers stay generated", () => {
    const t = reportTexts(tsl, "TSL", { "01-B01-A": tan }, { headline: "หัวเรื่องใหม่", "rec:Corrective · ≤ 2 สัปดาห์": "ทำทันที" });
    expect(t.headline).toBe("หัวเรื่องใหม่");
    expect(t.recs[0].text).toBe("ทำทันที");
    expect(t.critical[0].what).toContain("TAN 2 mgKOH/g");
  });

  it("an empty edit falls back to the generated text", () => {
    expect(reportTexts(tsl, "TSL", {}, { headline: "   " }).headline).toBe(reportTexts(tsl, "TSL").headline);
  });

  it("cleanEdits keeps only this report's slots, trimmed and capped", () => {
    const t = reportTexts(tsl, "TSL");
    const out = cleanEdits(t, { headline: "  ok  ", "what:NOT-A-MACHINE": "x", kpis: "999", warning: "y".repeat(2000) });
    expect(out).toEqual({ headline: "ok", warning: "y".repeat(1000) });
    expect(cleanEdits(t, "nope")).toEqual({});
  });
});

describe("report number", () => {
  it("uses the Bangkok month even when the server clock (UTC) is still last month", () => {
    // 2026-10-31 20:00 UTC = 2026-11-01 03:00 in Bangkok
    expect(reportNumber("TSL", "exec", new Date("2026-10-31T20:00:00Z"))).toBe("UGT-LUB-2569-11-TSL-EXEC");
    expect(reportNumber("", "board", new Date("2026-11-15T05:00:00Z"))).toBe("UGT-LUB-2569-11-ALL-BOARD");
  });
});
