// Small in-memory limiter for the demo AI route. Over the limit => served from fixtures, never an error.
// It only matters when a real (paid) model is configured: mock answers cost nothing and are never limited.
// A real deployment needs a shared store (edge KV / Redis) and a platform-verified client IP.

export interface LimiterOptions {
  windowMs?: number;
  /** Per client. Only applied when the client key can be trusted. */
  perKey?: number;
  /** Hard cap across ALL clients. Spoofing the client key cannot exceed this. */
  global?: number;
  maxKeys?: number;
}

/**
 * What every caller depends on. The in-memory implementation below is for one process; a real deployment swaps in
 * a shared store (Redis, edge KV) behind the same two methods, and feeds it a platform-verified address.
 */
export interface RateLimiter {
  /** True when this request is over a limit. `key` null means the client could not be trusted: global cap only. */
  limited(key: string | null, now?: number): boolean;
}

/** The in-memory limiter also reports how many client keys it is tracking (used by tests). */
export interface MemoryRateLimiter extends RateLimiter {
  size(): number;
}

export function createLimiter({ windowMs = 60_000, perKey = 30, global = 300, maxKeys = 500 }: LimiterOptions = {}): MemoryRateLimiter {
  const keys = new Map<string, { n: number; reset: number }>();
  let all = { n: 0, reset: 0 };
  return {
    /** Returns true when this request is over a limit. `key` null = untrusted client: global cap only. */
    limited(key: string | null, now = Date.now()): boolean {
      if (all.reset <= now) all = { n: 0, reset: now + windowMs };
      all.n += 1;
      if (all.n > global) return true;
      if (key === null) return false;

      if (keys.size >= maxKeys) for (const [k, v] of keys) if (v.reset <= now) keys.delete(k);
      // A flood of distinct keys must not grow memory or buy extra budget: share one overflow bucket.
      const k = keys.size >= maxKeys && !keys.has(key) ? "__overflow" : key;
      const h = keys.get(k);
      if (!h || h.reset <= now) {
        keys.set(k, { n: 1, reset: now + windowMs });
        return false;
      }
      h.n += 1;
      return h.n > perKey;
    },
    size: () => keys.size,
  };
}

/**
 * x-forwarded-for is client-controlled unless a trusted proxy overwrites it, so it is ignored unless
 * TRUST_PROXY=1. Untrusted => null: no per-client bucket (a whole room would otherwise share one
 * budget), only the global cap protects the bill.
 */
export function clientKey(headers: Headers, trustProxy: boolean): string | null {
  if (!trustProxy) return null;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) || null;
}
