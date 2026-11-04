// Turns the Local Store (lib/local-store.ts) into one SQL script that loads it into
// Supabase or a company Postgres server running supabase/0001…00NN. Re-runnable:
// reference rows are insert-if-missing, readings upsert on (asset_id, period).
// Health is NOT exported — compute_health() rebuilds it from the readings (Iron Rule).

import { getDemoAssets, getDemoReference } from "@/lib/demo-data";
import { allLocalAttachments, getLocalOil, getLocalVib, type LocalOilRow, type LocalVibRow } from "@/lib/local-store";
import type { Asset, AssetType, ReadingAttachment, Site } from "@/lib/types";

interface ExportInput {
  oil: LocalOilRow[];
  vib: LocalVibRow[];
  attachments: ReadingAttachment[];
  assets: Asset[];
  sites: Site[];
  types: AssetType[];
  generatedAt: string;
}

/** SQL literal: NULL, a finite number, or a single-quoted string with quotes doubled. */
export function sqlLit(v: unknown): string {
  if (v === null || v === undefined || v === "") return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function values(rows: unknown[][]): string {
  return rows.map((r) => `  (${r.map(sqlLit).join(", ")})`).join(",\n");
}

export function buildExportSql(d: ExportInput): string {
  const usedIds = new Set([...d.oil, ...d.vib, ...d.attachments].map((r) => r.asset_id));
  const assets = d.assets.filter((a) => usedIds.has(a.id));
  const sites = d.sites.filter((s) => assets.some((a) => a.site === s.code));
  const types = d.types.filter((t) => assets.some((a) => a.type === t.name));

  const out: string[] = [
    "-- =============================================================================",
    `-- Local Store export · ${d.generatedAt}`,
    `-- ${d.oil.length} oil readings · ${d.vib.length} vibration readings · ${d.attachments.length} attachments · ${assets.length} assets`,
    "-- Run AFTER every supabase/00NN_*.sql migration (Supabase SQL Editor or psql).",
    "-- Safe to run again: missing sites/types/assets are added, readings upsert by (asset_id, period).",
    "-- Attachment FILES are not inside this script: upload each .local-data/files/<storage_path>",
    "-- to the 'lab-attachments' bucket (or company file server) at the same storage_path.",
    "-- =============================================================================",
    "begin;",
    "set local standard_conforming_strings = on; -- quoting below doubles ' and leaves \\ alone",
    "",
  ];

  if (sites.length) {
    out.push(
      "insert into public.sites (code, name, sort_order) values",
      values(sites.map((s) => [s.code, s.name, s.sort_order])),
      "on conflict (code) do nothing;",
      "",
    );
  }
  if (types.length) {
    out.push(
      "insert into public.asset_types (name, abbr, color) values",
      values(types.map((t) => [t.name, t.abbr, t.color])),
      "on conflict (name) do nothing;",
      "",
    );
  }
  if (assets.length) {
    out.push(
      "-- existing assets are left untouched",
      "insert into public.assets (id, name, type, site, install_date, motor_kw, rpm, vg_grade, oil_brand, oil_qty_l, oil_change_months, oil_sample_months, last_update) values",
      values(
        assets.map((a) => [
          a.id, a.name, a.type, a.site, a.install_date, a.motor_kw, a.rpm, a.vg_grade,
          a.oil_brand, a.oil_qty_l, a.oil_change_months, a.oil_sample_months, a.last_update,
        ]),
      ),
      "on conflict (id) do nothing;",
      "",
    );
  }
  if (d.oil.length) {
    out.push(
      // No cu / si: they are not measured any more (0031). Leaving them out also
      // keeps any Cu/Si already in Supabase instead of overwriting it with null.
      "insert into public.oil_readings (asset_id, period, fe, water, visc, tan, iso_code, particle_4, particle_6, particle_14) values",
      values(
        d.oil.map((r) => [
          r.asset_id, r.period, r.fe, r.water, r.visc, r.tan,
          r.iso_code, r.particle_4, r.particle_6, r.particle_14,
        ]),
      ),
      // coalesce: a value-less local column (e.g. a visc-only lab file) keeps what the
      // server has. shortcut: a value cleared locally is not cleared on the server.
      "on conflict (asset_id, period) do update set",
      ...coalesceSet("oil_readings", ["fe", "water", "visc", "tan", "iso_code", "particle_4", "particle_6", "particle_14"]),
      "",
    );
  }
  if (d.vib.length) {
    out.push(
      "insert into public.vib_readings (asset_id, period, vel, acc, cf, temp) values",
      values(d.vib.map((r) => [r.asset_id, r.period, r.vel, r.acc, r.cf, r.temp])),
      "on conflict (asset_id, period) do update set",
      ...coalesceSet("vib_readings", ["vel", "acc", "cf", "temp"]),
      "",
    );
  }
  if (d.attachments.length) {
    out.push(
      "insert into public.reading_attachments (id, asset_id, period, kind, file_name, storage_path, mime_type, size_bytes, created_at) values",
      values(
        d.attachments.map((a) => [
          a.id, a.asset_id, a.period, a.kind, a.file_name, a.storage_path, a.mime_type, a.size_bytes, a.created_at,
        ]),
      ),
      "on conflict (id) do nothing;",
      "",
    );
  }

  out.push("-- rebuild the health cache from the imported readings", "select public.recompute_all_health();", "", "commit;", "");
  return out.join("\n");
}

export function buildLocalExportSql(): string {
  const ref = getDemoReference();
  return buildExportSql({
    oil: getLocalOil(),
    vib: getLocalVib(),
    attachments: allLocalAttachments(),
    assets: getDemoAssets(),
    sites: ref.sites,
    types: ref.types,
    generatedAt: new Date().toISOString(),
  });
}

function coalesceSet(table: string, cols: string[]): string[] {
  return cols.map((c, i) => `  ${c} = coalesce(excluded.${c}, ${table}.${c})${i === cols.length - 1 ? ";" : ","}`);
}
