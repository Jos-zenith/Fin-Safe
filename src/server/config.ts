// Server configuration and the clock. Everything here reads the environment at CALL time, so tests can change it.
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { POLL_MS_DEFAULT } from "@/config/workflow";

export const SESSION_COOKIE = "fs_session";
/** A demo session lasts this long. The 24-hour retention purge also removes inactive demo data. */
export const SESSION_HOURS = 24;

export const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Hosts where a local SQLite file is the wrong store: serverless platforms (each invocation may be a fresh, read-only or
 * short-lived filesystem) and anything running more than one instance (each would have its OWN database). Returns the
 * reasons found in the environment. It cannot prove a deployment is safe; it only notices the common signs.
 */
export function hostWarnings(env: Record<string, string | undefined> = process.env): string[] {
  const out: string[] = [];
  const set = (k: string) => !!env[k]?.trim();
  if (set("VERCEL") || set("AWS_LAMBDA_FUNCTION_NAME") || set("AWS_EXECUTION_ENV") || set("NETLIFY") || set("K_SERVICE") || set("FUNCTIONS_WORKER_RUNTIME") || set("WEBSITE_INSTANCE_ID")) {
    out.push("this looks like a serverless or managed platform; the SQLite file may be lost between requests or be read-only");
  }
  const workers = Number(env.WEB_CONCURRENCY);
  if ((Number.isFinite(workers) && workers > 1) || set("NODE_APP_INSTANCE") || set("pm_id") || set("INSTANCE_ID")) {
    out.push("this looks like more than one instance; each would hold its own separate database");
  }
  return out;
}

export function dataDir(): string {
  return process.env.DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}

/** Notification polling interval, served to the client so tests can shorten it without a rebuild. */
export function pollMs(): number {
  const v = Number(process.env.POLL_MS);
  return Number.isFinite(v) && v >= 200 ? v : POLL_MS_DEFAULT;
}

/** Test seam: tests install their own clock, then restore it. */
export const clock = { now: () => Date.now() };
export const nowIso = () => new Date(clock.now()).toISOString();

let warnedDevSecret = false;

/**
 * The key that signs session cookies. Production REFUSES to run without SESSION_SECRET. In development a random
 * secret is generated once and kept in the data directory, with a loud warning, so cookies still cannot be forged
 * by someone who only has the source code.
 */
export function sessionSecret(): string {
  const env = process.env.SESSION_SECRET?.trim();
  if (env) {
    if (env.length < 16) throw new Error("SESSION_SECRET must be at least 16 characters");
    return env;
  }
  if (isProduction()) throw new Error("SESSION_SECRET is required in production. Refusing to start without it.");
  const dir = dataDir();
  const file = path.join(dir, "dev-session-secret");
  if (!warnedDevSecret) {
    warnedDevSecret = true;
    console.warn(
      "\n[auth] SESSION_SECRET is not set. Using a generated DEVELOPMENT secret stored in .data/.\n" +
        "[auth] Demo authentication. NOT secure authentication. Set SESSION_SECRET before deploying anywhere.\n",
    );
  }
  try {
    if (existsSync(file)) return readFileSync(file, "utf8").trim();
    mkdirSync(dir, { recursive: true });
    const secret = randomBytes(32).toString("hex");
    writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  } catch {
    // read-only file system: fall back to a per-process secret (sessions then end on restart)
    return (devFallback ??= randomBytes(32).toString("hex"));
  }
}
let devFallback: string | undefined;

/** Called once when the server starts. Throws, which stops the server, if production is misconfigured. */
export function assertStartupConfig(): void {
  if (isProduction() && !process.env.SESSION_SECRET?.trim()) {
    throw new Error("SESSION_SECRET is required in production. Refusing to start without it.");
  }
  sessionSecret();
}
