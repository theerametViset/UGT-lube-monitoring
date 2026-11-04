"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode, isLocalStore } from "@/lib/env";
import { getLocalOil, getLocalVib, upsertLocalOil, upsertLocalVib } from "@/lib/local-store";
import { getDemoOilHistory, isDemoAssetId } from "@/lib/demo-data";
import { isFuturePeriod, isPeriod } from "@/lib/parse/period";
import { STORED_COLS, readingCols } from "@/lib/reading-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReadingsHistory } from "@/lib/queries/readings";
import type { OilReading, VibReading } from "@/lib/types";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { requirePermission } from "./guards";
import { logAudit } from "./audit-log";

export interface ReadingInput {
  assetId: string;
  period: string; // YYYY-MM
  kind: "oil" | "vib";
  values: Record<string, number | string | null>;
}

export async function saveReading(input: ReadingInput): Promise<ActionResult> {
  if (isLocalStore()) return runAction(async () => saveReadingLocal(input));
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("readings:write");
    if (!auth.ok) return auth.error;
    if (!isPeriod(input.period) || !input.assetId) {
      return { ok: false, message: "ข้อมูลไม่ครบ (เครื่องจักร / งวด)" };
    }
    if (isFuturePeriod(input.period)) return { ok: false, message: `งวด ${input.period} อยู่ในอนาคต — ตรวจวันที่เก็บตัวอย่าง` };
    const supabase = createClient();
    const table = input.kind === "oil" ? "oil_readings" : "vib_readings";
    const cols = readingCols(input);
    // Nothing to write (e.g. a files-only save): no reading row — an empty one would
    // count as the latest reading and score 100.
    let before: Record<string, unknown> | null = null;
    if (Object.keys(cols).length > 0) {
      const { data: old } = await supabase.from(table).select(Object.keys(cols).join(",")).eq("asset_id", input.assetId).eq("period", input.period).maybeSingle();
      before = (old as Record<string, unknown> | null) ?? null;
      // Only the sent columns are in the upsert, so the update leaves the others alone.
      const { error } = await supabase.from(table).upsert({ asset_id: input.assetId, period: input.period, ...cols }, { onConflict: "asset_id,period" });
      if (error) return { ok: false, message: error.message };
      // Clearing the last value leaves an empty row: delete it so the previous period
      // counts again. Deletes have no recompute trigger, so recompute here.
      if (Object.values(cols).includes(null)) {
        const { data: row } = await supabase.from(table).select(STORED_COLS[input.kind].join(",")).eq("asset_id", input.assetId).eq("period", input.period).maybeSingle();
        if (row && Object.values(row).every((v) => v == null)) {
          const { error: delErr } = await supabase.from(table).delete().eq("asset_id", input.assetId).eq("period", input.period);
          if (delErr) return { ok: false, message: delErr.message };
          const { error: rpcErr } = await createAdminClient().rpc("compute_health", { p_asset_id: input.assetId });
          if (rpcErr) return { ok: false, message: rpcErr.message };
        }
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/assets");
    revalidatePath(`/assets/${input.assetId}`);
    await logAudit({
      action: "UPSERT",
      table_name: input.kind === "oil" ? "oil_readings" : "vib_readings",
      record_id: `${input.assetId}/${input.period}`,
      old_value: before ?? undefined,
      new_value: cols,
    });
    return { ok: true, message: "บันทึกข้อมูลสำเร็จ" };
  });
}

// What is already saved for this machine + period, so Data Entry can show it and
// let the user clear a wrong value (saveReading leaves unsent columns alone).
// Reads go through RLS like every other page.
export async function getSavedReadings(assetId: string, period: string): Promise<{ oil: OilReading | null; vib: VibReading | null }> {
  if (!assetId || !isPeriod(period)) return { oil: null, vib: null };
  const h = await getReadingsHistory(assetId);
  return {
    oil: h.oil.find((r) => r.period === period) ?? null,
    vib: h.vib.find((r) => r.period === period) ?? null,
  };
}

// Same row as the Supabase upsert above, written to lib/local-store instead.
async function saveReadingLocal(input: ReadingInput): Promise<ActionResult> {
  if (!isPeriod(input.period) || !input.assetId) {
    return { ok: false, message: "ข้อมูลไม่ครบ (เครื่องจักร / งวด)" };
  }
  if (isFuturePeriod(input.period)) return { ok: false, message: `งวด ${input.period} อยู่ในอนาคต — ตรวจวันที่เก็บตัวอย่าง` };
  // Supabase rejects an unknown asset_id via its foreign key; the file store must too,
  // or the reading is orphaned and the SQL export fails on import.
  if (!isDemoAssetId(input.assetId)) {
    return { ok: false, message: `ไม่พบเครื่องจักร "${input.assetId}" ในระบบ — เพิ่มในฐานข้อมูลเครื่องจักรก่อน` };
  }
  const cols = readingCols(input);
  if (Object.keys(cols).length > 0) {
    const same = (r: { asset_id: string; period: string }) => r.asset_id === input.assetId && r.period === input.period;
    const old = (input.kind === "oil" ? getLocalOil() : getLocalVib()).find(same) as Record<string, unknown> | undefined;
    const row = { asset_id: input.assetId, period: input.period, ...cols };
    if (input.kind === "oil") upsertLocalOil(row);
    else upsertLocalVib(row);
    await logAudit({
      action: "UPSERT",
      table_name: input.kind === "oil" ? "oil_readings" : "vib_readings",
      record_id: `${input.assetId}/${input.period}`,
      old_value: old ? Object.fromEntries(Object.keys(cols).map((k) => [k, old[k] ?? null])) : undefined,
      new_value: cols,
    });
  }
  // Same paths as the Supabase branch.
  revalidatePath("/dashboard");
  revalidatePath("/assets");
  revalidatePath(`/assets/${input.assetId}`);
  return { ok: true, message: "บันทึกในเครื่องแล้ว (Local Store — ยังไม่ขึ้นฐานข้อมูลกลาง)" };
}

