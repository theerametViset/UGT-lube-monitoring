import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode, isLocalStore } from "@/lib/env";
import { getLocalAudit } from "@/lib/local-store";
import { belongsTo, toHistoryEntry, type AuditRow, type HistoryEntry } from "@/lib/asset-history";
import { requirePermission } from "@/lib/actions/guards";

export interface AuditEntry {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  user_email: string | null;
  created_at: string;
  summary: string;
}

interface DemoAudit {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  user_email: string;
  created_at: string;
  summary: string;
}

const DEMO_AUDIT: DemoAudit[] = [
  { id: "1", action: "UPDATE", table_name: "alarm_params", record_id: "ap-fe", user_email: "admin@ugt.co.th", created_at: "2026-07-15T10:30:00Z", summary: "Fe warn_limit 100→120, crit_penalty 30→40" },
  { id: "2", action: "INSERT", table_name: "oil_readings", record_id: "RE-1001/2026-06", user_email: "engineer@ugt.co.th", created_at: "2026-07-14T14:20:00Z", summary: "New oil reading: Fe=45, Visc=62.8" },
  { id: "3", action: "DELETE", table_name: "maintenance_records", record_id: "m-xxx-1", user_email: "admin@ugt.co.th", created_at: "2026-07-13T09:15:00Z", summary: "Deleted maintenance record" },
  { id: "4", action: "INSERT", table_name: "assets", record_id: "03-U01-A", user_email: "engineer@ugt.co.th", created_at: "2026-07-12T16:00:00Z", summary: "Created asset via batch import" },
  { id: "6", action: "UPDATE", table_name: "role_permissions", record_id: "engineer", user_email: "admin@ugt.co.th", created_at: "2026-07-10T09:00:00Z", summary: "Updated permission set for role 'engineer'" },
  { id: "7", action: "UPDATE", table_name: "profiles", record_id: "user-123", user_email: "admin@ugt.co.th", created_at: "2026-07-09T13:20:00Z", summary: "Changed role: viewer → manager" },
  { id: "8", action: "INSERT", table_name: "roles", record_id: "technician", user_email: "admin@ugt.co.th", created_at: "2026-07-08T11:10:00Z", summary: "Created custom role 'technician'" },
];

// Table names touched by RBAC-related writes (role/permission/user-role
// management) — used by the Audit Trail page's "สิทธิ์/Role เท่านั้น" filter.
export const RBAC_AUDIT_TABLES = ["roles", "permissions", "role_permissions", "profiles"];

export async function listAuditLog(limit = 50, tables?: string[]): Promise<AuditEntry[]> {
  if (isDemoMode()) {
    return tables ? DEMO_AUDIT.filter((d) => tables.includes(d.table_name)) : DEMO_AUDIT;
  }
  // Defense in depth: this reads through the service-role client below to
  // resolve emails — the current call site already gates by role, but
  // re-check here so a future call site can't accidentally expose it.
  const auth = await requirePermission("audit:read");
  if (!auth.ok) throw new Error(auth.error.message);

  const supabase = createClient();
  let query = supabase
    .from("audit_log")
    .select("id,action,table_name,record_id,old_value,new_value,created_at,user_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (tables && tables.length > 0) query = query.in("table_name", tables);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Map user ids → emails with ONE service-role call; fall back to raw id if
  // the service-role key is missing (audit list must never crash on that).
  let emailByUid = new Map<string, string | undefined>();
  try {
    const admin = createAdminClient();
    const { data: authUsers } = await admin.auth.admin.listUsers();
    emailByUid = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email]));
  } catch {
    // no SUPABASE_SERVICE_ROLE_KEY — show the raw user id
  }

  return (data ?? []).map((d) => ({
    id: d.id,
    action: d.action,
    table_name: d.table_name,
    record_id: d.record_id,
    user_email: d.user_id ? (emailByUid.get(d.user_id) ?? d.user_id) : "system",
    created_at: d.created_at,
    summary: d.new_value ? JSON.stringify(d.new_value).slice(0, 80) : (d.old_value ? `deleted: ${JSON.stringify(d.old_value).slice(0, 60)}` : "—"),
  }));
}

// One machine's change history, newest first (the machine page's "ประวัติ" tab).
// Supabase: audit_log RLS only returns rows to roles with audit:read.
export async function getAssetHistory(assetId: string, limit = 50): Promise<HistoryEntry[]> {
  let rows: AuditRow[];
  if (isLocalStore()) {
    rows = getLocalAudit()
      .filter((r) => belongsTo(r.record_id, assetId))
      .map((r) => ({ ...r, who: "เครื่องนี้ (Local Store)" }));
  } else if (isDemoMode()) {
    rows = DEMO_AUDIT.filter((d) => belongsTo(d.record_id, assetId)).map((d) => ({
      ...d, old_value: null, new_value: { note: d.summary }, who: d.user_email,
    }));
  } else {
    const supabase = createClient();
    const cols = "id,action,table_name,record_id,old_value,new_value,created_at,user_id";
    // Two queries, not an .or() string: asset ids can contain "(", "," or "*".
    const [own, readings] = await Promise.all([
      supabase.from("audit_log").select(cols).eq("record_id", assetId).order("created_at", { ascending: false }).limit(limit),
      supabase.from("audit_log").select(cols).like("record_id", `${assetId}/%`).order("created_at", { ascending: false }).limit(limit),
    ]);
    const data = [...(own.data ?? []), ...(readings.data ?? [])];
    let emailByUid = new Map<string, string | undefined>();
    try {
      const { data: authUsers } = await createAdminClient().auth.admin.listUsers();
      emailByUid = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email]));
    } catch {
      // no service-role key — show the raw user id
    }
    rows = data.map((d) => ({ ...d, who: d.user_id ? (emailByUid.get(d.user_id) ?? d.user_id) : "system" }));
  }
  return rows
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map(toHistoryEntry);
}
