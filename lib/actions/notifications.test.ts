import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  allowed: true,
  send: vi.fn(async (p: { to: string[] }) => ({ ok: true, message: `ส่งอีเมลไป ${p.to.length} ผู้รับ` })),
  user: 0,
}));

vi.mock("@/lib/env", () => ({ isDemoMode: () => false, isLocalStore: () => false }));
vi.mock("./guards", () => ({
  requirePermission: async () =>
    m.allowed ? { ok: true, userId: `u${m.user}` } : { ok: false, error: { ok: false, message: "ไม่มีสิทธิ์" } },
}));
vi.mock("./audit-log", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/email/send", () => ({ sendEmail: m.send }));
vi.mock("@/lib/email/weekly-digest-build", () => ({ buildWeeklyDigest: async () => ({ subject: "[UGT Lube] สรุปสัปดาห์", html: "<p>x</p>" }) }));
vi.mock("@/lib/queries/notifications", () => ({
  getNotificationConfig: async () => ({ from_email: "a@x.co", email_recipients: ["r1@x.co", "r2@x.co"] }),
}));

import { sendWeeklyDigestNow } from "./notifications";

beforeEach(() => {
  m.allowed = true;
  m.send.mockClear();
  m.user += 1; // fresh rate-limit bucket per test
});

describe("sendWeeklyDigestNow", () => {
  it("refuses without notifications:manage", async () => {
    m.allowed = false;
    expect((await sendWeeklyDigestNow({ test: false })).ok).toBe(false);
    expect(m.send).not.toHaveBeenCalled();
  });

  it("test send: typed addresses only, max 3, subject marked [ทดสอบ]", async () => {
    expect((await sendWeeklyDigestNow({ test: true, to: "a@x.co, b@x.co, c@x.co, d@x.co" })).ok).toBe(false);
    expect((await sendWeeklyDigestNow({ test: true, to: "not-an-email" })).ok).toBe(false);
    const res = await sendWeeklyDigestNow({ test: true, to: "me@x.co" });
    expect(res.ok).toBe(true);
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: ["me@x.co"], subject: "[ทดสอบ] [UGT Lube] สรุปสัปดาห์" }));
  });

  it("send to everyone uses the saved recipients, at most 3 times a day", async () => {
    for (let i = 0; i < 3; i++) expect((await sendWeeklyDigestNow({ test: false, to: "ignored@x.co" })).ok).toBe(true);
    expect(m.send).toHaveBeenLastCalledWith(expect.objectContaining({ to: ["r1@x.co", "r2@x.co"], subject: "[UGT Lube] สรุปสัปดาห์" }));
    expect((await sendWeeklyDigestNow({ test: false })).ok).toBe(false);
    expect(m.send).toHaveBeenCalledTimes(3);
  });
});
