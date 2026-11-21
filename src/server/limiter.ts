// One limiter for every route that can reach a paid model, so splitting calls across routes cannot dodge it.
import { createLimiter, type RateLimiter } from "@/lib/ratelimit";

const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);

const g = globalThis as unknown as { __finSafeAiLimiter?: RateLimiter };
export const aiLimiter: RateLimiter = (g.__finSafeAiLimiter ??= createLimiter({ perKey: num(process.env.AI_RATE_PER_MIN), global: num(process.env.AI_RATE_GLOBAL_PER_MIN) }));
