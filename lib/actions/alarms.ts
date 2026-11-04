"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/env";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { logAudit } from "./audit-log";
import { requirePermission } from "./guards";
import { getAssetAlarmConfig, type AssetAlarmConfig } from "@/lib/queries/alarms";

// Thin server-action wrapper so the client component can fetch a specific
// asset's effective (merged) alarm config on demand (query functions aren't
// directly callable from "use client" code).
export async function getAssetAlarmConfigAction(assetId: string): Promise<AssetAlarmConfig> {
  return getAssetAlarmConfig(assetId);
}

export interface AlarmSaveInput {
  params: { id: string; warn_limit: number | null; crit_limit: number | null; warn_penalty: number; crit_penalty: number }[];
  scoreConfig: {
    oil_weight: number;
    vib_weight: number;
    warn_penalty: number;
    crit_penalty: number;
  };
}

// Penalties and weights are 0–100 (the form keeps them there); the server checks too:
// a negative penalty adds points in SQL but is skipped by the TS port (lib/scoring/audit.ts).
const PCT_MSG = "ค่าหักคะแนนและน้ำหนักต้องอยู่ระหว่าง 0–100";
function penaltiesInRange(input: {
  params: { warn_penalty?: number | null; crit_penalty?: number | null }[];
  scoreConfig: { oil_weight?: number | null; vib_weight?: number | null; warn_penalty?: number | null; crit_penalty?: number | null };
}): boolean {
  const s = input.scoreConfig;
  return [...input.params.flatMap((p) => [p.warn_penalty, p.crit_penalty]), s.oil_weight, s.vib_weight, s.warn_penalty, s.crit_penalty]
    .every((v) => v == null || (Number.isFinite(v) && v >= 0 && v <= 100));
}

export async function saveAlarmConfig(input: AlarmSaveInput): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  // Explicit guard: recompute_all_health() below runs on the service-role
  // client (bypasses RLS), so this action must not rely on RLS alone.
  const auth = await requirePermission("alarms:write");
  if (!auth.ok) return auth.error;
  if (!penaltiesInRange(input)) return { ok: false, message: PCT_MSG };

  // RLS-enforced updates with the user's session (engineer/admin only).
  const supabase = createClient();
  // On a failed write, still recompute: the rows saved before it already changed
  // the limits, and the cached scores must follow them.
  let saveErr: string | null = null;
  for (const p of input.params) {
    const { error } = await supabase
      .from("alarm_params")
      .update({ warn_limit: p.warn_limit, crit_limit: p.crit_limit, warn_penalty: p.warn_penalty, crit_penalty: p.crit_penalty })
      .eq("id", p.id);
    if (error) { saveErr = error.message; break; }
  }
  if (!saveErr) {
    const { error: cfgErr } = await supabase
      .from("score_config")
      .update({
        oil_weight: input.scoreConfig.oil_weight,
        vib_weight: input.scoreConfig.vib_weight,
        warn_penalty: input.scoreConfig.warn_penalty,
        crit_penalty: input.scoreConfig.crit_penalty,
      })
      .eq("id", 1);
    if (cfgErr) saveErr = cfgErr.message;
  }

  // Recompute every asset — requires service role (cross-row update).
  const admin = createAdminClient();
  const { error: rpcErr } = await admin.rpc("recompute_all_health");
  if (saveErr) return { ok: false, message: saveErr };
  if (rpcErr) return { ok: false, message: rpcErr.message };

  revalidatePath("/dashboard");
  revalidatePath("/config/alarms");
  revalidatePath("/assets", "layout");
  await logAudit({
    action: "UPDATE",
    table_name: "alarm_params",
    record_id: "config",
    new_value: { paramCount: input.params.length, scoreConfig: input.scoreConfig },
  });
  return {
    ok: true,
    message: "บันทึกการตั้งค่าสำเร็จ และคำนวณคะแนนสุขภาพใหม่ทั้งหมด",
  };
  });
}

export interface AssetAlarmSaveInput {
  assetId: string;
  params: { category: "oil" | "vib"; key: string; warn_limit: number | null; crit_limit: number | null; warn_penalty: number | null; crit_penalty: number | null }[];
  scoreConfig: { oil_weight: number | null; vib_weight: number | null; warn_penalty: number | null; crit_penalty: number | null };
}

