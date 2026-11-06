import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { isoCodeIn, oilHeaderParam, parseBatchExcel } from "./batch";
import { parseLabExcel } from "./excel";
import { parseSamplingPeriod } from "./period";

// Same layout as the monthly lab report: title row, header row (TAG on row 2), a
// "Standard / Result" row, a guide row, then the first machine on row 5.
function labWorkbook(): File {
  const aoa: unknown[][] = [
    ["Result oil analysis ( JULY 2026 )"],
    ["No", "TAG", "Sampling date", "Lubrication Type", "Volume ( Liter )", "Oil grade", "Viscosity (cSt@40°C)", "", "Water (PPM)", "", "Ferrous (mg/litreFe)", "", "TAN (mgKOH/g)", ""],
    ["", "", "", "", "", "", "Standard", "Result", "Standard", "Result", "Std: Trend only", "Result", "Std: <1.0", "Result"],
    ["", "", "", "", "", "", "ดูจากตาราง", "", " 300 - 500", "", "", "", "", ""],
    [1, "06-K01-B", new Date(Date.UTC(2026, 6, 8)), "Atlas", 60, "B-68", 61.7, "C", "Visual", "N", "Visual", "N", 0.3, "N"],
    [2, "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Record");
  const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return { name: "07_July.xlsx", size: buf.byteLength, type: "", arrayBuffer: async () => buf } as unknown as File;
}

// One machine with no ISO result; a d/m/yy date sits in "Last replace new oil" and,
// in the second variant, Excel has turned the ISO cell itself into a date.
function isoWorkbook(isoCell: unknown, lastReplace: unknown): File {
  const aoa: unknown[][] = [
    ["Result oil analysis ( JULY 2026 )"],
    ["No", "TAG", "Sampling date", "Oil grade", "Viscosity (cSt@40°C)", "", "ISO", "Last replace new oil"],
    ["", "", "", "", "Standard", "Result", "", ""],
    [1, "12-P16-A", new Date(Date.UTC(2026, 6, 9)), "VG320", 319.2, "C", isoCell, lastReplace],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Record");
  const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return { name: "lab.xlsx", size: buf.byteLength, type: "", arrayBuffer: async () => buf } as unknown as File;
}

describe("ISO 4406 code is never a date", () => {
  it("single-file: a date elsewhere in the row is not taken as the ISO code", async () => {
    const r = await parseLabExcel(isoWorkbook("", "9/7/26"));
    expect(r.tag).toBe("12-P16-A");
    expect(r.iso).toBeUndefined();
  });

  it("batch + single: an ISO cell Excel turned into a date is dropped", async () => {
    const book = () => isoWorkbook(new Date(Date.UTC(2026, 6, 9)), "");
    const [row] = await parseBatchExcel(book());
    expect(row.iso).toBeNull();
    expect((await parseLabExcel(book())).iso).toBeUndefined();
  });

  it("real codes still read, decimals included", async () => {
    const [row] = await parseBatchExcel(isoWorkbook("23.0/20.8/17.1", "9/7/26"));
    expect(row.iso).toBe("23.0/20.8/17.1");
    expect((await parseLabExcel(isoWorkbook("16/14/11", "9/7/26"))).iso).toBe("16/14/11");
  });

  it("reads a microscope code without the 4 µm figure", () => {
    expect(isoCodeIn("-/16/13")).toBe("-/16/13");
    expect(isoCodeIn("-/13/16")).toBeNull();
  });

  it("reads an old 2-part code only as the whole ISO-column cell", () => {
    expect(isoCodeIn("16/13", true)).toBe("16/13");
    expect(isoCodeIn("13/16", true)).toBeNull();
    expect(isoCodeIn("16/13")).toBeNull();
    expect(isoCodeIn("sample 9/7", true)).toBeNull();
  });
});

describe("lab Excel parsing", () => {
  it("batch: reads the first machine on row 5, keeps Viscosity, skips guide rows", async () => {
    const rows = await parseBatchExcel(labWorkbook());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tag: "06-K01-B", visc: 61.7, tan: 0.3, water: null, fe: null });
  });

  it("dates come from the Excel date value, not US-formatted text (7/8/26 = 8 July)", async () => {
    const [row] = await parseBatchExcel(labWorkbook());
    expect(parseSamplingPeriod(row.samplingDate)?.period).toBe("2026-07");
    const single = await parseLabExcel(labWorkbook());
    expect(single.tag).toBe("06-K01-B");
    expect(parseSamplingPeriod(single.samplingDate)?.period).toBe("2026-07");
    expect(single.oil).toMatchObject({ visc: 61.7, tan: 0.3 });
  });
});

describe("lab header → reading", () => {
  it("whole words and numbers: 14µm is not 4µm, Tank is not TAN, a bare Fe is Fe", () => {
    const map = (h: string) => oilHeaderParam(h.toLowerCase());
    expect(map("Fe")).toBe("fe");
    expect(map("Fe(ppm)")).toBe("fe");
    expect(map("TAN (mgKOH/g)")).toBe("tan");
    expect(map("Tank (L)")).toBeNull();
    expect(map("Standard")).toBeNull();
    expect(map("4\u00b5m")).toBe("particle_4"); // micro sign, as Excel types it
    expect(map("6\u03bcm")).toBe("particle_6"); // Greek mu
    expect(map("\u226514\u00b5m")).toBe("particle_14");
    expect(map("14um")).toBe("particle_14");
    expect(map(">4")).toBe("particle_4");
    expect(map(">14")).toBe("particle_14");
    expect(map("Viscosity (cSt@40°C)")).toBe("visc");
  });

  it("a whole file with those headers lands every value in its own reading", async () => {
    const aoa: unknown[][] = [
      ["TAG", "Fe", "TAN", "Tank (L)", "4\u00b5m", "6\u00b5m", "14\u00b5m"],
      ["06-K01-B", 12, 0.4, 200, 1500, 400, 30],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const buf: ArrayBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const file = { name: "h.xlsx", size: buf.byteLength, type: "", arrayBuffer: async () => buf } as unknown as File;
    const [row] = await parseBatchExcel(file);
    expect(row).toMatchObject({ fe: 12, tan: 0.4, particle_4: 1500, particle_6: 400, particle_14: 30 });
    const single = await parseLabExcel(file);
    expect(single.oil).toMatchObject({ fe: 12, tan: 0.4, particle_4: 1500, particle_6: 400, particle_14: 30 });
    expect(single.vib).toEqual({});
  });
});
