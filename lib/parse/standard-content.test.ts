import { describe, it, expect } from "vitest";
import { parseStandardLines, parseStandardSections, splitHeading } from "./standard-content";

describe("parseStandardLines", () => {
  it("splits a line into its clauses by ·", () => {
    const lines = parseStandardLines("Zone A ≤2.3 · B 2.3–4.5 · C 4.5–7.1 · D >7.1 mm/s (15–300 kW)");
    expect(lines).toEqual([["Zone A ≤2.3", "B 2.3–4.5", "C 4.5–7.1", "D >7.1 mm/s (15–300 kW)"]]);
  });

  it("keeps each \\n line as its own group", () => {
    const lines = parseStandardLines("Fe Warn 150 / Crit 300 ppm · Water 500/1000 ppm\nISO ≤ 18/16/13");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual(["Fe Warn 150 / Crit 300 ppm", "Water 500/1000 ppm"]);
    expect(lines[1]).toEqual(["ISO ≤ 18/16/13"]);
  });

  it("drops empty lines and empty clauses", () => {
    const lines = parseStandardLines("A ·  · B\n\nC");
    expect(lines).toEqual([["A", "B"], ["C"]]);
  });

  it("returns empty array for empty text", () => {
    expect(parseStandardLines("")).toEqual([]);
  });
});

describe("splitHeading", () => {
  it("takes a short 'label:' prefix as the heading", () => {
    expect(splitHeading(["ประเภท: HH (mineral)", "HL"])).toEqual({ heading: "ประเภท", items: ["HH (mineral)", "HL"] });
  });
  it("leaves lines without a label alone", () => {
    expect(splitHeading(["TAN = mg KOH/g", "x"])).toEqual({ heading: null, items: ["TAN = mg KOH/g", "x"] });
  });
});

describe("parseStandardSections", () => {
  it("splits ## sections and groups | rows into one table", () => {
    const s = parseStandardSections("ขอบเขต: a · b\n| h1 | h2 |\n| 1 | 2 |\n## ใช้ในงาน UGT\nใช้ตอน: x");
    expect(s).toEqual([
      { title: null, blocks: [
        { kind: "lines", heading: "ขอบเขต", items: ["a", "b"] },
        { kind: "table", rows: [["h1", "h2"], ["1", "2"]] },
      ] },
      { title: "ใช้ในงาน UGT", blocks: [{ kind: "lines", heading: "ใช้ตอน", items: ["x"] }] },
    ]);
  });
  it("keeps a · inside a table cell", () => {
    expect(parseStandardSections("| Group 2 · ฐานแข็ง | 1.4 |")[0].blocks[0]).toEqual({ kind: "table", rows: [["Group 2 · ฐานแข็ง", "1.4"]] });
  });
});
