// Local Store — a file-backed stand-in for the Supabase tables that Data Entry writes
// (oil_readings, vib_readings, reading_attachments + the lab-attachments bucket), used
// only in Demo Mode with LOCAL_STORE=true (see isLocalStore() in lib/env.ts).
//
// Rows keep the exact column names of supabase/0001_schema.sql + 0003_attachments.sql
// so /api/local-store/export can turn them into an upsert script for Supabase or a
// company Postgres server without any mapping. Server-only (node:fs).
//
// Layout under LOCAL_DATA_DIR (default <project>/.local-data, git-ignored):
//   oil_readings.json · vib_readings.json · reading_attachments.json
//   files/<storage_path>          ← the uploaded lab files

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { OilReading, ReadingAttachment, VibReading } from "@/lib/types";

export type LocalOilRow = OilReading & { asset_id: string; updated_at: string };
export type LocalVibRow = VibReading & { asset_id: string; updated_at: string };

export const BLANK_OIL: OilReading = {
  period: "", fe: null, cu: null, si: null, water: null, visc: null, tan: null,
  iso_code: null, particle_4: null, particle_6: null, particle_14: null,
};
export const BLANK_VIB: VibReading = { period: "", vel: null, acc: null, cf: null, temp: null };

type TableName = "oil_readings" | "vib_readings" | "reading_attachments" | "audit_log";

function localDataDir(): string {
  return process.env.LOCAL_DATA_DIR || path.join(process.cwd(), ".local-data");
}

function tableFile(t: TableName): string {
  return path.join(localDataDir(), `${t}.json`);
}

// Per-table cache keyed by file mtime, so every server bundle/worker reading the
// same files sees a write without needing a shared in-memory module.
const cache = new Map<TableName, { mtime: number; rows: unknown[] }>();

function readTable<T>(t: TableName): T[] {
  const file = tableFile(t);
  let mtime: number;
  try {
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    return [];
  }
  const hit = cache.get(t);
  if (hit && hit.mtime === mtime) return hit.rows as T[];
  try {
    const rows = JSON.parse(fs.readFileSync(file, "utf8")) as T[];
    cache.set(t, { mtime, rows });
    return rows;
  } catch (e) {
    // A corrupt file must not take down every page — log it and serve no rows.
    console.error(`[local-store] cannot read ${file}`, e);
    return [];
  }
}

function writeTable<T>(t: TableName, rows: T[]): void {
  const file = tableFile(t);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // write-then-rename so a crash mid-write never leaves a half-written table
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 1), "utf8");
  fs.renameSync(tmp, file);
  cache.delete(t);
}

/** Changes whenever any table is written — lets callers drop derived caches (e.g. demo health). */
export function localStoreVersion(): string {
  const parts: number[] = [];
  for (const t of ["oil_readings", "vib_readings", "reading_attachments"] as const) {
    try {
      parts.push(fs.statSync(tableFile(t)).mtimeMs);
    } catch {
      parts.push(0);
    }
  }
  return parts.join(":");
}

// ---- readings (upsert on asset_id + period, same as the Supabase unique key) ----

// Indexed once per cached table array, so per-asset lookups over ~900 assets stay O(1).
const byAsset = new WeakMap<object, Map<string, unknown[]>>();

function rowsOf<T extends { asset_id: string }>(rows: T[], assetId: string): T[] {
  let index = byAsset.get(rows);
  if (!index) {
    index = new Map();
    for (const r of rows) {
      const list = index.get(r.asset_id);
      if (list) list.push(r);
      else index.set(r.asset_id, [r]);
    }
    byAsset.set(rows, index);
  }
  return (index.get(assetId) ?? []) as T[];
}

export function getLocalOil(assetId?: string): LocalOilRow[] {
  const rows = readTable<LocalOilRow>("oil_readings");
  return assetId ? rowsOf(rows, assetId) : rows;
}

export function getLocalVib(assetId?: string): LocalVibRow[] {
  const rows = readTable<LocalVibRow>("vib_readings");
  return assetId ? rowsOf(rows, assetId) : rows;
}

