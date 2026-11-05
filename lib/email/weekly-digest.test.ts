import { describe, expect, it } from "vitest";
import { causeLine, weeklyDigestEmail } from "./weekly-digest";

describe("weeklyDigestEmail", () => {
  it("puts the tag and the counts in the subject", () => {
    const { subject } = weeklyDigestEmail({ totalAssets: 569, critical: 5, warning: 14, healthy: 550, avgHealth: 87, topCritical: [] });
    expect(subject).toMatch(/^\[UGT Lube\] สรุปสัปดาห์ \d{1,2} \S+ \d{2} — วิกฤต 5 · เฝ้าระวัง 14$/);
  });

  it("escapes machine names and links each machine to its page", () => {
    const { html } = weeklyDigestEmail({
      totalAssets: 1, critical: 1, warning: 0, healthy: 0, avgHealth: 20,
      topCritical: [{ id: "06-K01 B", name: "<img src=x onerror=alert(1)>", health: 20 }],
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("/assets/06-K01%20B");
    expect(html).toContain("/dashboard?status=Critical");
  });

  it("shows each machine's cause under its name", () => {
    const { html } = weeklyDigestEmail({
      totalAssets: 1, critical: 1, warning: 0, healthy: 0, avgHealth: 20,
      topCritical: [{ id: "A", name: "Pump", health: 20, cause: "TAN 2 mgKOH/g (วิกฤต เกิน 2 เท่า)" }],
    });
    expect(html).toContain("TAN 2 mgKOH/g (วิกฤต เกิน 2 เท่า)");
    expect(html).toContain("ชื่อ / สาเหตุ");
  });

  it("says all is well when nothing needs attention", () => {
    const { html } = weeklyDigestEmail({ totalAssets: 3, critical: 0, warning: 0, healthy: 3, avgHealth: 95, topCritical: [] });
    expect(html).toContain("เครื่องจักรทั้งหมดอยู่ในเกณฑ์ปกติ");
    expect(html).not.toContain("เครื่องวิกฤต 0");
  });
});

describe("causeLine", () => {
  const adv = (label: string) => ({ level: "crit" as const, label, badge: "วิกฤต", limit: null, short: null, meaning: null, action: "" });
  it("lists the two worst readings and counts the rest", () => {
    expect(causeLine({ advice: [adv("TAN 2"), adv("Visc 100"), adv("Fe 300")], notes: [], keys: [] })).toBe("TAN 2 (วิกฤต) · Visc 100 (วิกฤต) · อีก 1 ค่า");
  });
  it("falls back to the first note, then to nothing", () => {
    expect(causeLine({ advice: [], notes: ["VG อาจผิด"], keys: [] })).toBe("VG อาจผิด");
    expect(causeLine({ advice: [], notes: [], keys: [] })).toBe("");
    expect(causeLine(undefined)).toBe("");
  });
});
