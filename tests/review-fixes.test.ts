import { describe, expect, it } from "vitest";
import { checkGuardrails } from "@/lib/ai/guardrails";
import { runTask, type TaskRequest } from "@/lib/ai/run";
import type { LLM } from "@/lib/ai/providers";
import { detectFlags, overallOf } from "@/lib/ai/mock/secondOpinion";
import { SAMPLES } from "@/data/samples";
import { PRIYA } from "@/data/personas";

const cats = (t: string, mode: "personal" | "education" = "personal") => checkGuardrails(t, mode).map((h) => h.category);

describe("Second Opinion detector is not thin", () => {
  it("flags urgency, guarantee, unregistered signal on a stacked pitch", () => {
    const f = detectFlags("VIP Telegram group, guaranteed 3%, risk free, only 2 seats left, pay today").map((x) => x.type);
    expect(f).toEqual(expect.arrayContaining(["guaranteed_returns", "urgency_pressure", "unregistered_signal"]));
    expect(overallOf(detectFlags("VIP Telegram group, guaranteed 3%, risk free, only 2 seats left, pay today"))).toBe("high");
  });

  const unseen: [string, string][] = [
    ["Join our paid WhatsApp channel, daily calls, only 5 seats remaining, hurry", "urgency_pressure"],
    ["Join our paid WhatsApp channel, daily calls, only 5 seats remaining, hurry", "unregistered_signal"],
    ["Insider info: a big announcement leaked, buy before tomorrow", "insider_claim"],
    ["Use 10x leverage on futures and double your money in a week", "leverage"],
    ["Use 10x leverage on futures and double your money in a week", "guaranteed_returns"],
    ["Next multibagger penny stock, operator confirmed, 4x in 5 days", "pump_pattern"],
    ["Invest now, no other charges, don't read the small print", "missing_disclosure"],
  ];
  for (const [text, type] of unseen) {
    it(`unseen message -> ${type}`, () => {
      expect(detectFlags(text).map((x) => x.type)).toContain(type);
    });
  }

  it("still flags at least six of the eight samples and keeps the legit two clean", () => {
    const flagged = SAMPLES.filter((s) => detectFlags(s.text).length > 0);
    expect(flagged.length).toBeGreaterThanOrEqual(6);
    for (const s of SAMPLES.filter((x) => x.legit)) expect(detectFlags(s.text)).toEqual([]);
  });
});

describe("guardrail false positives", () => {
  it("does not block harmless uses of 'best'", () => {
    for (const t of ["Waiting is in your best interest", "Follow best practices for record keeping", "We did our best effort"]) {
      expect(cats(t), t).toEqual([]);
    }
  });
  it("still blocks 'best' as a product claim", () => {
    for (const t of ["This is the best fund", "The best investment for you", "Our best plan"]) expect(cats(t), t).toContain("superlative");
  });
  it("neutral education may name a company; personal text may not", () => {
    const neutral = "A direct plan of an HDFC fund usually has a lower yearly cost.";
    expect(cats(neutral, "education")).toEqual([]);
    expect(cats(neutral, "personal")).toContain("instrument_pick");
  });
  it("education text that recommends or judges a named instrument is still blocked", () => {
    expect(cats("You should invest in HDFC funds", "education")).toContain("instrument_pick");
    expect(cats("Reliance is a safe bet", "education")).toContain("instrument_pick");
  });
  it("Second Opinion explanations may mention a named company neutrally (end to end)", async () => {
    const llm: LLM = {
      name: "anthropic",
      generate: async () =>
        JSON.stringify({
          overall: "low",
          summary: "No major warning signs found.",
          flags: [],
          questions: ["Who is sending this?"],
          educationalNote: "The message names HDFC only as an example of a fund house. Check who is behind any message.",
        }),
    };
    const req: TaskRequest = { task: "secondOpinion", language: "en", text: "An HDFC direct plan explained." };
    const out = await runTask(req, { llm });
    expect(out.source).toBe("provider");
    expect(out.events).toEqual([]);
  });
});

describe("warning-word loophole is closed", () => {
  const blocked = [
    "I promise guaranteed returns",
    "As promised, this fund offers guaranteed returns",
    "We guarantee you will earn more",
    "There is no doubt this gives guaranteed returns",
    "You will definitely earn a fixed profit",
    "It is a fully safe way to grow money",
  ];
  for (const t of blocked) it(`blocks: ${t}`, () => expect(cats(t)).toContain("guaranteed_return"));

  const allowed = [
    "Nobody can promise guaranteed returns",
    "Returns are never guaranteed",
    "Claims of guaranteed returns are a red flag",
    "Anyone promising guaranteed returns is not being honest",
    "No investment is risk-free",
    "Past performance is not a guarantee",
    "Guaranteed returns do not exist in market investing",
  ];
  for (const t of allowed) it(`allows warning: ${t}`, () => expect(cats(t)).toEqual([]));

  it("blocks first-person promises in Hindi and Tamil even next to a warning word", () => {
    expect(cats("हम वादा करते हैं, पक्का मुनाफा मिलेगा")).toContain("guaranteed_return");
    expect(cats("நிச்சயமாக லாபம் கிடைக்கும்")).toContain("guaranteed_return");
  });

  it("a live-style answer that promises returns is replaced and logged", async () => {
    const llm: LLM = { name: "anthropic", generate: async () => JSON.stringify({ text: "As promised, this plan has guaranteed returns." }) };
    const out = await runTask({ task: "nudgeCopy", language: "en", profile: PRIYA, nudge: { ruleId: "ef_low" } }, { llm });
    expect(out.events.some((e) => e.kind === "guardrail")).toBe(true);
    expect(JSON.stringify(out.data)).not.toMatch(/guaranteed/i);
  });
});
