import { describe, it, expect, vi } from "vitest";
import { runAction, demoBlocked } from "./result";

describe("demoBlocked", () => {
  it("returns a fixed demo-mode ActionResult", () => {
    expect(demoBlocked()).toEqual({
      ok: false,
      demo: true,
      message: "ยังไม่บันทึกจริง — เชื่อม Supabase เพื่อบันทึก",
    });
  });
});

describe("runAction", () => {
  it("passes through a successful result unchanged", async () => {
    const res = await runAction(async () => ({ ok: true, message: "done" }));
    expect(res).toEqual({ ok: true, message: "done" });
  });

  it("passes through a normal failure result unchanged", async () => {
    const res = await runAction(async () => ({ ok: false, message: "nope" }));
    expect(res).toEqual({ ok: false, message: "nope" });
  });

  it("catches a thrown error and returns the generic Thai fallback instead of throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await runAction(async (): Promise<import("./result").ActionResult> => {
      throw new Error("boom");
    });
    expect(res.ok).toBe(false);
    expect(res.message).toBe("เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่");
    spy.mockRestore();
  });
});
