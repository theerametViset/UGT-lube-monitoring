"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { importRow } from "@/lib/asset-import";
import { isDemoMode } from "@/lib/env";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { requirePermission } from "./guards";
import { logAudit } from "./audit-log";
import { getDemoAssets } from "@/lib/demo-data";
import type { Asset } from "@/lib/types";

const COLS =
  "id,name,type,site,health,status,install_date,motor_kw,rpm,vg_grade,oil_brand,oil_qty_l,oil_change_months,oil_sample_months,last_update";

// The only columns a user may write. health/status are compute_health's cache
// (iron rule) and must never come from the client — the TS types below are
// not checked at runtime.
const EDITABLE = ["name", "type", "site", "vg_grade", "motor_kw", "rpm", "oil_brand", "oil_qty_l", "oil_change_months", "oil_sample_months"] as const;

export async function createAsset(input: {
  id: string;
  name: string;
  type: string;
  site: string;
  vg_grade: number;
  motor_kw: number;
  rpm: number;
  oil_brand: string;
  oil_qty_l: number;
  oil_change_months: number;
  oil_sample_months: number;
}): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  const auth = await requirePermission("assets:write");
  if (!auth.ok) return auth.error;
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("id", input.id)
    .maybeSingle();
  if (existing) return { ok: false, message: "ID นี้มีอยู่แล้ว" };

  const { error } = await supabase.from("assets").insert({
    id: input.id,
    name: input.name,
    type: input.type,
    site: input.site,
    vg_grade: input.vg_grade,
    motor_kw: input.motor_kw,
    rpm: input.rpm,
    oil_brand: input.oil_brand,
    oil_qty_l: input.oil_qty_l,
    oil_change_months: input.oil_change_months,
    oil_sample_months: input.oil_sample_months,
    health: 100,
    status: "Healthy",
    last_update: new Date().toISOString().slice(0, 7),
  });
  if (error) return { ok: false, message: error.message };
  await logAudit({ action: "INSERT", table_name: "assets", record_id: input.id, new_value: { ...input } });
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { ok: true, message: "เพิ่มเครื่องจักรสำเร็จ" };
  });
}

export async function updateAsset(
  id: string,
  input: Partial<{
    name: string;
    type: string;
    site: string;
    vg_grade: number;
    motor_kw: number;
    rpm: number;
    oil_brand: string;
    oil_qty_l: number;
    oil_change_months: number;
    oil_sample_months: number;
  }>,
): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  const auth = await requirePermission("assets:write");
  if (!auth.ok) return auth.error;
  const patch = Object.fromEntries(EDITABLE.filter((k) => k in input).map((k) => [k, input[k]]));
  const supabase = createClient();
  const { data: before } = await supabase.from("assets").select(EDITABLE.join(",")).eq("id", id).maybeSingle();
  const { error } = await supabase.from("assets").update(patch).eq("id", id);
  if (error) return { ok: false, message: error.message };
  // Viscosity is scored against the VG grade (0027), so a new grade moves the score.
  if ("vg_grade" in patch) {
    const { error: rpcErr } = await createAdminClient().rpc("compute_health", { p_asset_id: id });
    if (rpcErr) return { ok: false, message: rpcErr.message };
  }
  // History shows "VG 2 → 220": keep only the fields that really changed.
  const old = (before ?? {}) as Record<string, unknown>;
  const changed = Object.keys(patch).filter((k) => String(old[k] ?? "") !== String(patch[k] ?? ""));
  await logAudit({
    action: "UPDATE", table_name: "assets", record_id: id,
    old_value: Object.fromEntries(changed.map((k) => [k, old[k] ?? null])),
    new_value: Object.fromEntries(changed.map((k) => [k, patch[k]])),
  });
  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "บันทึกการแก้ไขสำเร็จ" };
  });
}

export async function deleteAsset(id: string): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  const auth = await requirePermission("assets:delete");
  if (!auth.ok) return auth.error;
  const supabase = createClient();
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  await logAudit({ action: "DELETE", table_name: "assets", record_id: id });
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { ok: true, message: "ลบสำเร็จ" };
  });
}

export async function deleteAssets(ids: string[]): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  const auth = await requirePermission("assets:delete");
  if (!auth.ok) return auth.error;
  const supabase = createClient();
  const { error } = await supabase.from("assets").delete().in("id", ids);
  if (error) return { ok: false, message: error.message };
  await logAudit({ action: "DELETE", table_name: "assets", record_id: ids.join(",") });
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { ok: true, message: `ลบ ${ids.length} รายการสำเร็จ` };
  });
}

