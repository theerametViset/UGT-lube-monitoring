import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getDemoPermissions, getDemoRolePermissions, getDemoRoles } from "@/lib/demo-data";
import { demoRole, getCurrentProfile, viewAsCookie } from "@/lib/auth";
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
// Demo Mode answers from the previewed role's demo grants (lib/auth.ts demoRole),
// so the role picker shows each role's real menus and buttons.
export function demoCan(perm: string): boolean {
  return getDemoRolePermissions(demoRole()).includes(perm);
}

export async function hasPermission(perm: string): Promise<boolean> {
  if (isDemoMode()) return demoCan(perm);
  const supabase = createClient();
  // An admin previewing a role (lib/auth.ts "view as") sees that role's screens: the
  // previewed grants AND the user's own — a preview can only hide, never add.
  if (viewAsCookie()) {
    const profile = await getCurrentProfile();
    if (profile?.real_role && !(await getRolePermissionKeys(profile.role)).includes(perm)) return false;
  }
  return checkHasPermission(supabase, perm);
}

export async function listRoles(): Promise<Role[]> {
  if (isDemoMode()) return getDemoRoles();
  const supabase = createClient();
  const { data, error } = await supabase.from("roles").select("id,label,is_system").order("label");
  if (error) throw new Error(error.message);
  return (data ?? []) as Role[];
}

// The role's sidebar layout (roles.menu_main, 0034). null on any error — e.g. 0034 not run
// yet — so the sidebar falls back to the original menu instead of failing the page.
export async function getRoleMenu(roleId: string): Promise<string[] | null> {
  if (isDemoMode()) return getDemoRoles().find((r) => r.id === roleId)?.menu_main ?? null;
  const supabase = createClient();
  const { data, error } = await supabase.from("roles").select("menu_main").eq("id", roleId).maybeSingle();
  return error ? null : ((data?.menu_main as string[] | null) ?? null);
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

  // Separate, error-tolerant read: before 0034 runs there is no menu_main column.
  const menus = await supabase.from("roles").select("id,menu_main");
  if (!menus.error) {
    const byId = new Map((menus.data ?? []).map((r) => [r.id as string, r.menu_main as string[] | null]));
    for (const r of rolesRes.data as Role[]) r.menu_main = byId.get(r.id) ?? null;
  }

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