export interface OilBatchRow {
  assetId: string;
  period: string;
  values: Record<string, number | string | null>;
}
export type BatchResult = ActionResult & { saved?: number; failedKeys?: string[]; failed?: string[] };

const batchKey = (assetId: string, period: string) => `${assetId}|${period}`;

// A whole lab file in one request: one permission check, one upsert per set of columns,
// one audit insert and one page refresh. Row by row it took ~8 round trips per row, and
// closing the tab halfway left half a file saved. Rows go into an upsert only with rows
// that have the same columns, so a file without TAN never writes TAN = null over a saved one.
export async function saveOilBatch(rows: OilBatchRow[]): Promise<BatchResult> {
  if (isLocalStore()) {
    return runAction(async (): Promise<BatchResult> => {
      const failedKeys: string[] = [];
      const failed: string[] = [];
      for (const r of rows) {
        const res = await saveReadingLocal({ ...r, kind: "oil" });
        if (!res.ok) { failedKeys.push(batchKey(r.assetId, r.period)); failed.push(`${r.assetId} (${r.period}): ${res.message}`); }
      }
      const saved = rows.length - failed.length;
      return { ok: failed.length === 0, saved, failedKeys, failed, message: `บันทึกในเครื่อง ${saved} รายการ` };
    });
  }
  if (isDemoMode()) return demoBlocked();
  return runAction(async (): Promise<BatchResult> => {
    const auth = await requirePermission("readings:write");
    if (!auth.ok) return auth.error;
    const failedKeys: string[] = [];
    const failed: string[] = [];
    const fail = (assetId: string, period: string, why: string) => {
      failedKeys.push(batchKey(assetId, period));
      failed.push(`${assetId} (${period}): ${why}`);
    };
    const good: ({ asset_id: string; period: string } & Record<string, number | string | null>)[] = [];
    for (const r of rows) {
      const cols = readingCols({ kind: "oil", values: r.values });
      if (!r.assetId || !isPeriod(r.period)) fail(r.assetId, r.period, "ข้อมูลไม่ครบ (เครื่องจักร / งวด)");
      else if (isFuturePeriod(r.period)) fail(r.assetId, r.period, `งวด ${r.period} อยู่ในอนาคต`);
      else if (Object.keys(cols).length > 0) good.push({ asset_id: r.assetId, period: r.period, ...cols });
    }
    const supabase = createClient();

    // Old values for the audit log (only the machines and months in the file).
    const before = new Map<string, Record<string, unknown>>();
    const ids = [...new Set(good.map((r) => r.asset_id))];
    const periods = [...new Set(good.map((r) => r.period))];
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase.from("oil_readings").select(["asset_id", "period", ...STORED_COLS.oil].join(","))
        .in("asset_id", ids.slice(i, i + 100)).in("period", periods);
      for (const o of (data ?? []) as unknown as Record<string, unknown>[]) before.set(batchKey(String(o.asset_id), String(o.period)), o);
    }

    const groups = new Map<string, typeof good>();
    for (const r of good) {
      const k = Object.keys(r).sort().join(",");
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    const saved: typeof good = [];
    for (const g of groups.values()) {
      const { error } = await supabase.from("oil_readings").upsert(g, { onConflict: "asset_id,period" });
      if (error) for (const r of g) fail(r.asset_id, r.period, error.message);
      else saved.push(...g);
    }

    if (saved.length > 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("audit_log").insert(saved.map(({ asset_id, period, ...cols }) => {
          const old = before.get(batchKey(asset_id, period));
          return {
            user_id: user?.id ?? null,
            action: "UPSERT",
            table_name: "oil_readings",
            record_id: `${asset_id}/${period}`,
            old_value: old ? Object.fromEntries(Object.keys(cols).map((k) => [k, old[k] ?? null])) : null,
            new_value: cols,
          };
        }));
      } catch {
        // history must never block the save
      }
      revalidatePath("/dashboard");
      revalidatePath("/assets");
      revalidatePath("/assets/[id]", "page");
    }
    return { ok: failed.length === 0, saved: saved.length, failedKeys, failed, message: `บันทึก ${saved.length} รายการ` };
  });
}

// "asset|period" pairs that already have an oil reading, so a lab-file import can
// ask before it overwrites them (RLS-scoped like every read). null = the lookup failed:
// the import must not go ahead as if nothing were saved.
export async function getExistingOilKeys(assetIds: string[], periods: string[]): Promise<string[] | null> {
  const ids = [...new Set(assetIds.filter(Boolean))];
  const months = new Set(periods.filter(isPeriod));
  if (ids.length === 0 || months.size === 0) return [];
  if (isDemoMode()) {
    return ids.flatMap((id) => getDemoOilHistory(id).filter((r) => months.has(r.period)).map((r) => batchKey(id, r.period)));
  }
  try {
    const supabase = createClient();
    const out: string[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await supabase.from("oil_readings").select("asset_id,period").in("asset_id", ids.slice(i, i + 100)).in("period", [...months]);
      if (error) return null;
      for (const r of data ?? []) out.push(batchKey(r.asset_id as string, r.period as string));
    }
    return out;
  } catch {
    return null;
  }
}
