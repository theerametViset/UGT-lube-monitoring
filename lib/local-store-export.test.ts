import { describe, expect, it } from "vitest";
import { buildExportSql } from "./local-store-export";
import type { LocalOilRow } from "./local-store";

const oil: LocalOilRow = {
  asset_id: "34-U02-B", period: "2026-08", fe: 130, cu: 60, si: 20, water: 2500, visc: 218, tan: 1.2,
  iso_code: "18/16/13", particle_4: null, particle_6: null, particle_14: null, updated_at: "2026-10-29T00:00:00Z",
};

describe("buildExportSql", () => {
  const sql = buildExportSql({ oil: [oil], vib: [], attachments: [], assets: [], sites: [], types: [], generatedAt: "2026-10-29" });

  it("never writes Cu/Si, so Cu/Si already in Supabase are kept", () => {
    expect(sql).not.toMatch(/\bcu\b|\bsi\b/);
    expect(sql).not.toContain("60, 20");
  });

  it("still upserts the measured values", () => {
    expect(sql).toContain("insert into public.oil_readings (asset_id, period, fe, water, visc, tan,");
    expect(sql).toContain("'34-U02-B', '2026-08', 130, 2500, 218, 1.2, '18/16/13'");
    expect(sql).toContain("recompute_all_health()");
  });
});
