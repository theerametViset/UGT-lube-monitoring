// One machine's change history (the "ประวัติ" tab), built from audit_log rows.
// An audit row belongs to a machine when its record_id is the machine id
// (assets, asset_alarm_overrides), "<id>/<period>" (oil / vib readings) or
// "<id>/maint/<record id>" (maintenance records).

export interface AuditRow {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  who: string;
}

export interface HistoryEntry {
  id: string;
  at: string;
  who: string;
  what: string; // "แก้ไขข้อมูลเครื่อง" | "เพิ่มผลน้ำมัน งวด 2026-10" | "ลบงานซ่อมบำรุง" …
  changes: { field: string; from: string; to: string }[];
}

export function belongsTo(recordId: string | null, assetId: string): boolean {
  return recordId === assetId || !!recordId?.startsWith(assetId + "/");
}

const TABLE_LABEL: Record<string, string> = {
  assets: "ข้อมูลเครื่อง",
  oil_readings: "ผลน้ำมัน",
  vib_readings: "ผลสั่นสะเทือน",
  asset_alarm_overrides: "เกณฑ์เฉพาะเครื่อง",
  maintenance_records: "งานซ่อมบำรุง",
};

const FIELD_LABEL: Record<string, string> = {
  name: "ชื่อ", type: "ประเภท", site: "โรงงาน", vg_grade: "VG", motor_kw: "kW", rpm: "RPM",
  oil_brand: "น้ำมัน", oil_qty_l: "ปริมาณ (L)", oil_change_months: "รอบเปลี่ยนถ่าย (ด.)", oil_sample_months: "รอบเก็บตัวอย่าง (ด.)",
  fe: "Fe", water: "Water", visc: "Viscosity", tan: "TAN", iso_code: "ISO", particle_4: "4μm", particle_6: "6μm", particle_14: "14μm",
  vel: "Velocity", acc: "Acceleration", cf: "Crest factor", temp: "Temp",
  work_date: "วันที่", wo_no: "เลขที่ใบงาน", description: "รายละเอียด", parts: "อะไหล่", cost: "ค่าใช้จ่าย", technician: "ผู้ปฏิบัติงาน",
};

const hasValue = (o: Record<string, unknown> | null) => !!o && Object.values(o).some((v) => v != null && v !== "");

// Readings are saved as upserts, so "added" = nothing was there before.
function verb(r: AuditRow): string {
  if (r.action === "DELETE") return "ลบ";
  return hasValue(r.old_value) ? "แก้ไข" : "เพิ่ม";
}

// A maintenance type (pm / cm) is written in capitals everywhere else in the app.
const fmt = (table: string, k: string, v: unknown) =>
  table === "maintenance_records" && k === "type" && typeof v === "string" ? v.toUpperCase() : v;
const show = (v: unknown) => (v == null || v === "" ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function toHistoryEntry(r: AuditRow): HistoryEntry {
  const period = r.record_id?.split("/")[1];
  const what = verb(r) + (TABLE_LABEL[r.table_name] ?? r.table_name) + (period && /^\d{4}-\d{2}$/.test(period) ? ` งวด ${period}` : "");
  const keys = [...new Set([...Object.keys(r.old_value ?? {}), ...Object.keys(r.new_value ?? {})])];
  const changes = keys
    .map((k) => ({ field: FIELD_LABEL[k] ?? k, from: show(fmt(r.table_name, k, r.old_value?.[k])), to: show(fmt(r.table_name, k, r.new_value?.[k])) }))
    .filter((c) => c.from !== c.to);
  return { id: r.id, at: r.created_at, who: r.who, what, changes };
}
