"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/env";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { requirePermission } from "./guards";
import { logAudit } from "./audit-log";
import { listUsers, type UserRow } from "@/lib/queries/users";

// Client-callable snapshot for the "ดาวน์โหลด Excel" button — listUsers()
// itself already requires users:manage, so no separate guard needed here.
export async function getUsersForExport(q: string): Promise<UserRow[]> {
  const { rows } = await listUsers({ q, page: 1, pageSize: 100000 });
  return rows;
}

export async function updateUserRole(
  userId: string,
  role: string,
  siteAccess: string[],
): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) return auth.error;
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ role, site_access: siteAccess })
      .eq("id", userId);
    if (error) return { ok: false, message: error.message };
    await logAudit({
      action: "UPDATE",
      table_name: "profiles",
      record_id: userId,
      new_value: { role, site_access: siteAccess },
    });
    revalidatePath("/admin/users");
    return { ok: true, message: "อัปเดตบทบาทสำเร็จ" };
  });
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
    const auth = await requirePermission("users:manage");
    if (!auth.ok) return auth.error;
    if (userId === auth.userId) {
      return { ok: false, message: "ไม่สามารถลบบัญชีตัวเองได้ (ป้องกันระบบไร้ admin)" };
    }
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { ok: false, message: error.message };
    await admin.from("profiles").delete().eq("id", userId);
    await logAudit({
      action: "DELETE",
      table_name: "profiles",
      record_id: userId,
    });
    revalidatePath("/admin/users");
    return { ok: true, message: "ลบผู้ใช้สำเร็จ" };
  });
}
