"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { requirePermission } from "./guards";
import { logAudit } from "./audit-log";
import { listStandards } from "@/lib/queries/standards";
import type { Standard, StandardCategory } from "@/lib/types";

type StandardInput = {
  title: string;
  category: StandardCategory;
  subtitle: string;
  description: string;
  full_text: string;
  tags: string;
  related_params?: string[];
  asset_types?: string[];
  related_standard_ids?: string[];
};

function parseTags(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

async function currentUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function createStandard(input: StandardInput): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("standards:write");
    if (!auth.ok) return auth.error;
    const supabase = createClient();
    const { error } = await supabase.from("standards").insert({
      title: input.title,
      category: input.category,
      subtitle: input.subtitle || null,
      description: input.description || null,
      full_text: input.full_text || null,
      tags: parseTags(input.tags),
      version: 1,
      related_params: input.related_params ?? [],
      asset_types: input.asset_types ?? [],
      related_standard_ids: input.related_standard_ids ?? [],
    });
    if (error) return { ok: false, message: error.message };
    await logAudit({ action: "INSERT", table_name: "standards", record_id: input.title, new_value: { title: input.title, category: input.category } });
    revalidatePath("/standards");
    return { ok: true, message: "เพิ่มมาตรฐานสำเร็จ" };
  });
}

// Edit + version bump (document control: every edit becomes a new version).
export async function updateStandard(id: string, input: StandardInput): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("standards:write");
    if (!auth.ok) return auth.error;
    const supabase = createClient();
    const { data: cur, error: curErr } = await supabase
      .from("standards")
      .select("version")
      .eq("id", id)
      .maybeSingle();
    if (curErr) return { ok: false, message: curErr.message };
    if (!cur) return { ok: false, message: "ไม่พบมาตรฐานนี้ในระบบ" };
    const version = (cur.version as number | undefined) ?? 1;

    const { error } = await supabase
      .from("standards")
      .update({
        title: input.title,
        category: input.category,
        subtitle: input.subtitle || null,
        description: input.description || null,
        full_text: input.full_text || null,
        tags: parseTags(input.tags),
        related_params: input.related_params ?? [],
        asset_types: input.asset_types ?? [],
        related_standard_ids: input.related_standard_ids ?? [],
        version: version + 1,
        updated_at: new Date().toISOString(),
        updated_by: (await currentUserId()) ?? null,
      })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };
    await logAudit({ action: "UPDATE", table_name: "standards", record_id: id, new_value: { title: input.title, version: version + 1 } });
    revalidatePath("/standards");
    return { ok: true, message: `บันทึกการแก้ไขสำเร็จ (v${version + 1})` };
  });
}

export async function deleteStandard(id: string): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("standards:write");
    if (!auth.ok) return auth.error;
    const supabase = createClient();
    const { data: deleted, error } = await supabase.from("standards").delete().eq("id", id).select("id");
    if (error) return { ok: false, message: error.message };
    if (!deleted?.length) return { ok: false, message: "ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไขรายการของโรงงานนี้" };
    await logAudit({ action: "DELETE", table_name: "standards", record_id: id });
    revalidatePath("/standards");
    return { ok: true, message: "ลบมาตรฐานแล้ว" };
  });
}

// Client-side refresh after mutations (the page list is stateful).
export async function getStandardsSnapshot(): Promise<Standard[]> {
  return listStandards({});
}
