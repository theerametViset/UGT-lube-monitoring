import { describe, expect, it } from "vitest";
import { weeklyDigestEmail } from "./weekly-digest";

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
    expect(html).toContain("TAN 2 mgKOH/g (วิกฤต เกิน 2 เท่า)"); // the plain-text fallback when no readings
  });

  it("says all is well when nothing needs attention", () => {
    const { html } = weeklyDigestEmail({ totalAssets: 3, critical: 0, warning: 0, healthy: 3, avgHealth: 95, topCritical: [] });
    expect(html).toContain("ผลการประเมิน: อยู่ในเกณฑ์ปกติ");
    expect(html).not.toContain("เครื่องที่ต้องดำเนินการ");
  });
});


describe("weeklyDigestEmail per plant", () => {
  const base = { totalAssets: 569, critical: 1, warning: 6, healthy: 562, avgHealth: 99 };
  const sites = [
    { code: "CPL", critical: 0, warning: 0, healthy: 135, total: 135 },
    { code: "UNT", critical: 0, warning: 1, healthy: 152, total: 153 },
    { code: "TSL", critical: 1, warning: 5, healthy: 243, total: 249 },
  ];
  const top = [
    { id: "01-B01-A", name: "ADSORBER BLOWER A", site: "TSL", health: 15 },
    { id: "12-P11", name: "MELT PUMP", site: "UNT", health: 50 },
  ];

  it("lists plants worst first, each linked to its Dashboard, with a fleet total", () => {
    const { html } = weeklyDigestEmail({ ...base, sites, topCritical: top });
    expect(html.indexOf("?site=TSL")).toBeLessThan(html.indexOf("?site=UNT"));
    expect(html.indexOf("?site=UNT")).toBeLessThan(html.indexOf("?site=CPL"));
    expect(html).toContain("รวม");
  });

  it("groups the machines under their plant, says how many more, and puts all-clear plants on one line", () => {
    const { html } = weeklyDigestEmail({ ...base, sites, topCritical: top });
    const tsl = html.indexOf("วิกฤต 1 · เฝ้าระวัง 5");
    expect(tsl).toBeGreaterThan(-1);
    expect(html.indexOf("ADSORBER BLOWER A")).toBeGreaterThan(tsl);
    expect(html).toContain("และอีก 5 เครื่อง"); // TSL has 6 to act on, 1 listed
    expect(html).toContain("CPL · ปกติทั้งหมด");
  });
});

describe("weeklyDigestEmail machine lines", () => {
  it("leads with the verdict from the counts, not the fleet average", () => {
    const { html } = weeklyDigestEmail({ totalAssets: 569, critical: 1, warning: 6, healthy: 562, avgHealth: 99.4, topCritical: [] });
    expect(html).toContain("ผลการประเมิน: ต้องดำเนินการแก้ไข");
    expect(html).not.toContain("99.4");
  });

  it("shows each reading on its own line, the next step and the lab month", () => {
    const { html } = weeklyDigestEmail({
      totalAssets: 1, critical: 1, warning: 0, healthy: 0, avgHealth: 15,
      topCritical: [{
        id: "01-B01-A", name: "ADSORBER BLOWER A", health: 15, lab: "พ.ย. 69",
        readings: [{ label: "TAN 2 mgKOH/g", over: "เกิน 2 เท่า", limit: "เกณฑ์ 1", crit: true }],
        action: "เปลี่ยนน้ำมันและไส้กรอง",
      }],
    });
    expect(html).toContain("TAN 2 mgKOH/g");
    expect(html).toContain("เกิน 2 เท่า");
    expect(html).toContain("(เกณฑ์ 1)");
    expect(html).toContain("&rarr; เปลี่ยนน้ำมันและไส้กรอง");
    expect(html).toContain("ผลแล็บ พ.ย. 69");
  });

  it("a machine without lab results says so instead of a date", () => {
    const { html } = weeklyDigestEmail({ totalAssets: 1, critical: 0, warning: 1, healthy: 0, avgHealth: 70, topCritical: [{ id: "X", name: "P", health: 70, lab: "" }] });
    expect(html).toContain("ผลแล็บ —");
  });
});

describe("weekly digest per-plant cap", () => {
  it("lists up to 10 machines per plant and links the rest", async () => {
    const { PER_PLANT } = await import("./weekly-digest");
    expect(PER_PLANT).toBe(10);
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `T-${i}`, name: `M${i}`, site: "TSL", health: 50 }));
    const { html } = weeklyDigestEmail({
      totalAssets: 20, critical: 0, warning: 12, healthy: 8, avgHealth: 80,
      sites: [{ code: "TSL", critical: 0, warning: 12, healthy: 8, total: 20 }],
      topCritical: many,
    });
    expect(html).toContain("T-9");
    expect(html).toContain("และอีก 2 เครื่อง");
  });
});

describe("weekly digest subject and inbox preview", () => {
  const sites = [
    { code: "TSL", critical: 1, warning: 5, healthy: 243, total: 249 },
    { code: "UNT", critical: 0, warning: 1, healthy: 152, total: 153 },
    { code: "CPL", critical: 0, warning: 0, healthy: 135, total: 135 },
  ];
  it("names the plants in the subject", () => {
    const crit = weeklyDigestEmail({ totalAssets: 537, critical: 1, warning: 6, healthy: 530, avgHealth: 99, sites, topCritical: [] });
    expect(crit.subject).toMatch(/— วิกฤต 1 \(TSL\) · เฝ้าระวัง 6$/);
    const warn = weeklyDigestEmail({ totalAssets: 537, critical: 0, warning: 6, healthy: 531, avgHealth: 99, sites: sites.map((s) => ({ ...s, critical: 0 })), topCritical: [] });
    expect(warn.subject).toMatch(/— วิกฤต 0 · เฝ้าระวัง 6 \(TSL, UNT\)$/);
    const ok = weeklyDigestEmail({ totalAssets: 3, critical: 0, warning: 0, healthy: 3, avgHealth: 100, sites: [{ code: "CPL", critical: 0, warning: 0, healthy: 3, total: 3 }], topCritical: [] });
    expect(ok.subject).toMatch(/— ปกติทั้งหมด$/);
  });

  it("puts the verdict and each plant's counts in the hidden inbox preview", () => {
    const { html } = weeklyDigestEmail({ totalAssets: 537, critical: 1, warning: 6, healthy: 530, avgHealth: 99, sites, topCritical: [] });
    expect(html).toContain("ต้องดำเนินการแก้ไข · TSL วิกฤต 1 เฝ้าระวัง 5 · UNT เฝ้าระวัง 1");
    expect(html.indexOf("display:none")).toBeLessThan(html.indexOf("UGT RELIABILITY"));
  });
});
