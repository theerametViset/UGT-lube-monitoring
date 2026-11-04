import { createClient } from "@/lib/supabase/server";
import { checkHasPermission } from "@/lib/queries/permissions";
import type { ActionResult } from "./result";

// The admin (service-role) client bypasses RLS, so any server action using it
// must FIRST verify the caller's permission through the user-session client.
// Returns the caller's user id on success (used e.g. to prevent self-delete).

export type GuardResult = { ok: true; userId: string } | { ok: false; error: ActionResult };

// Permission check for actions that must not be open to every logged-in user.
// (AUD-019) Always gate server actions that have side effects (e.g. sending
// emails) even when they don't use the service-role client.
//
// `perm` is one of the keys seeded into the `permissions` table by
// supabase/0023_dynamic_rbac.sql (e.g. "assets:write", "reports:view"). This
// calls the SAME `has_permission()` Postgres function that RLS policies call,
// so which roles can do what is defined ONCE (in the `role_permissions` table)
// instead of being duplicated between this file and every RLS policy.
export async function requirePermission(perm: string): Promise<GuardResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: { ok: false, message: "Unauthorized: กรุณาเข้าสู่ระบบ" } };
  }
  const allowed = await checkHasPermission(supabase, perm);
  if (!allowed) {
    return { ok: false, error: { ok: false, message: `ไม่มีสิทธิ์ดำเนินการนี้ (${perm})` } };
  }
  return { ok: true, userId: user.id };
}
