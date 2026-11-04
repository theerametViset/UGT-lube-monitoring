// How an oil / vibration reading maps between the Data Entry form, a save
// request and the DB columns. Plain functions (no server or React code) so both
// sides can use them and they can be tested.

// Cu/Si are not measured any more (0031) — their DB columns stay, nothing writes them.
const OIL_COLS = ["fe", "water", "visc", "tan", "iso_code", "particle_4", "particle_6", "particle_14"] as const;
const VIB_COLS = ["vel", "acc", "cf", "temp"] as const;

// Every stored value column, including Cu/Si (kept since 0031 — a row holding only
// those is not empty).
export const STORED_COLS = { oil: [...OIL_COLS, "cu", "si"], vib: [...VIB_COLS] } as const;

// Only the columns the caller sent: a lab file without TAN must not erase a
// TAN already saved for the same machine and period. A sent null/"" clears it.
export function readingCols(input: { kind: "oil" | "vib"; values: Record<string, number | string | null> }): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = {};
  for (const k of input.kind === "oil" ? OIL_COLS : VIB_COLS) {
    if (!(k in input.values)) continue;
    out[k] = k === "iso_code" ? (input.values[k] as string) || null : num(input.values[k]);
  }
  return out;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Form field → reading column.
export const OIL_FIELDS = [["fe", "fe"], ["water", "water"], ["visc", "visc"], ["tan", "tan"], ["iso", "iso_code"], ["p4", "particle_4"], ["p6", "particle_6"], ["p14", "particle_14"]] as const;
export const VIB_FIELDS = [["vel", "vel"], ["acc", "acc"], ["cf", "cf"], ["temp", "temp"]] as const;
type FieldMap = readonly (readonly [string, string])[];
// A saved reading row (OilReading / VibReading) or none.
type Row = object | null;
const col = (row: Row, c: string) => (row as Record<string, unknown> | null)?.[c];
const shown = (v: unknown) => (v == null ? "" : String(v));

// Every field the user hasn't typed in (or filled from a lab file) shows the saved
// value of the selected machine + period — blank when there is none. `touched`
// fields keep what the user entered.
export function showSaved<F extends Record<string, string>>(form: F, fields: FieldMap, touched: ReadonlySet<string>, saved: Row): F {
  const out: Record<string, string> = { ...form };
  for (const [f, c] of fields) if (!touched.has(f)) out[f] = shown(col(saved, c));
  return out as F;
}

// A saved value the user emptied → null, so the save deletes it.
export function addCleared(values: Record<string, number | string | null>, form: Record<string, string>, fields: FieldMap, saved: Row) {
  for (const [f, c] of fields) if (form[f] === "" && col(saved, c) != null) values[c] = null;
}
