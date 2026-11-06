import * as XLSX from "xlsx";
import { dateText, isoCodeIn, oilHeaderParam } from "./batch";
import { cellNumber } from "./excel-utils";

export interface ParsedLab {
  oil: Partial<Record<"fe" | "water" | "visc" | "tan" | "particle_4" | "particle_6" | "particle_14", number>>;
  vib: Partial<Record<"vel" | "acc" | "cf" | "temp", number>>;
  iso?: string;
  matched: string[];
  tag?: string;
  lubricationType?: string;
  volume?: number;
  oilGrade?: string;
  samplingDate?: string;
}


// Vibration headers, whole words like the oil ones (oilHeaderParam): "Oil level" is not velocity.
const VIB_HEADERS: [string, RegExp][] = [
  ["vel", /velocity|\bvel\b|\brms\b/],
  ["acc", /acceleration|peak accel|\bacc\b|g-?\s?pk/],
  ["cf", /crest|\bcf\b/],
  ["temp", /temp/],
];
const headerParam = (text: string) => oilHeaderParam(text) ?? VIB_HEADERS.find(([, re]) => re.test(text))?.[0] ?? null;

const OIL_KEYS = new Set(["fe", "water", "visc", "tan", "particle_4", "particle_6", "particle_14"]);
const VIB_KEYS = new Set(["vel", "acc", "cf", "temp"]);
const ISO_KEYS = ["iso", "cleanliness", "4406"];

function isOil(k: string): k is keyof ParsedLab["oil"] {
  return OIL_KEYS.has(k);
}
function isVib(k: string): k is keyof ParsedLab["vib"] {
  return VIB_KEYS.has(k);
}

export async function parseLabExcel(file: File): Promise<ParsedLab> {
  const buf = await file.arrayBuffer();
  // raw: CSV text stays text — otherwise SheetJS reads "03/04/2026" as US month/day before we see it.
  const wb = XLSX.read(buf, { type: "array", raw: true });

  const result: ParsedLab = { oil: {}, vib: {}, matched: [] };
  const found = new Set<string>();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
    if (rows.length < 2) continue;
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });

    const colMap = new Map<number, string>();
    let isoCol = -1;
    let tagCol = -1;
    let lubCol = -1, volCol = -1, gradeCol = -1, dateCol = -1;
    const maxHeaderRow = Math.min(5, rows.length);
    let headerRow = -1;
    let lastKeyRow = -1; // header row of a sheet without a TAG column

    for (let r = 0; r < maxHeaderRow; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const cellText = String(row[c] ?? "").toLowerCase().trim();
        if (!cellText) continue;
        if (tagCol < 0 && (cellText === "tag" || cellText.includes("tag no"))) { tagCol = c; headerRow = r; }
        const param = headerParam(cellText);
        if (tagCol < 0 && param) lastKeyRow = r;
        if (isoCol < 0 && ISO_KEYS.some((k) => cellText.includes(k)) && !cellText.includes("vg")) isoCol = c;
        if (lubCol < 0 && (cellText.includes("lubrication") || cellText.includes("oil type") || cellText.includes("lub "))) lubCol = c;
        if (volCol < 0 && (cellText.includes("volume") || cellText.includes("liter") || cellText.includes("qty"))) volCol = c;
        if (gradeCol < 0 && (cellText.includes("grade") || cellText.includes("oil grade"))) gradeCol = c;
        if (dateCol < 0 && (cellText.includes("sampling") || cellText.includes("sample date"))) dateCol = c;
        if (param && !colMap.has(c)) colMap.set(c, param);
      }
    }

    if (!Array.from(colMap.values()).includes("visc")) {
      for (const [col, param] of colMap) {
        if (param === "water") {
          const vc = col - 2;
          if (vc >= 0 && !colMap.has(vc)) colMap.set(vc, "visc");
          break;
        }
      }
    }
    for (const [col, param] of [...colMap]) {
      if (param === "particle_4") {
        if (!colMap.has(col + 1)) colMap.set(col + 1, "particle_6");
        if (!colMap.has(col + 2)) colMap.set(col + 2, "particle_14");
      }
    }

    // First real result row after the TAG header (lab sheets put it on row 5, which the
    // old fixed start skipped) — a numbered but empty row ("2", "3"…) is not data.
    let dataRowIdx = -1;
    for (let r = headerRow >= 0 ? headerRow + 1 : lastKeyRow >= 0 ? lastKeyRow + 1 : maxHeaderRow; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      if (tagCol >= 0 && String(row[tagCol] ?? "").trim() !== "") { dataRowIdx = r; break; }
      const c0 = String(row[0] ?? "").trim();
      const hasValue = [...colMap.keys()].some((c) => cellNumber(row[c], rawRows[r]?.[c]) != null);
      // no TAG column: the first row with a result value is the sample
      if (hasValue && ((c0 && !isNaN(Number(c0))) || tagCol < 0)) { dataRowIdx = r; break; }
    }
    if (dataRowIdx < 0) continue;

    const dr = rows[dataRowIdx];

    for (const [colIdx, param] of colMap) {
      if (found.has(param)) continue;
      const val = cellNumber(dr[colIdx], rawRows[dataRowIdx]?.[colIdx]);
      if (val != null) {
        if (isOil(param)) result.oil[param] = val;
        else if (isVib(param)) result.vib[param] = val;
        found.add(param);
      }
    }

    if (!result.iso) {
      // the ISO column first, then any cell (some lab sheets have no ISO header)
      const cells = isoCol >= 0 ? [dr[isoCol], ...dr] : dr;
      for (const [i, cell] of cells.entries()) {
        const iso = isoCodeIn(cell, isoCol >= 0 && i === 0);
        if (iso) { result.iso = iso; found.add("iso"); break; }
      }
    }

    // Extract TAG + asset metadata
    if (!result.tag && tagCol >= 0) {
      const tagVal = String(dr[tagCol] ?? "").trim();
      if (tagVal && tagVal !== "-" && tagVal.length > 1) result.tag = tagVal;
    }
    if (lubCol >= 0) {
      const lubVal = String(dr[lubCol] ?? "").trim();
      if (lubVal && lubVal !== "-") result.lubricationType = lubVal;
    }
    if (volCol >= 0) {
      result.volume = cellNumber(dr[volCol], rawRows[dataRowIdx]?.[volCol]) ?? undefined;
    }
    if (gradeCol >= 0) {
      const gradeVal = String(dr[gradeCol] ?? "").trim();
      if (gradeVal && gradeVal !== "-") result.oilGrade = gradeVal;
    }
    if (dateCol >= 0) {
      const dateVal = dateText(rawRows[dataRowIdx]?.[dateCol], dr[dateCol]);
      if (dateVal && dateVal !== "-") result.samplingDate = dateVal;
    }
  }

  result.matched = [...found];
  return result;
}

