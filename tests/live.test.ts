// Live-provider smoke check. Skipped in mock mode, so `npm test` stays offline and free.
//   PowerShell:  $env:AI_PROVIDER="anthropic"; $env:AI_MODEL="<id>"; $env:ANTHROPIC_API_KEY="<key>"; npm run test:live
//   bash:        AI_PROVIDER=gemini AI_MODEL=<id> GEMINI_API_KEY=<key> npm run test:live
//
// Why it exists: every rejected live answer silently falls back to a fixture, which can hide a broken
// live path. This prints how often the model's own answer survived validation, and FAILS if none did.
import { describe, expect, it } from "vitest";
import { ANITA, PRIYA, RAMESH } from "@/data/personas";
import { SAMPLES } from "@/data/samples";
import { makeLLM, resolveProvider } from "@/lib/ai/providers";
import { runTask, type TaskRequest } from "@/lib/ai/run";

const cfg = resolveProvider(process.env);
const live = cfg.provider !== "mock";

describe.skipIf(!live)(`live provider smoke (${cfg.provider})`, () => {
  it("reports how many answers came from the provider vs. the fixture fallback", async () => {
    const llm = makeLLM(cfg);
    const reqs: TaskRequest[] = [
      ...[PRIYA, RAMESH, ANITA].flatMap((profile) => [
        { task: "explainFindings", language: "en", profile } as TaskRequest,
        { task: "draftPlanPack", language: "en", profile } as TaskRequest,
        { task: "adviserCopilot", language: "en", profile } as TaskRequest,
      ]),
      { task: "draftPlanPack", language: "hi", profile: PRIYA },
      { task: "draftPlanPack", language: "ta", profile: PRIYA },
      { task: "nudgeCopy", language: "en", profile: PRIYA, nudge: { ruleId: "ef_low" } },
      { task: "answerQuestion", language: "en", profile: PRIYA, question: "How is my emergency fund?" },
      ...SAMPLES.slice(0, 4).map((s) => ({ task: "secondOpinion", language: "en", text: s.text }) as TaskRequest),
    ];
    const rows: { task: string; lang: string; source: string; ms: number; events: string }[] = [];
    const shown: string[] = [];
    for (const r of reqs) {
      const out = await runTask(r, { llm, timeoutMs: 30_000 });
      rows.push({ task: r.task, lang: r.language, source: out.source, ms: out.latencyMs, events: out.events.map((e) => `${e.kind}:${e.detail}`).join(",") || "-" });
      // Keep one real model-written plan item per language, rendered with the engine's figures, to show on stage.
      if (out.source === "provider" && r.task === "draftPlanPack" && !shown.some((s) => s.startsWith(`[${r.language}]`))) {
        const item = (out.data as { items: { title: string; rationale: string }[] }).items[0];
        shown.push(`[${r.language}] ${item.title}\n      ${item.rationale}`);
      }
    }
    console.info(`\n=== Written by the live model, then checked and filled with engine figures ===\n${shown.join("\n") || "(none survived validation)"}\n`);
    const provider = rows.filter((x) => x.source === "provider").length;
    console.table(rows);
    console.info(`live answers that passed validation: ${provider}/${rows.length}`);
    expect(provider, "every live answer was rejected and replaced by fixtures; check the events column").toBeGreaterThan(0);
  }, 300_000);
});

describe("live smoke is opt-in", () => {
  it("is skipped unless a real provider, key and model are all configured", () => {
    expect(resolveProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "k", AI_MODEL: "" }).provider).toBe("mock");
  });
});
