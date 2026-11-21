import { describe, expect, it, vi } from "vitest";
import { ANITA, PRIYA, RAMESH, emptyProfile } from "@/data/personas";
import { SAMPLES } from "@/data/samples";
import { checkGuardrails } from "@/lib/ai/guardrails";
import { processOutput, runTask, type TaskRequest } from "@/lib/ai/run";
import { PlanItemSchema, PlanPackSchema, TASK_SCHEMAS } from "@/lib/ai/schemas";
import { resolveProvider, type LLM } from "@/lib/ai/providers";
import { runEngine } from "@/lib/engine";
import { redact } from "@/lib/redact";
import type { Lang } from "@/types";

const LANGS: Lang[] = ["en", "hi", "ta"];
const PROFILES = [PRIYA, RAMESH, ANITA, emptyProfile("en")];

const fake = (payload: unknown): LLM => ({ name: "anthropic", generate: async () => JSON.stringify(payload) });

describe("mock fixtures: every task x persona x language", () => {
  it("all pass schema, numeric validator and guardrails with no system events", async () => {
    for (const profile of PROFILES) {
      for (const language of LANGS) {
        const reqs: TaskRequest[] = [
          { task: "explainFindings", language, profile },
          { task: "draftPlanPack", language, profile },
          { task: "adviserCopilot", language, profile },
          { task: "nudgeCopy", language, profile, nudge: { ruleId: "ef_low" } },
          { task: "nudgeCopy", language, profile, nudge: { ruleId: "insurance_gap" } },
          { task: "nudgeCopy", language, profile, nudge: { ruleId: "rebalance" } },
          { task: "nudgeCopy", language, profile, nudge: { ruleId: "sip_review", goalId: profile.goals[0]?.id ?? "g1" } },
          { task: "answerQuestion", language, profile, question: "How is my emergency fund?" },
          { task: "answerQuestion", language, profile, question: "tell me about my loan" },
          { task: "answerQuestion", language, profile, question: "hello" },
          ...SAMPLES.map((s) => ({ task: "secondOpinion" as const, language, text: s.text })),
        ];
        for (const r of reqs) {
          if (r.task === "nudgeCopy" && r.nudge?.ruleId === "sip_review" && !profile.goals[0]) continue;
          const out = await runTask(r);
          expect(out.events, `${r.task} ${profile.id} ${language} ${JSON.stringify(out.events)}`).toEqual([]);
          const schema = TASK_SCHEMAS[r.task];
          expect(schema.safeParse(out.data).success, `${r.task} ${profile.id} ${language}`).toBe(true);
        }
      }
    }
  });
  it("rendered plan text has real figures and no placeholders", async () => {
    const out = await runTask({ task: "draftPlanPack", language: "en", profile: PRIYA });
    const text = JSON.stringify(out.data);
    expect(text).not.toContain("{{");
    expect(text).toContain("1.8");
  });
});

describe("plan schema cannot carry an instrument name", () => {
  const base = {
    id: "x",
    topic: "emergency_reserve",
    assetClass: "liquid_reserve",
    title: "t",
    rationale: "r",
    risks: "k",
    evidenceRefs: [],
  };
  it("accepts a valid item", () => expect(PlanItemSchema.safeParse(base).success).toBe(true));
  it("rejects extra instrument fields", () => {
    expect(PlanItemSchema.safeParse({ ...base, instrument: "Some Fund" }).success).toBe(false);
    expect(PlanItemSchema.safeParse({ ...base, ticker: "ABC" }).success).toBe(false);
  });
  it("rejects asset classes outside the enum", () => {
    expect(PlanItemSchema.safeParse({ ...base, assetClass: "single_stock" }).success).toBe(false);
  });
  it("whole pack is strict too", () => {
    expect(
      PlanPackSchema.safeParse({ lang: "en", summary: "s", priorities: [], items: [base], checklist: [], adviserQuestions: [], extra: 1 }).success,
    ).toBe(false);
  });
});

describe("invented numbers fall back to the fixture", () => {
  it("rejects an AI response with an invented number and uses the fixture", async () => {
    const bad = { findings: { ef: "You should keep 15 months saved." } };
    const out = await runTask({ task: "explainFindings", language: "en", profile: PRIYA }, { llm: fake(bad) });
    expect(out.source).toBe("fixture");
    expect(out.events.map((x) => x.kind)).toEqual(expect.arrayContaining(["numeric_rejected", "fallback"]));
    expect(JSON.stringify(out.data)).not.toContain("15 months");
  });
  it("rejects number words too", async () => {
    const bad = { findings: { ef: "Aim for twelve months of savings." } };
    const out = await runTask({ task: "explainFindings", language: "en", profile: PRIYA }, { llm: fake(bad) });
    expect(out.source).toBe("fixture");
  });
  it("accepts a clean placeholder answer from the provider", async () => {
    const good = { findings: { ef: "You have {{ef.months}} months saved." } };
    const out = await runTask({ task: "explainFindings", language: "en", profile: PRIYA }, { llm: fake(good) });
    expect(out.source).toBe("provider");
    expect((out.data as { findings: { ef: string } }).findings.ef).toBe("You have 1.8 months saved.");
  });
  it("retries once before falling back", async () => {
    const gen = vi.fn(async () => JSON.stringify({ findings: { ef: "Save 99 more" } }));
    await runTask({ task: "explainFindings", language: "en", profile: PRIYA }, { llm: { name: "gemini", generate: gen } });
    expect(gen).toHaveBeenCalledTimes(2);
  });
  it("falls back on provider errors and on invalid JSON", async () => {
    const boom: LLM = {
      name: "gemini",
      generate: async () => {
        throw new Error("down");
      },
    };
    const req: TaskRequest = { task: "nudgeCopy", language: "en", profile: PRIYA, nudge: { ruleId: "ef_low" } };
    expect((await runTask(req, { llm: boom })).source).toBe("fixture");
    const junk: LLM = { name: "gemini", generate: async () => "not json" };
    expect((await runTask(req, { llm: junk })).source).toBe("fixture");
  });
  it("serves fixtures when rate limited", async () => {
    const gen = vi.fn(async () => "{}");
    const out = await runTask({ task: "adviserCopilot", language: "en", profile: PRIYA }, { llm: { name: "gemini", generate: gen }, rateLimited: true });
    expect(gen).not.toHaveBeenCalled();
    expect(out.events[0].kind).toBe("rate_limited");
  });
});

