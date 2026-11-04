import * as XLSX from "xlsx";

// Real .xlsx download (not CSV) — avoids the classic "Thai text turns to
// mojibake when Excel opens a plain UTF-8 CSV without a BOM" pitfall, since
// .xlsx stores strings as proper Unicode XML. Import this module with a
// dynamic `import()` at the call site so the (large) xlsx lib only loads
// when a user actually clicks an export button.
export function downloadXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