// Change history (the machine page's "ประวัติ" tab) — same columns as public.audit_log.
export interface LocalAuditRow {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export function getLocalAudit(): LocalAuditRow[] {
  return readTable<LocalAuditRow>("audit_log");
}

export function appendLocalAudit(row: Omit<LocalAuditRow, "id" | "created_at">): void {
  writeTable("audit_log", [...getLocalAudit(), { ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
}

// Like the Supabase upsert: columns not in `row` keep their saved value (null on a new row).
// A row left with no values is dropped, as saveReading deletes it in Supabase.
type LocalKey = { asset_id: string; period: string };
const META = new Set(["asset_id", "period", "updated_at"]);
const isBlank = (r: object) => Object.entries(r).every(([k, v]) => META.has(k) || v == null);

export function upsertLocalOil(row: LocalKey & Partial<OilReading>): void {
  const all = getLocalOil();
  const old = all.find((r) => r.asset_id === row.asset_id && r.period === row.period);
  const rows = all.filter((r) => r !== old);
  const merged = { ...BLANK_OIL, ...old, ...row, updated_at: new Date().toISOString() };
  if (!isBlank(merged)) rows.push(merged);
  writeTable("oil_readings", rows);
}

export function upsertLocalVib(row: LocalKey & Partial<VibReading>): void {
  const all = getLocalVib();
  const old = all.find((r) => r.asset_id === row.asset_id && r.period === row.period);
  const rows = all.filter((r) => r !== old);
  const merged = { ...BLANK_VIB, ...old, ...row, updated_at: new Date().toISOString() };
  if (!isBlank(merged)) rows.push(merged);
  writeTable("vib_readings", rows);
}

/** Remove one saved period. false = nothing saved locally for it (e.g. built-in demo history). */
export function deleteLocalReading(kind: "oil" | "vib", assetId: string, period: string): boolean {
  const table = kind === "oil" ? "oil_readings" : "vib_readings";
  const all = kind === "oil" ? getLocalOil() : getLocalVib();
  const rows = all.filter((r) => !(r.asset_id === assetId && r.period === period));
  if (rows.length === all.length) return false;
  writeTable(table, rows);
  return true;
}

/** Built-in demo history with locally saved periods replacing/adding to it, oldest first. */
export function mergeHistory<T extends { period: string }>(base: T[], local: (T & { asset_id: string; updated_at: string })[]): T[] {
  if (local.length === 0) return base;
  const byPeriod = new Map<string, T>();
  for (const r of base) byPeriod.set(r.period, r);
  for (const r of local) {
    // strip the bookkeeping columns so callers get the same shape as the demo rows;
    // only the local row's values replace the built-in ones (a visc-only file keeps the built-in Fe).
    // shortcut: a value cleared locally shows the built-in demo value again — demo history only.
    const { asset_id: _a, updated_at: _u, ...reading } = r;
    const given = Object.fromEntries(Object.entries(reading).filter(([, v]) => v != null));
    byPeriod.set(r.period, { ...byPeriod.get(r.period), ...given } as unknown as T);
  }
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}

// ---- attachments ----

function filesDir(): string {
  return path.join(localDataDir(), "files");
}

/** Resolve a storage_path inside files/, refusing anything that escapes it. */
export function localFilePath(storagePath: string): string | null {
  const root = filesDir();
  const full = path.resolve(root, storagePath);
  return full.startsWith(root + path.sep) ? full : null;
}

export function listLocalAttachments(assetId: string, period?: string): ReadingAttachment[] {
  return readTable<ReadingAttachment>("reading_attachments")
    .filter((a) => a.asset_id === assetId && (!period || a.period === period))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getLocalAttachment(id: string): ReadingAttachment | null {
  return readTable<ReadingAttachment>("reading_attachments").find((a) => a.id === id) ?? null;
}

export function allLocalAttachments(): ReadingAttachment[] {
  return readTable<ReadingAttachment>("reading_attachments");
}

export function addLocalAttachment(
  meta: Omit<ReadingAttachment, "id" | "created_at">,
  data: Buffer,
): ReadingAttachment {
  const full = localFilePath(meta.storage_path);
  if (!full) throw new Error("invalid storage path");
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
  const row: ReadingAttachment = { ...meta, id: crypto.randomUUID(), created_at: new Date().toISOString() };
  writeTable("reading_attachments", [...readTable<ReadingAttachment>("reading_attachments"), row]);
  return row;
}

export function deleteLocalAttachment(id: string): boolean {
  const rows = readTable<ReadingAttachment>("reading_attachments");
  const row = rows.find((a) => a.id === id);
  if (!row) return false;
  writeTable("reading_attachments", rows.filter((a) => a.id !== id));
  const full = localFilePath(row.storage_path);
  if (full) fs.rmSync(full, { force: true });
  return true;
}