// Always writes a FULL override (never a partial diff) — every param row and the
// score-override row are replaced wholesale on each save, so the asset's override
// state is exactly what's currently shown in the editor, with no stale leftovers.
export async function saveAssetAlarmOverride(input: AssetAlarmSaveInput): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async (): Promise<ActionResult> => {
    const auth = await requirePermission("alarms:write");
    if (!auth.ok) return auth.error;
    if (!penaltiesInRange(input)) return { ok: false, message: PCT_MSG };

    const supabase = createClient();
    // The first failed write's message, or null. Upsert first, then delete the rows
    // no longer shown — no transaction here, so a failed write must not leave the
    // machine with its overrides wiped.
    const rows = input.params
      .filter((p) => p.warn_limit != null || p.crit_limit != null || p.warn_penalty != null || p.crit_penalty != null)
      .map((p) => ({ asset_id: input.assetId, ...p }));
    const writeOverrides = async (): Promise<string | null> => {
      if (rows.length > 0) {
        const { error } = await supabase.from("asset_alarm_overrides").upsert(rows, { onConflict: "asset_id,category,key" });
        if (error) return error.message;
      }
      const keep = new Set(rows.map((r) => `${r.category}|${r.key}`));
      const { data: current, error: curErr } = await supabase.from("asset_alarm_overrides").select("id,category,key").eq("asset_id", input.assetId);
      if (curErr) return curErr.message;
      const stale = (current ?? []).filter((r) => !keep.has(`${r.category}|${r.key}`)).map((r) => r.id as string);
      if (stale.length > 0) {
        const { error: delErr } = await supabase.from("asset_alarm_overrides").delete().in("id", stale);
        if (delErr) return delErr.message;
      }

      const hasScoreOverride =
        input.scoreConfig.oil_weight != null ||
        input.scoreConfig.vib_weight != null ||
        input.scoreConfig.warn_penalty != null ||
        input.scoreConfig.crit_penalty != null;
      const { error } = hasScoreOverride
        ? await supabase.from("asset_score_overrides").upsert({ asset_id: input.assetId, ...input.scoreConfig }, { onConflict: "asset_id" })
        : await supabase.from("asset_score_overrides").delete().eq("asset_id", input.assetId);
      return error ? error.message : null;
    };
    const saveErr = await writeOverrides();

    // Recompute even after a failed write: the writes before it already changed the limits.
    const admin = createAdminClient();
    const { error: rpcErr } = await admin.rpc("compute_health", { p_asset_id: input.assetId });
    if (saveErr) return { ok: false, message: saveErr };
    if (rpcErr) return { ok: false, message: rpcErr.message };

    revalidatePath("/dashboard");
    revalidatePath("/config/alarms");
    revalidatePath(`/assets/${input.assetId}`);
    await logAudit({
      action: "UPDATE",
      table_name: "asset_alarm_overrides",
      record_id: input.assetId,
      new_value: { paramCount: rows.length, scoreConfig: input.scoreConfig },
    });
    return { ok: true, message: "บันทึกค่าเฉพาะเครื่องนี้สำเร็จ" };
  });
}

// Pushes the global oil/vib weight onto every asset that currently has a
// score override — used by the "ปรับทั้งหมด" button next to Overall Score
// Weighting so an engineer doesn't have to open each override one by one just
// to re-sync its weight after changing the global value. Only the weight
// fields are touched; any warn_penalty/crit_penalty override on those assets
// is left as-is, since that's a separate concern (Penalty Default).
export async function applyWeightToAllOverrides(oil_weight: number, vib_weight: number): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async (): Promise<ActionResult> => {
    const auth = await requirePermission("alarms:write");
    if (!auth.ok) return auth.error;

    const supabase = createClient();
    const { data: overrides, error: selErr } = await supabase.from("asset_score_overrides").select("asset_id");
    if (selErr) return { ok: false, message: selErr.message };
    const assetIds = (overrides ?? []).map((r) => r.asset_id as string);

    if (assetIds.length > 0) {
      const { error } = await supabase
        .from("asset_score_overrides")
        .update({ oil_weight, vib_weight })
        .in("asset_id", assetIds);
      if (error) return { ok: false, message: error.message };
    }

    const admin = createAdminClient();
    const { error: rpcErr } = await admin.rpc("recompute_all_health");
    if (rpcErr) return { ok: false, message: rpcErr.message };

    revalidatePath("/dashboard");
    revalidatePath("/config/alarms");
    revalidatePath("/assets", "layout");
    await logAudit({
      action: "UPDATE",
      table_name: "asset_score_overrides",
      record_id: "all",
      new_value: { assetCount: assetIds.length, oil_weight, vib_weight },
    });
    return {
      ok: true,
      message: assetIds.length > 0
        ? `ปรับน้ำหนักคะแนนของ ${assetIds.length} เครื่องที่มีค่าเฉพาะเครื่องให้ตรงกับค่ากลางแล้ว`
        : "ไม่มีเครื่องจักรที่ตั้งค่าเฉพาะเครื่องอยู่ — ทุกเครื่องใช้ค่ากลางอยู่แล้ว",
    };
  });
}

export async function deleteAssetAlarmOverride(assetId: string): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async (): Promise<ActionResult> => {
    const auth = await requirePermission("alarms:write");
    if (!auth.ok) return auth.error;

    const supabase = createClient();
    const { error: e1 } = await supabase.from("asset_alarm_overrides").delete().eq("asset_id", assetId);
    if (e1) return { ok: false, message: e1.message };
    const { error: e2 } = await supabase.from("asset_score_overrides").delete().eq("asset_id", assetId);
    if (e2) return { ok: false, message: e2.message };

    const admin = createAdminClient();
    const { error: rpcErr } = await admin.rpc("compute_health", { p_asset_id: assetId });
    if (rpcErr) return { ok: false, message: rpcErr.message };

    revalidatePath("/dashboard");
    revalidatePath("/config/alarms");
    revalidatePath(`/assets/${assetId}`);
    await logAudit({ action: "DELETE", table_name: "asset_alarm_overrides", record_id: assetId });
    return { ok: true, message: "รีเซ็ตเป็นค่ากลางสำเร็จ" };
  });
}
