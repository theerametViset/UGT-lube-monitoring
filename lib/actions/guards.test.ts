import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUser, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser },
    rpc,
  }),
}));

import { requirePermission } from "./guards";

beforeEach(() => {
  getUser.mockReset();
  rpc.mockReset();
});

function loggedOut() {
  getUser.mockResolvedValue({ data: { user: null } });
}
function loggedInWithPermission(allowed: boolean) {
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  rpc.mockResolvedValue({ data: allowed, error: null });
}

describe("requirePermission", () => {
  it("rejects when there is no session", async () => {
    loggedOut();
    const res = await requirePermission("assets:write");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("กรุณาเข้าสู่ระบบ");
  });

  it("rejects when has_permission returns false", async () => {
    loggedInWithPermission(false);
    const res = await requirePermission("users:manage");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toContain("ไม่มีสิทธิ์");
  });

  it("allows when has_permission returns true, returning the caller's userId", async () => {
    loggedInWithPermission(true);
    const res = await requirePermission("assets:write");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.userId).toBe("user-1");
  });

  it("treats an RPC error as unauthorized (fail closed)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-2" } } });
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await requirePermission("assets:write");
    expect(res.ok).toBe(false);
  });
});
