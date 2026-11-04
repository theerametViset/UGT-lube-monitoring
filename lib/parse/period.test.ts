import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isFuturePeriod, parseSamplingPeriod } from "./period";
import { cellNumber } from "./excel-utils";

describe("parseSamplingPeriod", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 28)); // 2026-10-28
  });
  afterEach(() => vi.useRealTimers());

  const p = (s: string) => parseSamplingPeriod(s)?.period ?? null;

  it("reads 2-digit Buddhist-era years (69 = 2569 = 2026)", () => {
    expect(p("15/06/69")).toBe("2026-06");
    expect(p("15 มิ.ย. 69")).toBe("2026-06");
  });

  it("keeps 2-digit CE years", () => {
    expect(p("9/7/26")).toBe("2026-07");
    expect(p("15-Jun-26")).toBe("2026-06");
  });

  it("takes the 4-digit year, not the day, after a month name", () => {
    expect(p("Jun 15, 2026")).toBe("2026-06");
    expect(p("Jun 15, 26")).toBe("2026-06");
    expect(p("Jun 2026")).toBe("2026-06");
    // a time after the date is not the year
    expect(p("15-Jun-26 09:05")).toBe("2026-06");
    expect(p("15 มิ.ย. 69 10:20")).toBe("2026-06");
    expect(p("Jun 15, 2026 14:30")).toBe("2026-06");
    expect(p("15 มิ.ย. 69 10.20 น.")).toBe("2026-06");
    expect(p("15-Jun-26 10.20")).toBe("2026-06");
    expect(parseSamplingPeriod("09:05 Jun 15")?.ambiguous).toBe(true);
    // no year given: read as a year but flagged for the user to confirm
    expect(parseSamplingPeriod("Jun 15")).toEqual({ period: "2015-06", ambiguous: true });
    expect(parseSamplingPeriod("15-Jun-26")?.ambiguous).toBe(false);
    expect(p("15 มิ.ย. 2569")).toBe("2026-06");
  });

  it("rejects periods more than a month ahead", () => {
    expect(p("2026-11")).toBe("2026-11");
    expect(p("2026-12")).toBeNull();
    expect(p("15/06/2069")).toBeNull();
  });
});

describe("isFuturePeriod", () => {
  it("allows up to next month and rejects a mistyped year", () => {
    const d = new Date();
    const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const after = new Date(d.getFullYear(), d.getMonth() + 2, 1);
    expect(isFuturePeriod(ym(d.getFullYear(), d.getMonth() + 1))).toBe(false);
    expect(isFuturePeriod(ym(next.getFullYear(), next.getMonth() + 1))).toBe(false);
    expect(isFuturePeriod(ym(after.getFullYear(), after.getMonth() + 1))).toBe(true);
    expect(isFuturePeriod("2062-11")).toBe(true);
  });
});

describe("cellNumber", () => {
  it("reads formatted numbers with thousands separators", () => {
    expect(cellNumber("1,200")).toBe(1200);
    expect(cellNumber(" 2,500.5 ")).toBe(2500.5);
  });

  it("reads a decimal comma as a decimal point", () => {
    expect(cellNumber("0,5")).toBe(0.5);
    expect(cellNumber("1,234,567")).toBe(1234567);
  });

  it("reads '0,050' as 0.05, exponents, and takes a numeric cell's raw value", () => {
    expect(cellNumber("0,050")).toBe(0.05);
    expect(cellNumber("0,125")).toBe(0.125);
    expect(cellNumber("1.5E-02")).toBe(0.015);
    expect(cellNumber("0,050", 0.05)).toBe(0.05);
    expect(cellNumber("50.0", 50)).toBe(50);
  });

  it("treats '>' values as at least that number", () => {
    expect(cellNumber(">1000")).toBe(1000);
  });

  it("skips below-detection and non-numeric cells", () => {
    expect(cellNumber("<5")).toBeNull();
    expect(cellNumber("-")).toBeNull();
    expect(cellNumber("Visual")).toBeNull();
    expect(cellNumber("")).toBeNull();
    expect(cellNumber(null)).toBeNull();
  });
});
