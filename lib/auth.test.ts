import { describe, it, expect, vi, beforeEach } from "vitest";

// Real mode (not Demo): the "view as" cookie must only ever narrow what an admin sees.
const state = vi.hoisted(() => ({
  cookie: "",
  ownRole: "viewer",
  ownGrants: [] as string[],
  roles: { admin: ["users:manage", "assets:read", "assets:write"], viewer: ["assets:read"] } as Record<string, string[]>,
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => (state.cookie ? { value: state.cookie } : undefined) }),
}));
vi.mock("@/lib/env", () => ({ isDemoMode: () => false, isLocalStore: () => false }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => {
    let table = "";
    let id = "";
    const result = () =>
      table === "profiles"
        ? { data: { id: "u1", full_name: "U", role: state.ownRole, site_access: [] } }
        : table === "roles"
          ? { data: state.roles[id] ? { id } : null }
          : { data: (state.roles[id] ?? []).map((permission_key) => ({ permission_key })), error: null };
    const chain = {
      select: () => chain,
      eq: (_col: string, v: string) => ((id = v), chain),
      maybeSingle: async () => result(),
      then: (ok: (v: unknown) => unknown) => Promise.resolve(result()).then(ok),
    };
    return {
      auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
      from: (t: string) => ((table = t), chain),
      rpc: async (_fn: string, { perm }: { perm: string }) => ({ data: state.ownGrants.includes(perm) }),
    };
  },
}));

import { getCurrentProfile } from "./auth";
import { hasPermission } from "./queries/permissions";

beforeEach(() => {
  state.cookie = "";
});

describe("view as (real mode)", () => {
  it("ignores the cookie for a user without users:manage", async () => {
    state.ownRole = "viewer";
    state.ownGrants = state.roles.viewer;
    state.cookie = "admin";
    const p = await getCurrentProfile();
    expect(p?.role).toBe("viewer");
    expect(p?.real_role).toBeUndefined();
    expect(await hasPermission("users:manage")).toBe(false);
  });

  it("shows an admin the previewed role's screens, never more than their own", async () => {
    state.ownRole = "admin";
    state.ownGrants = state.roles.admin;
    state.cookie = "viewer";
    const p = await getCurrentProfile();
    expect([p?.role, p?.real_role]).toEqual(["viewer", "admin"]);
    expect(await hasPermission("assets:read")).toBe(true);
    expect(await hasPermission("assets:write")).toBe(false);
  });

  it("ignores a role that does not exist", async () => {
    state.ownRole = "admin";
    state.ownGrants = state.roles.admin;
    state.cookie = "ghost";
    expect((await getCurrentProfile())?.role).toBe("admin");
  });
});
