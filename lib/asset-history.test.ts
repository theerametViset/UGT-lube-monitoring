import { describe, expect, it } from "vitest";
import { belongsTo, toHistoryEntry, type AuditRow } from "./asset-history";

const row = (over: Partial<AuditRow>): AuditRow => ({
  id: "1", action: "UPDATE", table_name: "assets", record_id: "2030-B01-1", old_value: null, new_value: null, created_at: "2026-10-29T03:00:00Z", who: "admin", ...over,
});

describe("asset history", () => {
  it("matches the machine's own rows and its readings, not other machines", () => {
    expect(belongsTo("2030-B01-1", "2030-B01-1")).toBe(true);
    expect(belongsTo("2030-B01-1/2026-08", "2030-B01-1")).toBe(true);
    expect(belongsTo("2030-B01-10", "2030-B01-1")).toBe(false);
    expect(belongsTo(null, "2030-B01-1")).toBe(false);
    expect(belongsTo("2030-B01-1/maint/9f3c", "2030-B01-1")).toBe(true);
  });

  it("keeps a machine type as written", () => {
    const e = toHistoryEntry(row({ old_value: { type: "Gearbox" }, new_value: { type: "Centrifugal Pump" } }));
    expect(e.changes).toEqual([{ field: "ประเภท", from: "Gearbox", to: "Centrifugal Pump" }]);
  });

  it("calls a first reading 'added'", () => {
    const e = toHistoryEntry(row({ action: "UPSERT", table_name: "oil_readings", record_id: "A/2026-10", new_value: { fe: 250 } }));
    expect(e.what).toBe("เพิ่มผลน้ำมัน งวด 2026-10");
  });

  it("shows what a deleted maintenance record was", () => {
    const e = toHistoryEntry(row({
      action: "DELETE", table_name: "maintenance_records", record_id: "34-U02-B/maint/9f3c",
      old_value: { type: "cm", wo_no: "MNT-23871", description: "เปลี่ยนแบริ่ง", cost: 12000 },
    }));
    expect(e.what).toBe("ลบงานซ่อมบำรุง");
    expect(e.changes).toEqual([
      { field: "ประเภท", from: "CM", to: "–" },
      { field: "เลขที่ใบงาน", from: "MNT-23871", to: "–" },
      { field: "รายละเอียด", from: "เปลี่ยนแบริ่ง", to: "–" },
      { field: "ค่าใช้จ่าย", from: "12000", to: "–" },
    ]);
  });

  it("shows only what changed, before → after", () => {
    const e = toHistoryEntry(row({ old_value: { vg_grade: 2, name: "A" }, new_value: { vg_grade: 220, name: "A" } }));
    expect(e.what).toBe("แก้ไขข้อมูลเครื่อง");
    expect(e.changes).toEqual([{ field: "VG", from: "2", to: "220" }]);
  });

  it("labels a reading with its period and shows new and cleared values", () => {
    const e = toHistoryEntry(row({ table_name: "oil_readings", record_id: "34-U02-B/2026-10", old_value: { fe: null, water: 1200 }, new_value: { fe: 250, water: null } }));
    expect(e.what).toBe("แก้ไขผลน้ำมัน งวด 2026-10");
    expect(e.changes).toEqual([{ field: "Fe", from: "–", to: "250" }, { field: "Water", from: "1200", to: "–" }]);
  });
});
