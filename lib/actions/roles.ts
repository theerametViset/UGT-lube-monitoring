"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { requirePermission } from "./guards";
import { logAudit } from "./audit-log";
import { MENU_HREFS } from "@/lib/nav";
import { managersLeft } from "@/lib/queries/users";

// role id is used as a Postgres text primary key AND referenced from
// profiles.role — keep it a plain slug so it's safe in both places and in URLs.
const SLUG_RE = /^[a-z][a-z0-9_-]{1,31}$/;

export async function createRole(id: string, label: string): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) return auth.error;
    const slug = id.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) {
      return { ok: false, message: "รหัส Role ต้องเป็นตัวอักษรเล็ก/ตัวเลข/_/- เริ่มด้วยตัวอักษร (2-32 ตัว)" };
    }
    if (!label.trim()) return { ok: false, message: "กรุณาระบุชื่อ Role" };

    const supabase = createClient();
    const { error } = await supabase.from("roles").insert({ id: slug, label: label.trim(), is_system: false });
    if (error) return { ok: false, message: error.message };
    await logAudit({ action: "INSERT", table_name: "roles", record_id: slug, new_value: { label } });
    revalidatePath("/admin/roles");
    return { ok: true, message: "สร้าง Role สำเร็จ" };
  });
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) return auth.error;

    const supabase = createClient();
    // The DB also blocks this (trg_prevent_system_role_delete + the profiles.role
    // FK), but check here first for a clearer error message than a raw SQL error.
    const { data: role } = await supabase.from("roles").select("is_system").eq("id", roleId).maybeSingle();
    if (role?.is_system) return { ok: false, message: "ไม่สามารถลบ Role ระบบได้" };
    const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", roleId);
    if (count && count > 0) return { ok: false, message: `ยังมีผู้ใช้ ${count} คนใช้ Role นี้อยู่ — ย้าย role ผู้ใช้ก่อนลบ` };

    const { error } = await supabase.from("roles").delete().eq("id", roleId);
    if (error) return { ok: false, message: error.message };
    await logAudit({ action: "DELETE", table_name: "roles", record_id: roleId });
    revalidatePath("/admin/roles");
    return { ok: true, message: "ลบ Role สำเร็จ" };
  });
}

// The role's sidebar layout (0034): which main-menu links sit on top, in order. View only —
// it grants nothing (links still follow permissions). Empty/null = the original sidebar.
export async function setRoleMenu(roleId: string, hrefs: string[] | null): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) return auth.error;
    const list = hrefs ?? [];
    if (list.some((h) => !MENU_HREFS.includes(h)) || new Set(list).size !== list.length) {
      return { ok: false, message: "รายการเมนูไม่ถูกต้อง" };
    }
    const supabase = createClient();
    const { error } = await supabase.from("roles").update({ menu_main: list.length ? list : null }).eq("id", roleId);
    if (error) return { ok: false, message: error.message };
    await logAudit({ action: "UPDATE", table_name: "roles", record_id: roleId, new_value: { menu_main: list } });
    revalidatePath("/", "layout");
    return { ok: true, message: "บันทึกเมนูสำเร็จ" };
  });
}

// Always writes the FULL permission set for a role (never a partial diff) —
// matches the same "full override" convention used by saveAssetAlarmOverride:
// the checkbox grid shown in the editor becomes exactly this role's grants.
export async function setRolePermissions(roleId: string, permissionKeys: string[]): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) return auth.error;

    const supabase = createClient();

    // Guard against locking every account out of role/user administration:
    // is_system protects roles from deletion (see deleteRole above and the
    // trg_prevent_system_role_delete DB trigger), but nothing else stops an
    // edit here from stripping users:manage off the last role that holds it.
    // Counts people, not roles: an empty role holding users:manage would otherwise pass.
    if (!permissionKeys.includes("users:manage") && (await managersLeft({ withoutRole: roleId })) === 0) {
      return {
        ok: false,
        message: "ไม่สามารถถอดสิทธิ์ 'จัดการผู้ใช้ (users:manage)' ออกได้ — ต้องมีผู้ใช้อย่างน้อย 1 คนที่มีสิทธิ์นี้เสมอ มิฉะนั้นจะไม่มีใครเข้าหน้าจัดการ Role/ผู้ใช้ได้อีก",
      };
    }

    // Add first, then remove what was unticked — no transaction here, so a failed
    // write must leave the role with its old permissions, never with none.
    if (permissionKeys.length > 0) {
      const rows = permissionKeys.map((permission_key) => ({ role_id: roleId, permission_key }));
      const { error } = await supabase.from("role_permissions").upsert(rows, { onConflict: "role_id,permission_key", ignoreDuplicates: true });
      if (error) return { ok: false, message: error.message };
    }
    const { data: current, error: curErr } = await supabase.from("role_permissions").select("permission_key").eq("role_id", roleId);
    if (curErr) return { ok: false, message: curErr.message };
    const removed = (current ?? []).map((r) => r.permission_key as string).filter((k) => !permissionKeys.includes(k));
    if (removed.length > 0) {
      const { error: delErr } = await supabase.from("role_permissions").delete().eq("role_id", roleId).in("permission_key", removed);
      if (delErr) return { ok: false, message: delErr.message };
    }
    await logAudit({
      action: "UPDATE",
      table_name: "role_permissions",
      record_id: roleId,
      new_value: { permissionKeys },
    });
    revalidatePath("/admin/roles");
    return { ok: true, message: "บันทึกสิทธิ์สำเร็จ" };
  });
}
