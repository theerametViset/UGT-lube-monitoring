// Parse ALL data rows from Excel (not just first) — for batch import
import * as XLSX from "xlsx";
import { cellNumber } from "./excel-utils";

export interface BatchRow {
  tag: string;
  samplingDate: string;
  lubricationType: string;
  volume: number | null;
  oilGrade: string;
  visc: number | null;
  water: number | null;
  fe: number | null;
  tan: number | null;
  iso: string | null;
  particle_4: number | null;
  particle_6: number | null;
  particle_14: number | null;
}


/** Excel serial when the cell is a real date, else the cell's text. */
export function dateText(raw: unknown, formatted: unknown): string {
  if (typeof raw === "number" && raw > 20000 && raw < 80000) return String(Math.floor(raw));
  return String(formatted ?? "").trim();
}
const ISO_RE = /(?:\d{1,2}(?:\.\d+)?|-)\/\d{1,2}(?:\.\d+)?\/\d{1,2}(?:\.\d+)?/g;

/**
 * First ISO 4406 code in the text, or null. A real code never rises with particle
 * size (4µm ≥ 6µm ≥ 14µm, each ≤ 30), which is what tells it apart from a d/m/yy
 * date such as "9/7/26" — Excel also turns codes typed as x/y/z into dates.
 */
export function isoCodeIn(text: unknown, isoColumn = false): string | null {
  // Old 2-part codes (ISO 4406:1987, ≥5/≥15 µm) only as the whole cell of the ISO
  // column — anywhere else "9/7" is more likely a date.
  const two = isoColumn ? String(text ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})$/) : null;
  if (two && Number(two[1]) <= 30 && Number(two[1]) >= Number(two[2])) return two[0];
  for (const m of String(text ?? "").matchAll(ISO_RE)) {
    // "-/16/13": a microscope count (ISO 4407) has no 4 µm figure
    const [a, b, c] = m[0].split("/").map((x) => (x === "-" ? 30 : Number(x)));
    if (a <= 30 && a >= b && b >= c) return m[0];
  }
  return null;
}

export async function parseBatchExcel(file: File): Promise<BatchRow[]> {
  const buf = await file.arrayBuffer();
  // raw: CSV text stays text — otherwise SheetJS reads "03/04/2026" as US month/day before we see it.
  const wb = XLSX.read(buf, { type: "array", raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
  // Unformatted values: a date cell comes back as its Excel serial, not the US-formatted
  // "7/8/26" text that raw:false produces (which reads as 8 July or 7 August).
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });

  // Detect columns from header rows
  const colMap = new Map<number, string>();
  let tagCol = -1, lubCol = -1, volCol = -1, gradeCol = -1, dateCol = -1, isoCol = -1;
  const maxHeaderRow = Math.min(5, rows.length);
  let headerRow = -1; // row holding the TAG header — data starts right after it

  for (let r = 0; r < maxHeaderRow; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const ct = String(row[c] ?? "").toLowerCase().trim();
      if (!ct) continue;
      if (tagCol < 0 && ct === "tag") { tagCol = c; headerRow = r; }
      if (isoCol < 0 && ((ct.includes("iso") && !ct.includes("vg")) || ct.includes("cleanliness"))) isoCol = c;
      if (lubCol < 0 && (ct.includes("lubrication") || ct.includes("oil type"))) lubCol = c;
      if (volCol < 0 && (ct.includes("volume") || ct.includes("liter"))) volCol = c;
      if (gradeCol < 0 && ct.includes("grade")) gradeCol = c;
      if (dateCol < 0 && (ct.includes("sampling") || ct.includes("sample date"))) dateCol = c;
      // First header wins: the "Standard / Result" row under it must not remap the
      // column ("Standard" contains "tan" and used to turn Viscosity into TAN).
      if (colMap.has(c)) continue;
      if (ct.includes("viscosity") || ct.includes("visc") || ct.includes("cst")) colMap.set(c, "visc");
      else if (ct.includes("water")) colMap.set(c, "water");
      else if (ct.includes("ferrous") || ct.includes("iron") || ct.includes("fe ")) colMap.set(c, "fe");
      else if (/tan/.test(ct) || ct.includes("mgkoh")) colMap.set(c, "tan");
      else if (ct.includes("particle 4") || ct.includes("4um") || ct.includes("4\u03bcm")) colMap.set(c, "particle_4");
      else if (ct.includes("particle 6") || ct.includes("6um") || ct.includes("6\u03bcm")) colMap.set(c, "particle_6");
      else if (ct.includes("particle 14") || ct.includes("14um") || ct.includes("14\u03bcm")) colMap.set(c, "particle_14");
    }
  }

  // Viscosity fallback
  if (!Array.from(colMap.values()).includes("visc")) {
    for (const [col, param] of colMap) {
      if (param === "water") { if (!colMap.has(col - 2)) colMap.set(col - 2, "visc"); break; }
    }
  }
  // Particle fallback
  for (const [col, param] of [...colMap]) {
    if (param === "particle_4") {
      if (!colMap.has(col + 1)) colMap.set(col + 1, "particle_6");
      if (!colMap.has(col + 2)) colMap.set(col + 2, "particle_14");
    }
  }

  // Parse ALL data rows
  const result: BatchRow[] = [];
  let seenTagged = false;
  // Start right after the TAG header row, not at a fixed row 5: lab sheets put their
  // first machine on row 5 (index 4) and it used to be skipped.
  for (let r = headerRow >= 0 ? headerRow + 1 : maxHeaderRow; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const rawTag = tagCol >= 0 ? String(row[tagCol] ?? "").trim() : "";
    // A row with results but no TAG is kept (tag "") so the preview can flag it;
    // rows with neither are spacer/header rows and are dropped below.
    const tagVal = !rawTag || rawTag === "-" || rawTag.length < 2 ? "" : rawTag;

    const item: BatchRow = {
      tag: tagVal,
      samplingDate: dateCol >= 0 ? dateText(rawRows[r]?.[dateCol], row[dateCol]) : "",
      lubricationType: lubCol >= 0 ? String(row[lubCol] ?? "").trim() : "",
      volume: null, oilGrade: "", visc: null, water: null, fe: null, tan: null,
      iso: null, particle_4: null, particle_6: null, particle_14: null,
    };

    if (volCol >= 0) {
      item.volume = cellNumber(row[volCol], rawRows[r]?.[volCol]);
    }
    if (gradeCol >= 0) {
      const gv = String(row[gradeCol] ?? "").trim();
      if (gv && gv !== "-") item.oilGrade = gv;
    }
    if (isoCol >= 0) {
      item.iso = isoCodeIn(row[isoCol], true);
    }

    for (const [colIdx, param] of colMap) {
      const val = cellNumber(row[colIdx], rawRows[r]?.[colIdx]);
      if (val != null && Number.isFinite(val)) {
        (item as unknown as Record<string, number | string | null>)[param] = val;
      }
    }

    // A tagless row is kept (and flagged) only once real data has started: the rows
    // between the header and the first machine are standards/guide rows ("Std: <1.0").
    const results = [item.visc, item.water, item.fe, item.tan, item.particle_4, item.particle_6, item.particle_14].filter((v) => v != null).length + (item.iso ? 1 : 0);
    if (tagVal) seenTagged = true;
    if (tagVal || (seenTagged && results >= 2)) result.push(item);
  }

  return result;
}
