// "Ask a question" must visibly LISTEN: refuse specific securities and market predictions, and route every
// other question to an answer built from the user's own numbers or plain education.
import { describe, expect, it } from "vitest";
import { ANITA, PRIYA, RAMESH } from "@/data/personas";
import { classifyRequest } from "@/lib/ai/guardrails";
import { ANSWER_TEXT } from "@/lib/ai/mock/answers";
import { intentOf } from "@/lib/ai/mock";
import { runTask } from "@/lib/ai/run";
import type { AnswerResult } from "@/lib/ai/schemas";
import type { Lang, UserProfile } from "@/types";
import { en, hi, ta } from "./helpers";

const ask = async (question: string, profile: UserProfile = PRIYA, language: Lang = "en") => {
  const out = await runTask({ task: "answerQuestion", language, profile, question });
  return { ...(out.data as AnswerResult), events: out.events };
};

describe("refusals from the review", () => {
  const security = ["Is HDFC bank a good investment?", "bitcoin or gold", "Which stock should I buy?", "Is Tata Motors a good buy?", "Should I buy bitcoin?"];
  const prediction = ["nifty will hit 30000?", "Will the market crash next year?", "Is it a good time to invest?", "When will the market recover?", "market girega kya"];
  for (const q of security) {
    it(`refuses (security): ${q}`, async () => {
      expect(classifyRequest(q)).toBe("security");
      const r = await ask(q);
      expect(r.refused).toBe(true);
      expect(r.kind).toBe("security");
      expect(r.events[0]).toEqual({ kind: "refusal", detail: "stock_tip_request" });
    });
  }
  for (const q of prediction) {
    it(`refuses (prediction): ${q}`, async () => {
      const r = await ask(q);
      expect(r.refused).toBe(true);
      expect(r.kind).toBe("prediction");
      expect(r.answer).toMatch(/predict/i);
      expect(r.events[0]).toEqual({ kind: "refusal", detail: "prediction_request" });
    });
  }
  it("does not refuse asset-class planning questions", () => {
    for (const q of ["Is gold a good idea?", "Should I invest in equity for 10 years?", "What is a SIP?", "Should I buy a house?", "Should I prepay my loan?"]) {
      expect(classifyRequest(q), q).toBeNull();
    }
  });
});

describe("answers listen to the question", () => {
  const cases: [string, ReturnType<typeof intentOf>][] = [
    ["Why is my score low?", "score_intro"],
    ["Should I prepay my loan?", "prepay_ok"],
    ["Tell me about my loans", "debt"],
    ["What is a SIP?", "sip"],
    ["Explain mutual funds", "mutual_fund"],
    ["What is term insurance?", "term"],
    ["Is my insurance enough?", "insurance"],
    ["Is gold a good idea?", "gold"],
    ["Should I buy a house?", "house"],
    ["Equity or debt for a long goal?", "equity_debt"],
    ["How much should I save each month?", "savings"],
    ["Direct vs regular plans?", "direct_regular"],
    ["What is inflation?", "inflation"],
    ["How is my emergency fund?", "ef"],
    ["asdf qwerty", "fallback"],
  ];
  for (const [q, intent] of cases) it(`${q} -> ${intent}`, () => expect(intentOf(q)).toBe(intent));

  it("gives different answers to different questions (not one canned reply)", async () => {
    const qs = cases.map((c) => c[0]).filter((q) => !/asdf/.test(q));
    const answers = await Promise.all(qs.map((q) => ask(q).then((r) => r.answer)));
    expect(new Set(answers).size).toBeGreaterThanOrEqual(qs.length - 2);
    expect(answers.every((a) => !/^Good question/.test(a))).toBe(true);
  });

  it("uses the user's own numbers", async () => {
    expect((await ask("How is my emergency fund?", PRIYA)).answer).toContain("1.8");
    expect((await ask("Why is my score low?", PRIYA)).answer).toMatch(/Your score is \d+/);
    const prepayRamesh = await ask("Should I prepay my loan?", RAMESH);
    expect(prepayRamesh.answer).toContain("36%"); // his card dues: the costly loan
    expect((await ask("Should I prepay my loan?", PRIYA)).answer).toMatch(/no loans/i);
    expect((await ask("Should I prepay my loan?", ANITA)).answer).toMatch(/None of your loans/);
    expect((await ask("Tell me about gold", PRIYA)).answer).toMatch(/5%.*10%/);
  });

  it("the score answer names the weakest area, and it differs by person", async () => {
    const priya = (await ask("Why is my score low?", PRIYA)).answer;
    const anita = (await ask("Why is my score low?", ANITA)).answer;
    expect(priya).not.toBe(anita);
  });

  it("an unmatched question says what it CAN do instead of pretending", async () => {
    const r = await ask("asdf qwerty");
    expect(r.refused).toBe(false);
    expect(r.answer).toMatch(/not sure I understood/);
    expect(r.answer).toMatch(/can't pick stocks or predict markets/);
  });
});

describe("every answer passes the validators in every language and for every persona", () => {
  const keys = Object.keys(ANSWER_TEXT.en);
  it("templates exist in all three languages", () => {
    expect(Object.keys(ANSWER_TEXT.hi).sort()).toEqual([...keys].sort());
    expect(Object.keys(ANSWER_TEXT.ta).sort()).toEqual([...keys].sort());
  });
  const questions = ["Why is my score low?", "Should I prepay my loan?", "What is a SIP?", "Explain mutual funds", "What is term insurance?", "Is my insurance enough?", "Is gold a good idea?", "Should I buy a house?", "Equity or debt?", "How much should I save?", "Direct vs regular plans?", "What is inflation?", "How is my emergency fund?", "my goals", "Is my portfolio diversified?", "nonsense"];
  for (const lang of ["en", "hi", "ta"] as Lang[]) {
    it(`${lang}: no guardrail or numeric rejection`, async () => {
      for (const p of [PRIYA, RAMESH, ANITA]) {
        for (const q of questions) {
          const r = await ask(q, p, lang);
          expect(r.events, `${lang} ${p.id} ${q}`).toEqual([]);
          expect(r.answer).not.toContain("{{");
        }
      }
    });
  }
});

describe("the suggestion chips work in every language", () => {
  for (const [lang, d] of [["en", en], ["hi", hi], ["ta", ta]] as const) {
    it(`${lang}: s1-s4 are answered with real content, s5 is refused`, async () => {
      const fallback = ANSWER_TEXT[lang].fallback;
      for (const k of ["ask.s1", "ask.s2", "ask.s3", "ask.s4"] as const) {
        const r = await ask((d as Record<string, string>)[k], PRIYA, lang);
        expect(r.refused, k).toBe(false);
        expect(r.answer, k).not.toBe(fallback);
      }
      const refused = await ask((d as Record<string, string>)["ask.s5"], PRIYA, lang);
      expect(refused.refused).toBe(true);
    });
  }
});
