import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import type { Profile } from "@/lib/types";

// Returns the current user's profile, or null if not signed in.
// In Demo Mode, returns a synthetic admin profile (no real session).
export async function getCurrentProfile(): Promise<Profile | null> {
  if (isDemoMode()) {
    return {
      id: "demo-admin",
      full_name: "Admin",
      role: "admin",
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

  return (
    (data as Profile | null) ?? {
      id: user.id,
      full_name: user.email ?? null,
      role: "viewer",
      site_access: [],
    }
  );
}
