import { redirect } from "next/navigation";
import { Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { getRolePermissionKeys } from "@/lib/queries/permissions";
import {
  getDemoAssets,
  getDemoNotifications,
} from "@/lib/demo-data";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { NotifItem } from "@/components/layout/NotificationBell";
import type { Asset, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const ASSET_COLS =
  "id,name,type,site,health,status,install_date,motor_kw,rpm,vg_grade,oil_brand,oil_qty_l,oil_change_months,oil_sample_months,last_update";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile: Profile;
  let notifications: NotifItem[];
  let criticalCount = 0;
  let warningCount = 0;
  const demo = isDemoMode();

  if (demo) {
    profile = {
      id: "demo-admin",
      full_name: "Admin",
      role: "admin",
      site_access: [],
    };
    notifications = getDemoNotifications();
    criticalCount = getDemoAssets().filter((a) => a.status === "Critical").length;
    warningCount = getDemoAssets().filter((a) => a.status === "Warning").length;
  } else {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const p = await getCurrentProfile();
    if (!p) redirect("/login");
    profile = p;

    const [crit, warn, critCount, warnCount] = await Promise.all([
      supabase
        .from("assets")
        .select(ASSET_COLS)
        .eq("status", "Critical")
        .order("health")
        .limit(8),
      supabase
        .from("assets")
        .select(ASSET_COLS)
        .eq("status", "Warning")
        .order("health")
        .limit(4),
      supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "Critical"),
      supabase.from("assets").select("id", { count: "exact", head: true }).eq("status", "Warning"),
    ]);
    criticalCount = critCount.count ?? 0;
    warningCount = warnCount.count ?? 0;

    notifications = [
      ...((crit.data as Asset[] | null) ?? []).map((asset) => ({
        asset,
        level: "crit" as const,
      })),
      ...((warn.data as Asset[] | null) ?? []).map((asset) => ({
        asset,
        level: "warn" as const,
      })),
    ];
  }

  const isProduction = process.env.NODE_ENV === "production";
  const showDemoWarning = demo && isProduction;
  // getRolePermissionKeys throws on a Supabase error — this layout wraps every
  // route, so a transient DB hiccup here must degrade to "no extra nav items"
  // rather than take down the whole app (unlike the page-level data queries
  // below it, which are allowed to fail their own page via error.tsx).
  let permittedKeys: string[] = [];
  try {
    permittedKeys = await getRolePermissionKeys(profile.role);
  } catch (err) {
    console.error("[AppLayout] getRolePermissionKeys failed", err);
  }

  return (
    // fixed inset-0, not h-screen: being positioned keeps absolute descendants (sr-only
    // labels) from escaping to <body> and making the whole page scroll into an empty band.
    <div className="fixed inset-0 flex overflow-hidden">
      <Sidebar demo={demo} profile={profile} permittedKeys={permittedKeys} criticalCount={criticalCount} warningCount={warningCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title="ศูนย์เฝ้าระวังความเสี่ยง (Fleet Risk Center)"
          notifications={notifications}
          criticalCount={criticalCount}
          warningCount={warningCount}
        />
        {showDemoWarning && (
          <div className="flex items-center justify-center gap-2 bg-red px-3 py-1.5 text-center text-[14px] font-bold text-white">
            <Ban className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />PRODUCTION WARNING: DEMO_MODE is active — data is sample, writes are blocked. Set DEMO_MODE=false and provide Supabase env.
          </div>
        )}
        <main className="relative flex-1 overflow-y-auto px-[19px] py-[15px]">{children}</main>
      </div>
    </div>
  );
}
