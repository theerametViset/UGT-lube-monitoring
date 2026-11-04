import { describe, expect, it } from "vitest";
import { suspectVgGrade } from "./viscosity-limits";

describe("suspectVgGrade", () => {
  it("flags a grade far from the reading and names the closest one", () => {
    expect(suspectVgGrade(218, 2)).toBe(220); // 2030-B01-1
    expect(suspectVgGrade(46, 320)).toBe(46);
  });

  it("accepts normal wear or contamination around the grade", () => {
    expect(suspectVgGrade(245, 220)).toBeNull();
    expect(suspectVgGrade(127.5, 150)).toBeNull();
  });

  it("needs both a reading and a grade", () => {
    expect(suspectVgGrade(null, 220)).toBeNull();
    expect(suspectVgGrade(218, null)).toBeNull();
  });
});
