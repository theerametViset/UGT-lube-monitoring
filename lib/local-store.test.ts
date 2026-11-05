import { describe, expect, it } from "vitest";
import { mergeHistory } from "./local-store";
import { buildExportSql, sqlLit } from "./local-store-export";
import type { OilReading } from "./types";

const oil = (period: string, fe: number | null): OilReading => ({
  period, fe, cu: null, si: null, water: null, visc: null, tan: null,
  iso_code: null, particle_4: null, particle_6: null, particle_14: null,
});
const local = (period: string, fe: number | null) => ({ ...oil(period, fe), asset_id: "A-1", updated_at: "2026-10-16T00:00:00Z" });

describe("mergeHistory", () => {
  it("returns the base history untouched when nothing is saved locally", () => {
    const base = [oil("2026-01", 10)];
    expect(mergeHistory(base, [])).toBe(base);
  });

  it("replaces a saved period, adds new ones, sorts oldest first and drops bookkeeping columns", () => {
    const merged = mergeHistory([oil("2026-01", 10), oil("2026-03", 30)], [local("2026-03", 99), local("2026-02", 20)]);
    expect(merged.map((r) => [r.period, r.fe])).toEqual([["2026-01", 10], ["2026-02", 20], ["2026-03", 99]]);
    expect(merged[2]).not.toHaveProperty("asset_id");
    expect(merged[2]).not.toHaveProperty("updated_at");
  });

  it("keeps built-in values the local row has no value for", () => {
    const visc = { ...local("2026-03", null), visc: 216 };
    const [row] = mergeHistory([oil("2026-03", 150)], [visc]);
    expect([row.fe, row.visc]).toEqual([150, 216]);
  });
});

describe("sqlLit", () => {
  it("quotes strings, doubles single quotes and maps empty values to null", () => {
    expect(sqlLit("O'Brien")).toBe("'O''Brien'");
    expect(sqlLit(null)).toBe("null");
    expect(sqlLit("")).toBe("null");
    expect(sqlLit(12.5)).toBe("12.5");
    expect(sqlLit(Number.NaN)).toBe("null");
  });
});

describe("buildExportSql", () => {
  const asset = {
    id: "A-1", name: "PUMP 'A'", type: "Gearbox", site: "UNT", health: 35, status: "Critical" as const,
    install_date: null, motor_kw: null, rpm: null, vg_grade: 220, oil_brand: "MOBIL", oil_qty_l: 5,
    oil_change_months: 12, oil_sample_months: 6, last_update: "2026-08",
  };
  const sql = buildExportSql({
    oil: [local("2026-09", 120)],
    vib: [],
    attachments: [],
    assets: [asset, { ...asset, id: "UNUSED" }],
    sites: [{ code: "UNT", name: "UNT Plant", sort_order: 4 }, { code: "CPL", name: "CPL Plant", sort_order: 1 }],
    types: [{ name: "Gearbox", abbr: "GB", color: "#000" }],
    generatedAt: "2026-10-16T00:00:00Z",
  });

  it("wraps everything in one transaction and rebuilds health server-side", () => {
    expect(sql).toMatch(/^[\s\S]*begin;[\s\S]*select public\.recompute_all_health\(\);[\s\S]*commit;\s*$/);
  });

  it("only carries the assets, sites and types the saved rows need", () => {
    expect(sql).toContain("'A-1', 'PUMP ''A'''");
    expect(sql).not.toContain("UNUSED");
    expect(sql).toContain("('UNT', 'UNT Plant', 4)");
    expect(sql).not.toContain("CPL");
  });

  it("upserts readings on the (asset_id, period) key and never writes health/status", () => {
    expect(sql).toContain("on conflict (asset_id, period) do update set");
    expect(sql).toContain("('A-1', '2026-09', 120,");
    expect(sql).not.toMatch(/insert into public\.assets \([^)]*health/);
  });

  it("keeps server values for columns the local row left empty", () => {
    expect(sql).toContain("fe = coalesce(excluded.fe, oil_readings.fe),");
    expect(sql).toContain("particle_14 = coalesce(excluded.particle_14, oil_readings.particle_14);");
    expect(sql).toContain("set local standard_conforming_strings = on;");
  });
});

describe("deleteLocalReading", () => {
  it("removes one saved period and reports a period that was never saved", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    process.env.LOCAL_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ls-del-"));
    const { upsertLocalOil, getLocalOil, deleteLocalReading } = await import("./local-store");
    upsertLocalOil({ asset_id: "A-1", period: "2026-09", fe: 10 });
    upsertLocalOil({ asset_id: "A-1", period: "2026-10", fe: 20 });
    expect(deleteLocalReading("oil", "A-1", "2026-09")).toBe(true);
    expect(getLocalOil("A-1").map((r) => r.period)).toEqual(["2026-10"]);
    expect(deleteLocalReading("oil", "A-1", "2026-09")).toBe(false);
    expect(deleteLocalReading("vib", "A-1", "2026-10")).toBe(false);
    delete process.env.LOCAL_DATA_DIR;
  });
});
