// Builds the app into a separate directory with SENTINEL secrets in the environment, then searches everything the
// browser can download (and the rest of the build output) for the sentinel values and for key-shaped strings.
// A secret that leaks into client code would show up here. It takes a while, so it has a long timeout.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const dist = ".next-secretcheck";
const SENTINELS = {
  ANTHROPIC_API_KEY: "sk-ant-SENTINELKEYANTHROPIC1234567890abcdef",
  GEMINI_API_KEY: "AIzaSENTINELKEYGOOGLE1234567890abcdefghij",
  SESSION_SECRET: "SENTINEL-session-secret-value-0123456789",
  AI_MODEL: "sentinel-model-id-xyz",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (f === "cache") continue;
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs|cjs|css|html|json|txt|map|rsc|body|meta)$/.test(f)) out.push(p);
  }
  return out;
}

afterAll(() => rmSync(path.join(root, dist), { recursive: true, force: true }));

describe("build output", () => {
  it("contains no secret value and no key-shaped string, in browser code or anywhere else", () => {
    rmSync(path.join(root, dist), { recursive: true, force: true });
    const r = spawnSync(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...SENTINELS, AI_PROVIDER: "anthropic", NEXT_DIST_DIR: dist, NEXT_TELEMETRY_DISABLED: "1" },
      timeout: 280_000,
    });
    expect(r.status, `build failed:\n${(r.stdout + r.stderr).slice(-1500)}`).toBe(0);
    expect(existsSync(path.join(root, dist, "static"))).toBe(true);

    const files = walk(path.join(root, dist));
    expect(files.length).toBeGreaterThan(50);
    const clientFiles = files.filter((f) => f.includes(`${path.sep}static${path.sep}`));
    expect(clientFiles.length).toBeGreaterThan(10);

    const keyShaped = /sk-ant-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{30,}/;
    const leaks: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      for (const [name, value] of Object.entries(SENTINELS)) if (text.includes(value)) leaks.push(`${name} value in ${path.relative(root, f)}`);
      if (keyShaped.test(text)) leaks.push(`key-shaped string in ${path.relative(root, f)}`);
    }
    expect(leaks).toEqual([]);

    // the browser bundles also must not name the secret environment variables at all
    for (const f of clientFiles) {
      const text = readFileSync(f, "utf8");
      for (const name of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "SESSION_SECRET"]) expect(text, `${name} named in ${path.relative(root, f)}`).not.toContain(name);
    }
  }, 300_000);
});
