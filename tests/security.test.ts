// Hardening: security headers, rate-limiter interface, request limits, consent recorded on the server, log hygiene,
// and no secrets in client code.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRIYA } from "@/data/personas";
import { createLimiter, clientKey, type RateLimiter } from "@/lib/ratelimit";
import { setPlanGeneratorForTests } from "@/server/plan";
import { setStoreForTests } from "@/server/store";
import nextConfig, { CSP, SECURITY_HEADERS } from "../next.config";
import { expectOk, makeApp, submitBody } from "./server-helpers";

const root = path.resolve(__dirname, "..");
afterEach(() => {
  setPlanGeneratorForTests(null);
  setStoreForTests(null);
  vi.restoreAllMocks();
});

describe("security headers (next.config.ts)", () => {
  const h = Object.fromEntries(SECURITY_HEADERS.map((x) => [x.key, x.value]));

  it("are applied to every route", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    expect(rules[0].headers.map((x) => x.key).sort()).toEqual(Object.keys(h).sort());
  });
  it("a strict CSP: same-origin by default, no framing, no plugins, no foreign script hosts", () => {
    expect(CSP).toMatch(/default-src 'self'/);
    expect(CSP).toMatch(/frame-ancestors 'none'/);
    expect(CSP).toMatch(/object-src 'none'/);
    expect(CSP).toMatch(/base-uri 'self'/);
    expect(CSP).toMatch(/connect-src 'self'/);
    const script = /script-src ([^;]+)/.exec(CSP)![1];
    expect(script).not.toMatch(/https?:/);
    expect(script).not.toMatch(/\*/);
    // eval is only for the dev server
    expect(process.env.NODE_ENV === "production" ? script : "").not.toMatch(/unsafe-eval/);
    expect(CSP).not.toMatch(/\*(?!\.)/);
  });
  it("sends no referrer, forbids sniffing and framing, and limits device permissions", () => {
    expect(h["Referrer-Policy"]).toBe("no-referrer");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Permissions-Policy"]).toMatch(/camera=\(\)/);
    expect(h["Permissions-Policy"]).toMatch(/geolocation=\(\)/);
    expect(h["Permissions-Policy"]).toMatch(/microphone=\(self\)/);
  });
  it("hides the framework header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("rate limiting sits behind an interface and trusts only a verified address", () => {
  it("any RateLimiter can be dropped in", () => {
    const always: RateLimiter = { limited: () => true };
    const never: RateLimiter = { limited: () => false };
    expect([always.limited("x"), never.limited(null)]).toEqual([true, false]);
    const mem: RateLimiter = createLimiter({ perKey: 2, global: 100 });
    expect([mem.limited("a", 0), mem.limited("a", 1), mem.limited("a", 2)]).toEqual([false, false, true]);
  });
  it("ignores a client-supplied x-forwarded-for unless a trusted proxy is configured", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4" });
    expect(clientKey(h, false)).toBeNull();
    expect(clientKey(h, true)).toBe("1.2.3.4");
  });
});

