import { describe, expect, it } from "vitest";
import { matchTag, normalizeTag } from "./asset-match";
import { parseSamplingPeriod } from "./parse/period";

const assets = [
  { id: "34-U02-B", name: "MOTOR GEAR", site: "UNT" },
  { id: "34-U02-A", name: "MOTOR GEAR A", site: "UNT" },
  { id: "01-B01-A", name: "ADSORBER BLOWER A", site: "TSL" },
  { id: "Twin screw   no. 1", name: "Twin screw   no. 1", site: "UTCA" },
];

describe("matchTag", () => {
  it("exact id wins", () => {
    expect(matchTag("34-U02-B", assets)).toMatchObject({ kind: "exact", id: "34-U02-B" });
  });

  it("ignores case, spaces and separators when exactly one asset fits", () => {
    expect(matchTag("34u02b", assets)).toMatchObject({ kind: "normalized", id: "34-U02-B" });
    expect(matchTag(" 01_b01 a ", assets)).toMatchObject({ kind: "normalized", id: "01-B01-A" });
    expect(matchTag("TWIN SCREW NO.1", assets)).toMatchObject({ kind: "normalized", id: "Twin screw   no. 1" });
  });

  it("offers close ids instead of auto-picking a typo", () => {
    const m = matchTag("34-U02-C", assets);
    expect(m.kind).toBe("suggest");
    expect(m.id).toBeNull();
    expect(m.suggestions.map((s) => s.id)).toEqual(expect.arrayContaining(["34-U02-A", "34-U02-B"]));
  });

  it("finds an asset when the lab adds a prefix", () => {
    expect(matchTag("UNT-34-U02-B", assets).suggestions[0]?.id).toBe("34-U02-B");
  });

  it("reports no match and empty tags", () => {
    expect(matchTag("ZZZ-999", assets)).toMatchObject({ kind: "none", suggestions: [] });
    expect(matchTag("", assets).kind).toBe("empty");
    expect(matchTag(undefined, assets).kind).toBe("empty");
  });

  it("never auto-picks when two assets normalize to the same key", () => {
    const m = matchTag("AB1", [
      { id: "A-B1", name: "x", site: "S" },
      { id: "AB-1", name: "y", site: "S" },
    ]);
    expect(m.kind).toBe("suggest");
    expect(m.suggestions).toHaveLength(2);
  });

  it("normalizeTag", () => {
    expect(normalizeTag(" 34-u02_b ")).toBe("34U02B");
  });
});

describe("parseSamplingPeriod", () => {
  it.each([
    ["15/06/2026", "2026-06"],
    ["6/15/26", "2026-06"], // Excel US m/d/yy
    ["2026-06-15", "2026-06"],
    ["06/2026", "2026-06"],
    ["15-Jun-26", "2026-06"],
    ["Jun 2026", "2026-06"],
    ["15 มิ.ย. 2569", "2026-06"], // Thai month + Buddhist year
    ["15/06/2569", "2026-06"],
    ["46188", "2026-06"], // Excel serial for 2026-06-15
  ])("%s → %s", (raw, period) => {
    expect(parseSamplingPeriod(raw)?.period).toBe(period);
  });

  it("flags day/month ambiguity instead of hiding it", () => {
    expect(parseSamplingPeriod("03/04/2026")).toEqual({ period: "2026-04", ambiguous: true });
    expect(parseSamplingPeriod("15/06/2026")?.ambiguous).toBe(false);
  });

  it("returns null rather than guessing", () => {
    for (const raw of ["", "-", "N/A", "15/13/2026", "32/15/2026", "2026"]) expect(parseSamplingPeriod(raw)).toBeNull();
  });
});
