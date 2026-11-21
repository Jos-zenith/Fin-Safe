import { describe, expect, it } from "vitest";
import { clientKey, createLimiter } from "@/lib/ratelimit";

describe("rate limiter", () => {
  it("limits one client after the per-key budget and resets after the window", () => {
    const l = createLimiter({ perKey: 3, global: 100, windowMs: 1000 });
    expect([1, 2, 3, 4].map(() => l.limited("a", 0))).toEqual([false, false, false, true]);
    expect(l.limited("a", 1001)).toBe(false);
  });

  it("a spoofed rotating client key cannot beat the global cap", () => {
    const l = createLimiter({ perKey: 3, global: 10, windowMs: 1000 });
    let blocked = 0;
    for (let i = 0; i < 50; i++) if (l.limited(`spoof-${i}`, 0)) blocked++;
    expect(blocked).toBe(40);
  });

  it("memory stays bounded under a flood of distinct keys", () => {
    const l = createLimiter({ perKey: 3, global: 1e9, maxKeys: 20, windowMs: 1000 });
    for (let i = 0; i < 5000; i++) l.limited(`k${i}`, 0);
    expect(l.size()).toBeLessThanOrEqual(21);
  });

  it("an untrusted client key means no per-client bucket: a whole room is not throttled together", () => {
    const l = createLimiter({ perKey: 3, global: 1000, windowMs: 1000 });
    for (let i = 0; i < 100; i++) expect(l.limited(null, 0)).toBe(false);
    expect(l.size()).toBe(0);
  });

  it("the global cap still applies without a client key", () => {
    const l = createLimiter({ global: 5, windowMs: 1000 });
    expect([1, 2, 3, 4, 5, 6].map(() => l.limited(null, 0))).toEqual([false, false, false, false, false, true]);
  });

  it("ignores x-forwarded-for unless the proxy is trusted", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 9.9.9.9" });
    expect(clientKey(h, false)).toBeNull();
    expect(clientKey(h, true)).toBe("1.2.3.4");
    expect(clientKey(new Headers(), true)).toBeNull();
  });
});
