import type { Asset } from "@/lib/types";

// One row of an asset Excel import → the row to upsert. A re-import must not
// reset an existing machine: a blank cell keeps its current value (defaults are
// only for new machines), and health/status are never written — they are
// compute_health's cache; a new row gets the column defaults (100 / Healthy).
// A blank or unreadable cell is "not given" (keep the old value); 0 is a value —
// VG 0 = no VG (viscosity uses the generic Alarm Config limits), qty/cycle 0 = not known yet. "VG 68" reads as 68.
export function cellNum(v: unknown): number | undefined {
  const s = String(v ?? "").trim().match(/^(?:ISO\s*)?(?:VG\s*)?(\d+(?:\.\d+)?)$/i)?.[1];
  return s === undefined ? undefined : Number(s);
}

export function importRow(x: Asset, old: Asset | undefined) {
  // `old ? old.x : default`, not `old?.x ?? default`: an existing machine's empty kW must
  // stay empty — the 569 real machines have no kW/RPM, and a re-import made them 75 / 1500.
  const keep = <K extends keyof Asset>(k: K, dflt: Asset[K]) => (old ? old[k] : dflt);
  // a new machine without a VG gets 0 (like 0032), not a guessed 46 that would score its gear oil Critical
  const vg = cellNum(x.vg_grade) ?? keep("vg_grade", 0);
  return {
    id: x.id,
    name: x.name,
    type: x.type || old?.type || "Other",
    site: x.site || old?.site || "", // blank on a new machine → skipped by importAssets
    vg_grade: vg,
    motor_kw: cellNum(x.motor_kw) ?? keep("motor_kw", 75),
    rpm: cellNum(x.rpm) ?? keep("rpm", 1500),
    oil_brand: x.oil_brand || keep("oil_brand", null),
    oil_qty_l: cellNum(x.oil_qty_l) ?? keep("oil_qty_l", 20),
    oil_change_months: cellNum(x.oil_change_months) ?? keep("oil_change_months", 6),
    oil_sample_months: cellNum(x.oil_sample_months) ?? keep("oil_sample_months", 3),
    // left out when blank so a new machine gets the column default
    ...((x.install_date || old?.install_date) ? { install_date: x.install_date || old?.install_date } : {}),
    last_update: old ? old.last_update : new Date().toISOString().slice(0, 7),
  };
}

// Header row of the Excel export / import template → Asset field.
// Health, Status and Last Update are read-only, so they are not mapped.
const HEADER_FIELD: Record<string, keyof Asset> = {
  "ID": "id", "Name": "name", "Type": "type", "Site": "site", "Install Date": "install_date",
  "Motor kW": "motor_kw", "RPM": "rpm", "VG Grade": "vg_grade", "Oil Brand": "oil_brand",
  "Oil Qty (L)": "oil_qty_l", "Oil Change (mo)": "oil_change_months", "Oil Sample (mo)": "oil_sample_months",
};

// Sheet rows (objects keyed by header, as XLSX sheet_to_json gives them) → assets for importAssets.
export function assetsFromSheetRows(rows: Record<string, unknown>[]): Asset[] {
  return rows.map((r) => {
    const a: Record<string, unknown> = {};
    for (const [h, v] of Object.entries(r)) {
      const f = HEADER_FIELD[h.trim()];
      if (!f) continue;
      a[f] = v instanceof Date
        ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`
        : typeof v === "string" ? v.trim() : v;
    }
    return a as unknown as Asset;
  }).filter((a) => a.id && a.name);
}
