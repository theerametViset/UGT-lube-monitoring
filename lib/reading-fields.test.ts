import { describe, expect, it } from "vitest";
import { OIL_FIELDS, addCleared, readingCols, showSaved } from "./reading-fields";
import { importRow } from "./asset-import";
import type { Asset } from "./types";

describe("readingCols", () => {
  it("writes only the columns that were sent", () => {
    expect(readingCols({ kind: "oil", values: { fe: 130, water: "2500" } })).toEqual({ fe: 130, water: 2500 });
  });

  it("clears a column sent as null or empty", () => {
    expect(readingCols({ kind: "oil", values: { tan: null, iso_code: "" } })).toEqual({ tan: null, iso_code: null });
  });

  it("never writes Cu/Si or columns of the other kind", () => {
    expect(readingCols({ kind: "oil", values: { cu: 60, si: 20, vel: 5 } })).toEqual({});
  });
});

describe("Data Entry saved values", () => {
  const blank = { fe: "", water: "", visc: "", tan: "", iso: "", p4: "", p6: "", p14: "" };

  it("shows the saved values, keeps touched ones, swaps on a new machine", () => {
    const shownA = showSaved(blank, OIL_FIELDS, new Set(), { fe: 130, water: 2500 });
    expect(shownA).toMatchObject({ fe: "130", water: "2500" });
    const typed = { ...shownA, tan: "0.8" };
    const shownB = showSaved(typed, OIL_FIELDS, new Set(["tan"]), { fe: 40 });
    expect(shownB).toMatchObject({ fe: "40", water: "", tan: "0.8" });
  });

  it("never carries an untouched value to another machine, even when its load fails", () => {
    const shownA = showSaved(blank, OIL_FIELDS, new Set(), { tan: 0.8 });
    expect(showSaved(shownA, OIL_FIELDS, new Set(), null)).toMatchObject({ tan: "" });
  });

  it("keeps a lab-file value that happens to equal the old saved value", () => {
    const fromLab = { ...showSaved(blank, OIL_FIELDS, new Set(), { iso: "18/16/13" }), iso: "18/16/13" };
    expect(showSaved(fromLab, OIL_FIELDS, new Set(["iso"]), null)).toMatchObject({ iso: "18/16/13" });
  });

  it("sends null only for a saved value the user emptied", () => {
    const values: Record<string, number | string | null> = {};
    addCleared(values, { ...blank, fe: "130" }, OIL_FIELDS, { fe: 130, water: 2500, tan: null });
    expect(values).toEqual({ water: null });
  });
});

describe("importRow", () => {
  const old = { id: "M1", name: "Pump", type: "Gearbox", site: "TSL", vg_grade: 220, motor_kw: 30, rpm: 900, oil_brand: "Shell", oil_qty_l: 50, oil_change_months: 12, oil_sample_months: 6, last_update: "2026-08", health: 35, status: "Critical" } as Asset;

  it("keeps an existing machine's values where the sheet is blank and never writes health", () => {
    const row = importRow({ id: "M1", name: "Pump A" } as Asset, old);
    expect(row).toMatchObject({ name: "Pump A", site: "TSL", vg_grade: 220, motor_kw: 30, last_update: "2026-08" });
    expect(row).not.toHaveProperty("health");
    expect(row).not.toHaveProperty("status");
  });

  it("uses defaults only for a new machine", () => {
    expect(importRow({ id: "M2", name: "New" } as Asset, undefined)).toMatchObject({ vg_grade: 0, oil_sample_months: 3 }); // blank VG = 0, like 0032
  });
});
