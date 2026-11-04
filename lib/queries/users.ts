import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/env";
import { requirePermission } from "@/lib/actions/guards";
import type { Profile } from "@/lib/types";

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  site_access: string[];
  created_at: string;
}

const PAGE_SIZE = 20;

const DEMO_USERS: UserRow[] = [
  { id: "demo-1", email: "admin@ugt.co.th", full_name: "Plant Admin", role: "admin", site_access: [], created_at: "2026-01-15" },
  { id: "demo-2", email: "engineer@ugt.co.th", full_name: "Senior Engineer", role: "engineer", site_access: [], created_at: "2026-02-01" },
  { id: "demo-3", email: "manager@ugt.co.th", full_name: "Maintenance Manager", role: "manager", site_access: ["UT"], created_at: "2026-01-20" },
  { id: "demo-4", email: "viewer@ugt.co.th", full_name: "Plant Viewer", role: "viewer", site_access: ["PCD"], created_at: "2026-03-10" },
];

export async function listUsers(opts: { q?: string; page?: number; pageSize?: number } = {}): Promise<{
  rows: UserRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}> {
  const q = (opts.q ?? "").trim().toLowerCase();
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? PAGE_SIZE;

  let all: UserRow[];
  if (isDemoMode()) {
    all = DEMO_USERS;
  } else {
    // Defense in depth: this reads through the service-role client (bypasses
    // RLS) via auth.admin.listUsers() below — every current call site already
    // gates on admin role before calling this, but re-check here too so a
    // future call site can't accidentally leak the full user list.
    const auth = await requirePermission("users:manage");
    if (!auth.ok) throw new Error(auth.error.message);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,full_name,role,site_access,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const profiles = (data ?? []) as Profile[];

    // Fetch all emails in ONE service-role call (auth.admin.* requires the
    // service-role key — the anon-key user client cannot read them). RLS on
    // profiles still limits which rows are visible to non-admins.
    const admin = createAdminClient();
    const { data: authUsers } = await admin.auth.admin.listUsers();
    const emailByUid = new Map(
      (authUsers?.users ?? []).map((u) => [u.id, u.email]),
    );

    all = profiles.map((p) => ({
      id: p.id,
      email: emailByUid.get(p.id) ?? "—",
      full_name: p.full_name,
      role: p.role,
      site_access: p.site_access,
      created_at: p.created_at ?? "",
    }));
  }

  if (q) all = all.filter((u) => `${u.email} ${u.full_name ?? ""}`.toLowerCase().includes(q));

  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * pageSize;
  return { rows: all.slice(start, start + pageSize), total, page: p, pages, pageSize };
}
