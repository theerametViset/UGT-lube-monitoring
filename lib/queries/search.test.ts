import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Asset } from "@/lib/types";

const { isDemoMode, getDemoAssets, orMock, limitMock } = vi.hoisted(() => ({
  isDemoMode: vi.fn(),
  getDemoAssets: vi.fn(),
  orMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ isDemoMode }));
vi.mock("@/lib/demo-data", () => ({ getDemoAssets }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        or: (...args: unknown[]) => {
          orMock(...args);
          return { limit: limitMock };
        },
      }),
    }),
  }),
}));

import { globalSearch, ilikeAny } from "./search";

const asset = (a: Partial<Asset>): Asset => ({
  id: "34-U02-B",
  name: "Pump B",
  type: "Pump",
  site: "TSL",
  health: 90,
  status: "Healthy",
  install_date: null,
  motor_kw: null,
  rpm: null,
  vg_grade: 46,
  oil_brand: null,
  oil_qty_l: 0,
  oil_change_months: 6,
  oil_sample_months: 3,
  last_update: null,
  ...a,
});

beforeEach(() => {
  isDemoMode.mockReset();
  getDemoAssets.mockReset();
  orMock.mockReset();
  limitMock.mockReset();
});

describe("globalSearch — demo mode", () => {
  beforeEach(() => {
    isDemoMode.mockReturnValue(true);
  });

  it("returns [] for an empty/whitespace query without touching demo data", async () => {
    const res = await globalSearch("   ");
    expect(res).toEqual([]);
    expect(getDemoAssets).not.toHaveBeenCalled();
  });

  it("matches assets by id, name, type or site (case-insensitive)", async () => {
    getDemoAssets.mockReturnValue([
      asset({ id: "34-U02-B", name: "Lube Pump B" }),
      asset({ id: "12-P11", name: "Cooling Fan" }),
    ]);
    const res = await globalSearch("LUBE PUMP");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("34-U02-B");
    expect(res[0].type).toBe("asset");
  });

  it("caps asset results at 8", async () => {
    getDemoAssets.mockReturnValue(Array.from({ length: 20 }, (_, i) => asset({ id: `pump-${i}`, name: "pump" })));
    const res = await globalSearch("pump");
    expect(res).toHaveLength(8);
  });

  it("truncates an overlong query to 100 chars before matching (no crash, no accidental match)", async () => {
    getDemoAssets.mockReturnValue([asset({ id: "x", name: "x" })]);
    const res = await globalSearch("a".repeat(500));
    expect(res).toEqual([]);
  });
});

describe("globalSearch — live Supabase mode", () => {
  beforeEach(() => {
    isDemoMode.mockReturnValue(false);
    limitMock.mockResolvedValue({ data: [] });
  });

  it("quotes the value so ( ) , are plain text and escapes LIKE wildcards", async () => {
    await globalSearch("50%_(a,b)");
    expect(orMock).toHaveBeenCalledTimes(1);
    const [assetFilter] = orMock.mock.calls[0];
    // LIKE escape \% then PostgREST quoting doubles the backslash
    expect(assetFilter).toBe('id.ilike."%50\\\\%\\\\_(a,b)%",name.ilike."%50\\\\%\\\\_(a,b)%"');
  });
  it("escapes a double quote inside the quoted value", () => {
    expect(ilikeAny(["id"], 'a"b')).toBe('id.ilike."%a\\"b%"');
  });
});