export async function deleteAllAssets(): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  // Wiping the entire fleet needs the stricter assets:delete_all permission
  // (engineers with plain assets:delete may still delete individual assets
  // through deleteAsset/deleteAssets).
  const auth = await requirePermission("assets:delete_all");
  if (!auth.ok) return auth.error;
  const supabase = createClient();
  const { error } = await supabase.from("assets").delete().neq("id", "__none__");
  if (error) return { ok: false, message: error.message };
  await logAudit({ action: "DELETE", table_name: "assets", record_id: "__all__" });
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { ok: true, message: "ลบทั้งหมดแล้ว" };
  });
}

export async function importAssets(items: Asset[]): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  const auth = await requirePermission("assets:import");
  if (!auth.ok) return auth.error;
  const supabase = createClient();
  const existing = new Map(
    (await fetchAll<Asset>((from, to) => supabase.from("assets").select(COLS).order("id").range(from, to))).map((a) => [a.id, a]),
  );
  // The foreign keys would reject the whole upsert for one row with an unknown plant or
  // type, so those rows are left out and named instead.
  const [{ data: siteRows }, { data: typeRows }] = await Promise.all([
    supabase.from("sites").select("code"),
    supabase.from("asset_types").select("name"),
  ]);
  const sites = new Set((siteRows ?? []).map((s) => s.code as string));
  const types = new Set((typeRows ?? []).map((t) => t.name as string));
  // The same ID twice makes Postgres reject the whole upsert: keep the last row, name the ID.
  const byId = new Map<string, Asset>();
  const dupIds = new Set<string>();
  for (const x of items.filter((x) => x && x.id && x.name)) {
    if (byId.has(x.id)) dupIds.add(x.id);
    byId.set(x.id, x);
  }
  const all = [...byId.values()].map((x) => importRow(x, existing.get(x.id)));
  // vg_grade and the month cycles are int columns: "4.5" would reject the whole upsert.
  const intOk = (r: (typeof all)[number]) => [r.vg_grade, r.oil_change_months, r.oil_sample_months].every((v) => v == null || Number.isInteger(v));
  const rows = all.filter((r) => sites.has(r.site) && types.has(r.type) && intOk(r));
  const skipped = all.filter((r) => !rows.includes(r) && intOk(r)).map((r) => r.id);
  const notInt = all.filter((r) => !intOk(r)).map((r) => r.id);
  const list = (xs: string[]) => `${xs.slice(0, 10).join(", ")}${xs.length > 10 ? " …" : ""}`;
  const skipNote =
    (skipped.length ? ` · ข้าม ${skipped.length} แถวที่ไม่ระบุโรงงาน หรือโรงงาน/ประเภทไม่มีในระบบ: ${list(skipped)}` : "") +
    (notInt.length ? ` · ข้าม ${notInt.length} แถวที่ VG / รอบเปลี่ยน / รอบเก็บตัวอย่างไม่ใช่จำนวนเต็ม: ${list(notInt)}` : "") +
    (dupIds.size ? ` · รหัสซ้ำในไฟล์ (ใช้แถวล่างสุด): ${list([...dupIds])}` : "");
  if (rows.length === 0) return { ok: false, message: `ไม่มีข้อมูลที่ถูกต้อง${skipNote}` };
  const { error } = await supabase.from("assets").upsert(rows, { onConflict: "id" });
  if (error) return { ok: false, message: error.message };
  // VG grades may have changed, which moves viscosity scores.
  const { error: rpcErr } = await createAdminClient().rpc("recompute_all_health");
  if (rpcErr) return { ok: false, message: rpcErr.message };
  await logAudit({ action: "INSERT", table_name: "assets", record_id: rows.map((r) => r.id).join(","), new_value: { count: rows.length } });
  revalidatePath("/assets");
  revalidatePath("/dashboard");
  return { ok: true, message: `นำเข้า ${rows.length} รายการสำเร็จ${skipNote}` };
  });
}

export async function exportAssetsJson(): Promise<string> {
  // Demo mode has no Supabase env — export the demo fleet instead of crashing.
  if (isDemoMode()) return JSON.stringify(getDemoAssets(), null, 2);
  try {
    const supabase = createClient();
    const data = await fetchAll((from, to) => supabase.from("assets").select(COLS).order("id").range(from, to));
    return JSON.stringify(data, null, 2);
  } catch (e) {
    console.error("[exportAssetsJson]", e);
    return "[]";
  }
}
