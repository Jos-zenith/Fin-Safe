// No literal model name or version anywhere: the model id comes ONLY from the AI_MODEL environment variable.
// Scans source, tests, scripts, e2e, docs, CI and README. Generated reports must not contain one either.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MODEL_RX } from "./model-rx";

const root = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report", "coverage"]);
const SKIP_FILES = new Set(["package-lock.json", "model-rx.ts", "no-model-names.test.ts"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (SKIP_DIRS.has(f)) continue;
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|json|md|mjs|cjs|css|yml|yaml)$/.test(f) || f === ".env.example") out.push(p);
  }
  return out;
}

describe("no hardcoded model names", () => {
  it("source, tests, scripts, docs and CI contain none", () => {
    const files = walk(root).filter((f) => !SKIP_FILES.has(path.basename(f)));
    expect(files.length).toBeGreaterThan(40);
    const bad = files.filter((f) => MODEL_RX.test(readFileSync(f, "utf8"))).map((f) => path.relative(root, f));
    expect(bad).toEqual([]);
  });

  it("the pattern really catches a model id", () => {
    for (const s of ["claude-3", "gemini-pro", "gpt-4", "an opus model", "Sonnet"]) expect(MODEL_RX.test(s), s).toBe(true);
    expect(MODEL_RX.test("AI_MODEL comes from the environment")).toBe(false);
  });
});
