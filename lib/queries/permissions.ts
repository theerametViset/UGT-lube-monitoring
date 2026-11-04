import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getDemoPermissions, getDemoRolePermissions, getDemoRoles } from "@/lib/demo-data";
import type { Permission, Role } from "@/lib/types";

// The single call site for the has_permission() RPC — hasPermission() and
// requirePermission() (lib/actions/guards.ts) both delegate here so which
// Postgres function backs a permission check is never duplicated between them.
// Takes an existing client (rather than creating its own) so requirePermission
// can reuse the client it already made for auth.getUser(), instead of paying
// for a second one.
export async function checkHasPermission(
  supabase: ReturnType<typeof createClient>,
  perm: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("has_permission", { perm });
  return !!data;
}

// Server-Component-side permission check — calls the SAME has_permission()
// Postgres function used by RLS and by requirePermission() (lib/actions/guards.ts),
// so a page's UI-gating decision (e.g. show/hide a "+ create" button) can never
// drift out of sync with what the server action actually allows.
//
// Demo Mode's synthetic profile is always role="admin" (lib/auth.ts), which
// holds every permission by design — so this short-circuits to true rather
// than querying a role_permissions table that doesn't exist in demo data.
export async function hasPermission(perm: string): Promise<boolean> {
  if (isDemoMode()) return true;
  const supabase = createClient();
  return checkHasPermission(supabase, perm);
}

export async function listRoles(): Promise<Role[]> {
  if (isDemoMode()) return getDemoRoles();
  const supabase = createClient();
  const { data, error } = await supabase.from("roles").select("id,label,is_system").order("label");
  if (error) throw new Error(error.message);
  return (data ?? []) as Role[];
}

// Permission keys granted to a given role (for pre-checking checkboxes in the
// role editor). Demo mode returns the same seed mapping the real migration uses.
export async function getRolePermissionKeys(roleId: string): Promise<string[]> {
  if (isDemoMode()) return getDemoRolePermissions(roleId);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", roleId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.permission_key as string);
}

// All roles + their granted permission keys in one shot (used by the
// /admin/roles page to render a role x permission matrix without N+1 queries).
export async function listRolesWithPermissions(): Promise<{ roles: Role[]; permissions: Permission[]; grants: Record<string, string[]> }> {
  if (isDemoMode()) {
    const roles = getDemoRoles();
    const grants: Record<string, string[]> = {};
    for (const r of roles) grants[r.id] = getDemoRolePermissions(r.id);
    return { roles, permissions: getDemoPermissions(), grants };
  }
  const supabase = createClient();
  const [rolesRes, permsRes, rpRes] = await Promise.all([
    supabase.from("roles").select("id,label,is_system").order("label"),
    supabase.from("permissions").select("key,label,category").order("category"),
    supabase.from("role_permissions").select("role_id,permission_key"),
  ]);
  if (rolesRes.error) throw new Error(rolesRes.error.message);
  if (permsRes.error) throw new Error(permsRes.error.message);
  if (rpRes.error) throw new Error(rpRes.error.message);

  const grants: Record<string, string[]> = {};
  for (const row of rpRes.data ?? []) {
    (grants[row.role_id] ??= []).push(row.permission_key);
  }
  return {
    roles: (rolesRes.data ?? []) as Role[],
    permissions: (permsRes.data ?? []) as Permission[],
    grants,
  };
}
