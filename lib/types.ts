// Domain types mirroring supabase/0001_schema.sql.
// NOTE: Health/Status are DERIVED server-side (compute_health) and cached on `assets`.
export type AssetStatus = "Healthy" | "Warning" | "Critical";
// Roles are DYNAMIC (supabase/0023_dynamic_rbac.sql's `roles` table) — an admin
// can create new roles through the app, so this can no longer be a fixed
// literal union. What a role can actually DO is resolved via has_permission(),
// never by comparing this string against a hardcoded list.
export type UserRole = string;

export interface Profile {
  id: string;
  full_name: string | null;
  /** The role the app renders as — the previewed one while an admin uses "view as". */
  role: UserRole;
  /** Set while previewing: the user's own role (Demo Mode's user is always admin). */
  real_role?: UserRole;
  site_access: string[];
  created_at?: string;
}

export interface Role {
  id: string;
  label: string;
  is_system: boolean;
  /** Sidebar "งานของฉัน" links in order (0034); null/absent = the original sidebar. View only. */
  menu_main?: string[] | null;
}

export interface Permission {
  key: string;
  label: string;
  category: string;
}

export interface NotificationConfig {
  id: number;
  from_email: string;
  email_recipients: string[];
  enable_critical_alerts: boolean;
  enable_weekly_summary: boolean;
}

export interface Site {
  code: string;
  name: string;
  sort_order: number;
}

export interface AssetType {
  name: string;
  abbr: string | null;
  color: string | null;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  site: string;
  health: number;
  status: AssetStatus;
  install_date: string | null;
  motor_kw: number | null;
  rpm: number | null;
  vg_grade: number;
  oil_brand: string | null;
  oil_qty_l: number;
  oil_change_months: number;
  oil_sample_months: number;
  last_update: string | null;
}

export interface OilReading {
  period: string;
  fe: number | null;
  cu: number | null;
  si: number | null;
  water: number | null;
  visc: number | null;
  tan: number | null;
  iso_code: string | null;
  particle_4: number | null;
  particle_6: number | null;
  particle_14: number | null;
}

export interface VibReading {
  period: string;
  vel: number | null;
  acc: number | null;
  cf: number | null;
  temp: number | null;
}

export interface AlarmParam {
  id: string;
  category: "oil" | "vib";
  key: string;
  name: string;
  unit: string | null;
  description: string | null;
  warn_limit: number | null;
  crit_limit: number | null;
  warn_penalty: number | null;
  crit_penalty: number | null;
}

export interface ScoreConfig {
  oil_weight: number;
  vib_weight: number;
  warn_penalty: number;
  crit_penalty: number;
}

/** Per-asset override of a single alarm param — same nullable-field shape as
 * AlarmParam, scoped to one asset. Absent fields fall back to the global param. */
export interface AssetAlarmOverride {
  id: string;
  asset_id: string;
  category: "oil" | "vib";
  key: string;
  warn_limit: number | null;
  crit_limit: number | null;
  warn_penalty: number | null;
  crit_penalty: number | null;
}

/** Per-asset override of the score-weighting/default-penalty config. */
export interface AssetScoreOverride {
  asset_id: string;
  oil_weight: number | null;
  vib_weight: number | null;
  warn_penalty: number | null;
  crit_penalty: number | null;
}

export interface MaintenanceRecord {
  id: string;
  asset_id: string;
  type: "pm" | "cm";
  work_date: string | null;
  wo_no: string | null;
  description: string | null;
  parts: string | null;
  cost: number;
  technician: string | null;
}

export type StandardCategory =
  | "TRIBOLOGY"
  | "VIBRATION"
  | "RELIABILITY"
  | "ASSET"
  | "CUSTOM";

export interface Standard {
  id: string;
  category: StandardCategory;
  title: string;
  subtitle: string | null;
  description: string | null;
  full_text: string | null;
  tags: string[] | null;
  version: number | null;
  updated_at: string | null;
  updated_by: string | null;
  /** Alarm param keys this standard applies to (e.g. ["vel", "acc"]). */
  related_params: string[] | null;
  /** Asset types this standard applies to (e.g. ["Pump", "Gearbox"]). */
  asset_types: string[] | null;
  /** Other standards this one explicitly cross-references (uuid[] of standards.id). */
  related_standard_ids: string[] | null;
}

export interface ReadingAttachment {
  id: string;
  asset_id: string;
  period: string | null;
  kind: "oil" | "vib" | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface StandardAttachment {
  id: string;
  standard_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

