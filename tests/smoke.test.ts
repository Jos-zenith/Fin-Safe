// The live smoke tooling, tested WITHOUT a real model. A stand-in model that writes the template shape passes;
// one that breaks the rules fails and says so; and with no key the script refuses to produce a report at all.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRIYA } from "@/data/personas";
import type { LLM } from "@/lib/ai/providers";
import { fixtureFor } from "@/lib/ai/run";
import { NOT_EXERCISED, passed, renderSmokeDoc, runSmoke, smokeRequests, SMOKE_TASKS, summarise } from "@/lib/ai/smoke";
import type { TaskRequest } from "@/lib/ai/run";
import { runEngine } from "@/lib/engine";
import { MODEL_RX } from "./model-rx";

const root = path.resolve(__dirname, "..");
const SECRET = "sk-test-SECRET-key-123456";

const LANG_WORD: Record<string, string> = { en: "English", hi: "Hindi", ta: "Tamil" };

/** A stand-in "model": finds the request from the prompt (task and language) and answers with `answer(request, template)`. */
function standIn(answer: (req: TaskRequest, template: unknown) => unknown): { llm: LLM; prompts: string[] } {
  const reqs = smokeRequests();
  const prompts: string[] = [];
  const llm: LLM = {
    name: "anthropic",
    generate: async (system, user) => {
      prompts.push(system + "\n" + user);
      const task = /Task: (\w+)\./.exec(user)?.[1];
      const language = /Language: (\w+)/.exec(user)?.[1];
      const req = reqs.find((r) => r.task === task && LANG_WORD[r.language] === language);
      if (!req) throw new Error("unknown request");
      const template = fixtureFor(req, runEngine(req.profile ?? PRIYA));
      return JSON.stringify(answer(req, template));
    },
  };
  return { llm, prompts };
}

describe("smoke requests", () => {
  it("cover every AI task for Priya in English, Hindi and Tamil", () => {
    const reqs = smokeRequests();
    expect(reqs).toHaveLength(SMOKE_TASKS.length * 3);
    for (const task of SMOKE_TASKS) expect(reqs.filter((r) => r.task === task).map((r) => r.language).sort()).toEqual(["en", "hi", "ta"]);
  });
});

describe("a well-behaved stand-in model", () => {
  it("passes, and the report has per-task counts, p50 and max latency", async () => {
    const { llm } = standIn((_req, template) => template);
    const rows = await runSmoke(llm);
    expect(rows.every((r) => r.source === "provider")).toBe(true);
    expect(passed(rows)).toBe(true);
    const doc = renderSmokeDoc(rows, { provider: "anthropic", at: "2000-01-01T00:00:00.000Z" });
    expect(doc).toMatch(/\*\*Result: PASS\*\*/);
    for (const t of SMOKE_TASKS) expect(doc).toContain(`| ${t} | 3 | 3 | 100% |`);
    for (const col of ["p50 ms", "max ms", "schema failures", "numeric rejections", "guardrail rejections", "fallbacks"]) expect(doc).toContain(col);
    expect(doc).toMatch(/does \*\*not\*\* measure quality/);
  });
});

describe("a stand-in model that breaks the rules", () => {
  it("is counted as rejected and the run FAILS, with the reasons in the report", async () => {
    // every plan pack carries a literal number; every answer to the question is not even JSON-shaped right
    const { llm } = standIn((req, template) => {
      if (req.task === "draftPlanPack") {
        const t = template as { items: Record<string, unknown>[] };
        return { ...t, items: t.items.map((it, k) => (k === 0 ? { ...it, rationale: "Your emergency fund covers 3 months." } : it)) };
      }
      if (req.task === "answerQuestion") return { nonsense: true };
      return template;
    });
    const rows = await runSmoke(llm);
    const sum = Object.fromEntries(summarise(rows).map((s) => [s.task, s]));
    expect(sum.draftPlanPack.kept).toBe(0);
    expect(sum.draftPlanPack.numericRejected).toBeGreaterThanOrEqual(3);
    expect(sum.draftPlanPack.fallback).toBe(3);
    expect(sum.answerQuestion.schemaInvalid).toBeGreaterThanOrEqual(3);
    expect(sum.explainFindings.kept).toBe(3);
    expect(passed(rows)).toBe(false);
    const doc = renderSmokeDoc(rows, { provider: "gemini", at: "2000-01-01T00:00:00.000Z" });
    expect(doc).toMatch(/\*\*Result: FAIL\*\*/);
    expect(doc).toMatch(/\| draftPlanPack \| 3 \| 0 \| 0% \|/);
  });
});

describe("what the report never contains", () => {
  it("has no key, no model id, no profile data and no model text", async () => {
    const { llm } = standIn((_req, template) => template);
    const rows = await runSmoke(llm);
    const doc = renderSmokeDoc(rows, { provider: "anthropic", at: "2000-01-01T00:00:00.000Z" });
    expect(doc).not.toContain(SECRET);
    expect(doc).not.toMatch(MODEL_RX);
    expect(doc).not.toMatch(/Chennai|45000|45,000/);
    expect(doc).not.toMatch(/₹|\{\{/);
    expect(JSON.stringify(rows)).not.toMatch(/₹|\{\{/);
  });
});

describe("npm run smoke:live without a key", () => {
  const script = path.join(root, "scripts/smoke-live.ts");
  const tsx = path.join(root, "node_modules/tsx/dist/cli.mjs");
  const report = path.join(root, "docs/live-smoke.md");

  it("says the live path was not exercised, exits non-zero and writes no report", () => {
    const before = existsSync(report) ? statSync(report).mtimeMs : null;
    const r = spawnSync(process.execPath, [tsx, script], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, AI_PROVIDER: "anthropic", AI_MODEL: "", ANTHROPIC_API_KEY: SECRET, GEMINI_API_KEY: "" },
    });
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain(NOT_EXERCISED);
    expect(r.stdout + r.stderr).not.toContain(SECRET);
    expect(existsSync(report) ? statSync(report).mtimeMs : null).toBe(before);
  }, 60_000);

  it("with mock mode, also refuses", () => {
    const r = spawnSync(process.execPath, [tsx, script], { cwd: root, encoding: "utf8", env: { ...process.env, AI_PROVIDER: "mock", AI_MODEL: "", ANTHROPIC_API_KEY: "", GEMINI_API_KEY: "" } });
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain(NOT_EXERCISED);
  }, 60_000);
});

describe("docs/live-smoke.md and the README", () => {
  const report = path.join(root, "docs/live-smoke.md");
  const readme = readFileSync(path.join(root, "README.md"), "utf8");

  it("the README says plainly whether the live path has been exercised", () => {
    if (existsSync(report)) {
      expect(readFileSync(report, "utf8")).toMatch(/Generated by `npm run smoke:live`/);
      expect(readme).toMatch(/docs\/live-smoke\.md/);
    } else {
      expect(readme).toContain(NOT_EXERCISED);
    }
  });
  it("a committed report, if any, was generated and holds no secrets", () => {
    if (!existsSync(report)) return;
    const doc = readFileSync(report, "utf8");
    expect(doc).toMatch(/Generated by `npm run smoke:live`/);
    expect(doc).not.toMatch(/sk-[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}|x-api-key/);
  });
});
