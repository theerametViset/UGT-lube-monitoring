import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getDemoRoles } from "@/lib/demo-data";
import type { Profile } from "@/lib/types";

// "View as" — the role picked in the sidebar's user card to preview the app as.
// Demo Mode: anyone (the demo user is admin). Real mode: honoured only for a user
// holding users:manage, and it only changes what is SHOWN — server actions still
// check the user's own permissions (requirePermission → has_permission()).
export const VIEW_AS_COOKIE = "view-as";

export function viewAsCookie(): string {
  return cookies().get(VIEW_AS_COOKIE)?.value ?? "";
}

// Demo Mode only: the previewed role; unknown → admin.
export function demoRole(): string {
  const r = viewAsCookie();
  return r && getDemoRoles().some((x) => x.id === r) ? r : "admin";
}

// Returns the current user's profile, or null if not signed in.
// In Demo Mode, returns a synthetic admin profile shown as the previewed role (no real session).
export async function getCurrentProfile(): Promise<Profile | null> {
  if (isDemoMode()) {
    const role = demoRole();
    return {
      id: `demo-${role}`,
      full_name: getDemoRoles().find((r) => r.id === role)?.label ?? role,
      role,
      real_role: "admin",
      site_access: [],
    };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id,full_name,role,site_access")
    .eq("id", user.id)
    .maybeSingle();

  const profile = (data as Profile | null) ?? {
    id: user.id,
    full_name: user.email ?? null,
    role: "viewer",
    site_access: [],
  };

  // View as: only for users:manage, only an existing role. A forged cookie from anyone else is ignored.
  const as = viewAsCookie();
  if (as && as !== profile.role) {
    const { data: canManage } = await supabase.rpc("has_permission", { perm: "users:manage" });
    if (canManage) {
      const { data: role } = await supabase.from("roles").select("id").eq("id", as).maybeSingle();
      if (role) return { ...profile, role: as, real_role: profile.role };
    }
  }
  return profile;
}
