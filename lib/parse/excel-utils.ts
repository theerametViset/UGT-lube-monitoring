// Utility functions — NO xlsx import (kept lightweight for static import)
export const ACCEPTED_TYPES = ".pdf,.xlsx,.xls,.csv";
export const MAX_FILE_MB = 10;

export function isExcelLike(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv") || file.type.includes("sheet") || file.type === "text/csv";
}

export function isPdf(file: File): boolean {
  return file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
}

export function isImage(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png") || n.endsWith(".webp") || n.endsWith(".gif") || file.type.startsWith("image/");
}

// A lab cell's number, shared by both Excel parsers. A comma before exactly three
// digits groups thousands ("1,200" → 1200 — the sheet is read as formatted text);
// any other comma is a decimal point ("0,5" → 0.5). ">1000" → 1000: at least that
// much, so it still counts against the limits. "<5" (below detection), "-",
// "Visual" → null.
// `raw` = the cell's unformatted value: a numeric cell is taken as is, so a
// European-locale "0,050" is never re-read from its formatted text.
export function cellNumber(text: unknown, raw?: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  const s = String(text ?? "").trim();
  // "1,200" = thousands separator; "0,050" = decimal comma (no thousands group starts with 0)
  const v = (/^-?0,\d+$/.test(s) ? s : s.replace(/,(?=\d{3}(?!\d))/g, "")).replace(",", ".");
  if (!v || v.startsWith("<") || /^[A-Za-z]+$/.test(v)) return null;
  const m = v.match(/-?\d+(\.\d+)?(e[-+]?\d+)?/i);
  return m ? Number(m[0]) : null;
}
