import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows requests up to the limit, then blocks", () => {
    const limiter = createRateLimiter(3, 60_000);
    expect(limiter("a")).toBe(false);
    expect(limiter("a")).toBe(false);
    expect(limiter("a")).toBe(false);
    expect(limiter("a")).toBe(true); // 4th call blocked
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter(2, 60_000);
    expect(limiter("a")).toBe(false);
    expect(limiter("b")).toBe(false);
    expect(limiter("a")).toBe(false); // a used 2/2
    expect(limiter("a")).toBe(true); // a blocked
    expect(limiter("b")).toBe(false); // b still has 1 left
  });

  it("resets after the window elapses", () => {
    const limiter = createRateLimiter(1, 50);
    expect(limiter("a")).toBe(false);
    expect(limiter("a")).toBe(true);
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(limiter("a")).toBe(false); // window reset
        resolve();
      }, 70),
    );
  });

  it("prunes stale entries when the map grows large", () => {
    const limiter = createRateLimiter(1, 10);
    for (let i = 0; i < 5100; i++) limiter(`k${i}`);
    // Old entries are expired; a fresh key must still be allowed.
    expect(limiter("fresh")).toBe(false);
  });
});
