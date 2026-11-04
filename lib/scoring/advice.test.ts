import { describe, expect, it } from "vitest";
import { actionReason, comboNote, readingAdvice } from "./advice";
import type { DeductionItem } from "./audit";
import type { OilReading, VibReading } from "@/lib/types";

const item = (over: Partial<DeductionItem>): DeductionItem => ({
  name: "Water Content", reason: "", value: 2500, unit: "ppm", penalty: 35, category: "oil",
  key: "water", level: "crit", limit: 1000, side: "high", ...over,
});

describe("readingAdvice", () => {
  it("shows the crossed limit as a multiple from 1.5× and the Critical action", () => {
    const r = readingAdvice(item({}));
    expect(r.label).toBe("Water Content 2,500 ppm");
    expect(r.badge).toBe("วิกฤต เกิน 2.5 เท่า");
    expect(r.limit).toBe("เกณฑ์ 1,000");
    expect(r.short).toBe("น้ำปนเปื้อน");
    expect(r.action).toContain("Dehydration");
  });

  it("shows a percentage below 1.5× and the 4-week Warning action", () => {
    const r = readingAdvice(item({ name: "Iron (Fe)", key: "fe", value: 130, limit: 100, level: "warn" }));
    expect(r.badge).toBe("เฝ้าระวัง เกิน 30%");
    expect(r.limit).toBe("เกณฑ์ 100");
    expect(r.action).toBe("ติดตามแนวโน้ม เก็บตัวอย่างซ้ำภายใน 4 สัปดาห์");
  });

  it("drops a unit repeated in the name and uses TAN's own Warning action", () => {
    const r = readingAdvice(item({ name: "TAN (mgKOH/g)", unit: "mgKOH/g", key: "tan", value: 1.53, limit: 1, level: "warn" }));
    expect(r.label).toBe("TAN 1.53 mgKOH/g");
    expect(r.action).toContain("ตรวจอุณหภูมิใช้งานและค่าความหนืดประกอบ");
  });

  it("explains low viscosity separately from high", () => {
    const r = readingAdvice(item({ name: "Viscosity @40°C", unit: "cSt", key: "visc", value: 190, limit: 198, side: "low" }));
    expect(r.badge).toBe("วิกฤต ต่ำกว่า 4%");
    expect(r.limit).toBe("เกณฑ์ต่ำสุด 198");
    expect(r.meaning).toContain("ต่ำกว่าเกรด");
  });

  it("uses the vibration re-measure wording for vibration warnings", () => {
    const r = readingAdvice(item({ name: "Velocity RMS", unit: "mm/s", key: "vel", category: "vib", value: 5, limit: 4.5, level: "warn" }));
    expect(r.action).toBe("ติดตามแนวโน้ม วัดซ้ำภายใน 4 สัปดาห์");
  });
});

describe("comboNote", () => {
  it("adds the hydrolysis note only when TAN and water are both out", () => {
    expect(comboNote([item({}), item({ key: "tan" })])).toContain("Hydrolysis");
    expect(comboNote([item({})])).toBeNull();
  });
});

describe("actionReason", () => {
  const cfg = { oil_weight: 100, vib_weight: 0, warn_penalty: 15, crit_penalty: 35 };
  const b = (items: DeductionItem[]) => ({ items, netScore: 0, oilScore: 0, vibScore: 0 });
  const oil = { visc: 220 } as unknown as OilReading;
  const vib = {} as unknown as VibReading;

  it("keeps the two biggest deductions, worst first, with their keys", () => {
    const r = actionReason(b([item({ key: "fe", penalty: 15 }), item({ penalty: 35 }), item({ key: "tan", penalty: 20 })]), cfg, oil, null, 220);
    expect(r.keys).toEqual(["water", "tan"]);
    expect(r.notes.some((n) => n.includes("Hydrolysis"))).toBe(true);
  });

  it("skips a 0%-weighted category when both categories have readings", () => {
    const r = actionReason(b([item({ key: "vel", category: "vib", penalty: 35 })]), cfg, oil, vib, 220);
    expect(r.advice).toEqual([]);
  });
});