describe("guardrails run on model output", () => {
  it("rejects a live answer that tips a stock, records a guardrail event and uses the validated fixture", async () => {
    const bad = { text: "You should buy this stock now." };
    const out = await runTask({ task: "nudgeCopy", language: "en", profile: PRIYA, nudge: { ruleId: "ef_low" } }, { llm: fake(bad) });
    expect(out.events.some((x) => x.kind === "guardrail")).toBe(true);
    expect(out.events.some((x) => x.kind === "fallback")).toBe(true);
    expect(out.source).toBe("fixture");
    expect(JSON.stringify(out.data)).not.toMatch(/buy this stock/i);
  });
  it("a forced stock-tip prompt yields a refusal and a refusal event (no model call)", async () => {
    const gen = vi.fn(async () => "{}");
    const out = await runTask(
      { task: "answerQuestion", language: "en", profile: PRIYA, question: "Which stock should I buy to double my money?" },
      { llm: { name: "gemini", generate: gen } },
    );
    expect(gen).not.toHaveBeenCalled();
    expect((out.data as { refused: boolean }).refused).toBe(true);
    expect(out.events[0].kind).toBe("refusal");
  });
});

describe("second opinion on the eight samples", () => {
  it("flags at least six and keeps the two legitimate ones out of 'high'", async () => {
    let flagged = 0;
    for (const s of SAMPLES) {
      const out = await runTask({ task: "secondOpinion", language: "en", text: s.text });
      const d = out.data as { overall: string; flags: unknown[] };
      if (d.flags.length > 0) flagged++;
      if (s.legit) expect(d.overall, s.id).toBe("low");
    }
    expect(SAMPLES.filter((s) => s.legit)).toHaveLength(2);
    expect(flagged).toBeGreaterThanOrEqual(6);
  });
  it("explains 3% a month with an engine-computed yearly figure", async () => {
    const out = await runTask({ task: "secondOpinion", language: "en", text: "Get guaranteed 3% every month, no risk" });
    expect(JSON.stringify(out.data)).toContain("42.6%");
  });
  it("detects Hindi and Tamil pitches", async () => {
    const hi = await runTask({ task: "secondOpinion", language: "hi", text: "गारंटी मुनाफा, आज ही जुड़ें" });
    const ta = await runTask({ task: "secondOpinion", language: "ta", text: "உத்தரவாதம் இன்றே சேருங்கள்" });
    expect((hi.data as { flags: unknown[] }).flags.length).toBeGreaterThan(0);
    expect((ta.data as { flags: unknown[] }).flags.length).toBeGreaterThan(0);
  });
  it("quotes are verbatim substrings of the message", async () => {
    for (const s of SAMPLES) {
      const out = await runTask({ task: "secondOpinion", language: "en", text: s.text });
      for (const f of (out.data as { flags: { quote: string }[] }).flags) expect(s.text).toContain(f.quote);
    }
  });
});

describe("redaction and logs", () => {
  it("redacts phones, emails and long digit strings", () => {
    const r = redact("Call +91 98765 43210 or mail me@example.com, acct 123456789012, pay Rs 999 or 50,000");
    expect(r).not.toMatch(/98765|example|123456789012/);
    expect(r).toContain("Rs 999");
    expect(r).toContain("50,000");
  });
  it("logger receives no profile fields or pasted text", async () => {
    const entries: unknown[] = [];
    await runTask({ task: "secondOpinion", language: "en", text: "guaranteed 3% monthly, secret word zebra" }, { log: (e) => entries.push(e) });
    await runTask({ task: "draftPlanPack", language: "en", profile: { ...PRIYA, name: "UniqueNameQ" } }, { log: (e) => entries.push(e) });
    const s = JSON.stringify(entries);
    expect(s).not.toMatch(/zebra|UniqueNameQ|45000|Chennai/);
    expect(Object.keys(entries[0] as object).sort()).toEqual(["latencyMs", "reasons", "status", "task"]);
  });
});

describe("provider config fails closed", () => {
  it("defaults to mock", () => expect(resolveProvider({}).provider).toBe("mock"));
  it("falls back to mock when AI_MODEL is empty", () => {
    const c = resolveProvider({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", AI_MODEL: "" });
    expect(c.provider).toBe("mock");
    expect(c.warning).toMatch(/AI_MODEL/);
  });
  it("falls back to mock when the key is empty", () => {
    expect(resolveProvider({ AI_PROVIDER: "gemini", AI_MODEL: "m" }).provider).toBe("mock");
  });
  it("uses the real provider only when key and model are set", () => {
    expect(resolveProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "k", AI_MODEL: "m" }).provider).toBe("gemini");
  });
});

describe("processOutput sanity", () => {
  it("blocks a pre-substitution literal in any prose field", () => {
    const e = runEngine(PRIYA);
    expect(processOutput({ text: "Save 5 more" }, e, "en").ok).toBe(false);
  });
  it("guardrail catches nothing in neutral planning text", () => {
    expect(checkGuardrails("Consider building a reserve in liquid, low-risk instruments")).toEqual([]);
  });
});