describe("request limits", () => {
  it("the AI route rejects oversized text, oversized questions, an unsupported language and unknown fields", async () => {
    const { POST } = await import("@/app/api/ai/route");
    const call = (body: unknown) => POST(new Request("http://localhost/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    expect((await call({ task: "secondOpinion", language: "en", text: "x".repeat(4001) })).status).toBe(400);
    expect((await call({ task: "answerQuestion", language: "en", profile: PRIYA, question: "q".repeat(501) })).status).toBe(400);
    for (const language of ["fr", "EN", "", "en-IN", 5, null]) expect((await call({ task: "secondOpinion", language, text: "hello" })).status, String(language)).toBe(400);
    expect((await call({ task: "secondOpinion", language: "en", text: "x".repeat(4000) })).status).toBe(200); // the limit itself is fine
    expect((await call({ task: "delete_everything", language: "en" })).status).toBe(400);
    const bad = await POST(new Request("http://localhost/api/ai", { method: "POST", body: "not json" }));
    expect(bad.status).toBe(400);
  });

  it("the workflow API rejects an unsupported language, oversized bodies and oversized fields", async () => {
    const app = await makeApp();
    const c = await app.priya();
    expect((await c.post("cases", { language: "fr" })).status).toBe(400);
    expect((await c.post("ask", { question: "x".repeat(301), language: "en" })).status).toBe(400);
    expect((await c.post("ask", { question: "How is my emergency fund?", language: "ta" })).status).toBe(200);
    expect((await c.call("PUT", "me/profile", { ...PRIYA, name: "n".repeat(120_000) })).status).toBe(413);
    expect((await c.put("me/profile", { ...PRIYA, goals: Array.from({ length: 11 }, (_, i) => ({ id: `g${i}`, kind: "home", targetAmount: 1, years: 1 })) })).status).toBe(400);
  });
});

describe("consent is recorded on the server", () => {
  it("stores when the demo notice was accepted, once, and shows it back", async () => {
    const app = await makeApp();
    const c = await app.as("priya");
    expect((await c.get("me")).body.user.consentAt).toBeNull();
    expectOk(await c.post("me/consent"));
    const first = (await c.get("me")).body.user.consentAt as string;
    expect(first).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect((await app.store.getUser("user-priya"))!.consentAt).toBe(first);
    await new Promise((r) => setTimeout(r, 5));
    expectOk(await c.post("me/consent"));
    expect((await c.get("me")).body.user.consentAt).toBe(first); // not overwritten
    // deleting the data clears it again
    expectOk(await c.post("me/delete"));
    expect((await app.store.getUser("user-priya"))!.consentAt).toBeNull();
  });
});

describe("logs hold task, status, latency and reasons only", () => {
  it("an unexpected server error logs the route and 'error', never the request content or the error text", async () => {
    const app = await makeApp();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = await app.priya();
    // the store fails with a message that carries profile content; the response and the log must not repeat it
    vi.spyOn(app.store, "getProfile").mockRejectedValue(new Error("secret zebra content from the profile"));
    const r = await c.post("cases", submitBody());
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: "server_error" });
    const logged = err.mock.calls.flat().join(" ");
    expect(logged).toContain('"status":"error"');
    expect(logged).not.toMatch(/zebra|Priya|Chennai|secret/);
    expect(JSON.stringify(r.body)).not.toMatch(/zebra/);
  });

  it("the AI pipeline log hook receives exactly task, status, latencyMs and reasons", async () => {
    const { runTask } = await import("@/lib/ai/run");
    const entries: Record<string, unknown>[] = [];
    await runTask({ task: "secondOpinion", language: "en", text: "guaranteed 3% monthly, secret word zebra" }, { log: (e) => entries.push(e) });
    expect(Object.keys(entries[0]).sort()).toEqual(["latencyMs", "reasons", "status", "task"]);
    expect(JSON.stringify(entries)).not.toMatch(/zebra/);
  });
});

describe("no secret can reach client code", () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(f)) out.push(p);
    }
    return out;
  };

  it("client components never read process.env, and nothing exposes a key through NEXT_PUBLIC_", () => {
    const files = walk(path.join(root, "src"));
    const clientFiles = files.filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8").trimStart().slice(0, 40)));
    expect(clientFiles.length).toBeGreaterThan(20);
    for (const f of clientFiles) expect(readFileSync(f, "utf8"), path.relative(root, f)).not.toMatch(/process\.env\.(?!NODE_ENV\b)/);
    for (const f of files) expect(readFileSync(f, "utf8"), path.relative(root, f)).not.toMatch(/NEXT_PUBLIC_\w*(KEY|SECRET|TOKEN)/i);
    expect(readFileSync(path.join(root, ".env.example"), "utf8")).not.toMatch(/NEXT_PUBLIC_/);
  });

  it("no source file contains a key-shaped literal", () => {
    const rx = /sk-ant-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{32,}/;
    for (const f of [...walk(path.join(root, "src")), ...walk(path.join(root, "scripts"))]) expect(readFileSync(f, "utf8"), path.relative(root, f)).not.toMatch(rx);
  });
});

describe("production refuses to start without SESSION_SECRET (needs a production build: run `npm run build` first)", () => {
  const built = existsSync(path.join(root, ".next/BUILD_ID"));
  it.skipIf(!built)("the server process exits non-zero and says why", () => {
    const r = spawnSync(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", "3299"], {
      cwd: root,
      encoding: "utf8",
      timeout: 40_000,
      env: { ...process.env, NODE_ENV: "production", SESSION_SECRET: "", DATA_DIR: path.join(tmpdir(), `fs-nosecret-${Date.now()}`) },
    });
    expect(r.status, `${r.stdout}\n${r.stderr}`).not.toBe(0);
    expect(r.status).not.toBeNull(); // it exited by itself, it was not killed by the timeout
    expect(r.stdout + r.stderr).toMatch(/SESSION_SECRET is required in production\. Refusing to start without it\./);
  }, 60_000);
});

describe("dependencies", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { dependencies: Record<string, string>; devDependencies: Record<string, string>; engines?: { node?: string } };
  it("lucide-react is pinned to an exact version, and nothing is 'latest' or '*'", () => {
    expect(pkg.dependencies["lucide-react"]).toMatch(/^\d+\.\d+\.\d+$/);
    for (const [name, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) expect(v, name).not.toMatch(/^(latest|\*|next|beta|canary)$/);
  });
  it("declares the Node version that node:sqlite needs", () => {
    expect(pkg.engines?.node).toMatch(/22\.13/);
  });
});
