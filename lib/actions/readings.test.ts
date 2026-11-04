import { describe, it, expect, vi } from "vitest";

const { upsertMock, insertMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(async () => ({ error: null })),
  insertMock: vi.fn(async () => ({ error: null })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/env", () => ({ isDemoMode: () => false, isLocalStore: () => false }));
vi.mock("./guards", () => ({ requirePermission: async () => ({ ok: true }) }));
vi.mock("@/lib/local-store", () => ({}));
vi.mock("@/lib/demo-data", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({}));
vi.mock("@/lib/queries/readings", () => ({}));
vi.mock("./audit-log", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => {
  const read = { in: () => read, then: (ok: (v: unknown) => void) => ok({ data: [{ asset_id: "A", period: "2026-09", fe: 99 }] }) };
  return {
    createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: (table: string) => (table === "audit_log" ? { insert: insertMock } : { select: () => read, upsert: upsertMock }),
    }),
  };
});

import { saveOilBatch } from "./readings";

describe("saveOilBatch", () => {
  it("saves a file in one upsert per column set, never sends unsent columns, and reports bad rows", async () => {
    const res = await saveOilBatch([
      { assetId: "A", period: "2026-09", values: { fe: 120, visc: 216 } },
      { assetId: "B", period: "2026-09", values: { visc: 46 } },
      { assetId: "C", period: "2026-09", values: { visc: 50, fe: 5 } },
      { assetId: "D", period: "2099-01", values: { fe: 1 } },
    ]);
    expect(res.saved).toBe(3);
    expect(res.failedKeys).toEqual(["D|2099-01"]);
    // A and C share columns; B has only visc, so its upsert can't write fe = null
    expect(upsertMock).toHaveBeenCalledTimes(2);
    const groups = (upsertMock.mock.calls as unknown as [Record<string, unknown>[]][]).map(([rows]) => rows.map((r) => Object.keys(r).sort().join(",")));
    expect(groups).toEqual([["asset_id,fe,period,visc", "asset_id,fe,period,visc"], ["asset_id,period,visc"]]);
    // one audit insert for the whole file, with the old value of the overwritten column
    expect(insertMock).toHaveBeenCalledTimes(1);
    const audit = (insertMock.mock.calls as unknown as [{ record_id: string; old_value: unknown }[]][])[0][0];
    expect(audit.map((a) => a.record_id)).toEqual(["A/2026-09", "C/2026-09", "B/2026-09"]);
    expect(audit[0].old_value).toEqual({ fe: 99, visc: null });
  });
});
