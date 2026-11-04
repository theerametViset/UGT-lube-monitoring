import { describe, expect, it } from "vitest";
import { assetsFromSheetRows, cellNum, importRow } from "./asset-import";
import type { Asset } from "./types";

describe("assetsFromSheetRows", () => {
  it("maps template headers, formats dates and drops rows without ID or Name", () => {
    const rows = assetsFromSheetRows([
      { "ID": " 31-P01A ", "Name": "Feed Pump", "VG Grade": 46, "Install Date": new Date(2020, 0, 15), "Health": 12, "หมายเหตุ": "x" },
      { "ID": "31-P01B", "Name": "" },
    ]);
    expect(rows).toEqual([{ id: "31-P01A", name: "Feed Pump", vg_grade: 46, install_date: "2020-01-15" }]);
  });
  it("keeps the old install date when the cell is blank", () => {
    const old = { id: "A", install_date: "2019-05-01" } as Asset;
    expect(importRow({ id: "A", name: "n", install_date: "" } as unknown as Asset, old).install_date).toBe("2019-05-01");
    expect("install_date" in importRow({ id: "B", name: "n" } as Asset, undefined)).toBe(false);
  });
  it("keeps 0 as a value (VG 0 = no VG) and reads 'VG 68'", () => {
    expect(cellNum("VG 68")).toBe(68);
    expect(cellNum("ISO VG 220")).toBe(220);
    expect(cellNum(0)).toBe(0);
    expect(cellNum("")).toBeUndefined();
    expect(cellNum("-46")).toBeUndefined();
    const old = { id: "72-U02", vg_grade: 0, oil_qty_l: 0, oil_change_months: 0, site: "UNT" } as Asset;
    const row = importRow({ id: "72-U02", name: "CHILLER" } as Asset, old);
    expect([row.vg_grade, row.oil_qty_l, row.oil_change_months, row.site]).toEqual([0, 0, 0, "UNT"]);
    expect(importRow({ id: "N", name: "n" } as Asset, undefined).site).toBe("");
  });
  it("keeps an existing machine's empty kW / RPM / brand on a re-import with blank cells", () => {
    const old = { id: "A", motor_kw: null, rpm: null, oil_brand: null, vg_grade: 220 } as unknown as Asset;
    const row = importRow({ id: "A", name: "n", motor_kw: "", rpm: "" } as unknown as Asset, old);
    expect([row.motor_kw, row.rpm, row.oil_brand, row.vg_grade]).toEqual([null, null, null, 220]);
    const fresh = importRow({ id: "B", name: "n" } as Asset, undefined);
    expect([fresh.motor_kw, fresh.rpm, fresh.vg_grade, fresh.oil_brand]).toEqual([75, 1500, 0, null]);
  });
});
