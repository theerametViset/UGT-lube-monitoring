import { describe, expect, it } from "vitest";
import { problemRows } from "./problem-rows";

describe("problemRows", () => {
  it("keeps only rows with problems, Critical first, then most problems", () => {
    const rows = [
      { code: "UFA", warning: 0, critical: 0 },
      { code: "TSL", warning: 5, critical: 0 },
      { code: "UNT", warning: 1, critical: 1 },
      { code: "CPL", warning: 1, critical: 0 },
    ];
    expect(problemRows(rows).map((r) => r.code)).toEqual(["UNT", "TSL", "CPL"]);
  });
});
