import { describe, expect, it } from "vitest";
import { fetchAll } from "./fetch-all";

describe("fetchAll", () => {
  it("keeps paging past 1000 rows until a short page", async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => i);
    const calls: [number, number][] = [];
    const got = await fetchAll(async (from, to) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    });
    expect(got).toEqual(rows);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("throws on a query error instead of returning partial data", async () => {
    await expect(fetchAll(async () => ({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
  });
});
