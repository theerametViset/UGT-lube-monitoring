"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { requirePermission } from "./guards";
import { logAudit } from "./audit-log";

export async function addMaintenance(input: {
  assetId: string;
  type: "pm" | "cm";
  work_date: string;
  wo_no: string;
  description: string;
  parts: string;
  cost: number;
  technician: string;
}): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("maintenance:write");
    if (!auth.ok) return auth.error;
    const supabase = createClient();
    const row = {
      type: input.type,
      work_date: input.work_date || null,
      wo_no: input.wo_no || null,
      description: input.description,
      parts: input.parts || null,
      cost: input.cost || 0,
      technician: input.technician || null,
    };
    const { data, error } = await supabase.from("maintenance_records").insert({ asset_id: input.assetId, ...row }).select("id").single();
    if (error) return { ok: false, message: error.message };
    // "<asset>/maint/<id>": the machine's history tab finds it like a reading ("<asset>/<period>").
    await logAudit({ action: "INSERT", table_name: "maintenance_records", record_id: `${input.assetId}/maint/${data.id}`, new_value: row });
    revalidatePath(`/assets/${input.assetId}`);
    return { ok: true, message: "บันทึกประวัติการซ่อมบำรุงสำเร็จ" };
  });
}

export async function deleteMaintenance(id: string, assetId: string): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("maintenance:write");
    if (!auth.ok) return auth.error;
    const supabase = createClient();
    // Read it first, so the history shows what was deleted.
    const { data: before } = await supabase
      .from("maintenance_records")
      .select("type,work_date,wo_no,description,parts,cost,technician")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase.from("maintenance_records").delete().eq("id", id);
    if (error) return { ok: false, message: error.message };
    await logAudit({ action: "DELETE", table_name: "maintenance_records", record_id: `${assetId}/maint/${id}`, old_value: before ?? undefined });
    revalidatePath(`/assets/${assetId}`);
    return { ok: true, message: "ลบรายการสำเร็จ" };
  });
}
