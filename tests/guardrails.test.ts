import { describe, expect, it } from "vitest";
import { applyGuardrails, checkGuardrails, isStockTipRequest, SAFE_SENTENCE } from "@/lib/ai/guardrails";

const cats = (t: string) => checkGuardrails(t).map((h) => h.category);

describe("guardrail categories (English)", () => {
  it("blocks a buy/sell/hold directive on a named or demonstrative security", () => {
    expect(cats("You should buy this stock today")).toContain("security_directive");
    expect(cats("Sell all your Reliance shares")).toContain("security_directive");
    expect(cats("Buy TCS now")).toContain("security_directive");
  });
  it("blocks instrument-level picks by name", () => {
    expect(cats("Put money in Bitcoin and Infosys")).toContain("instrument_pick");
  });
  it("blocks price targets", () => {
    expect(cats("The price target is high")).toContain("price_target");
    expect(cats("It will reach ₹500 soon")).toContain("price_target");
  });
  it("blocks guaranteed-return language", () => {
    expect(cats("This plan gives guaranteed returns")).toContain("guaranteed_return");
    expect(cats("A risk-free way to grow")).toContain("guaranteed_return");
  });
  it("blocks unqualified superlatives", () => {
    expect(cats("This is the best fund")).toContain("superlative");
    expect(cats("A sure-shot idea")).toEqual(expect.arrayContaining(["superlative"]));
  });
  it("allows warnings and neutral planning text", () => {
    expect(cats("Nobody can promise guaranteed returns")).toEqual([]);
    expect(cats("No investment is risk-free")).toEqual([]);
    expect(cats("Consider building a reserve in liquid, low-risk instruments")).toEqual([]);
    expect(cats("An equity-oriented allocation may suit a long goal")).toEqual([]);
    expect(cats("Your portfolio holds no gold")).toEqual([]);
  });
});

describe("guardrail categories (Hindi and Tamil)", () => {
  it("Hindi", () => {
    expect(cats("यह शेयर खरीदें")).toContain("security_directive");
    expect(cats("गारंटी वाला रिटर्न मिलेगा")).toContain("guaranteed_return");
    expect(cats("यह सबसे अच्छा फंड है")).toContain("superlative");
    expect(cats("टारगेट प्राइस बहुत ऊँचा है")).toContain("price_target");
    expect(cats("कोई भी गारंटी नहीं दे सकता")).toEqual([]);
  });
  it("Tamil", () => {
    expect(cats("இந்த பங்கை வாங்குங்கள்")).toContain("security_directive");
    expect(cats("உத்தரவாத வருமானம் கிடைக்கும்")).toContain("guaranteed_return");
    expect(cats("இலக்கு விலை மிக அதிகம்")).toContain("price_target");
    expect(cats("இது மிகச் சிறந்த ஃபண்ட்")).toContain("superlative");
  });
});

describe("replacement and requests", () => {
  it("replaces blocked text with a safe generic sentence in each language", () => {
    expect(applyGuardrails("Buy this stock now", "en").text).toBe(SAFE_SENTENCE.en);
    expect(applyGuardrails("यह शेयर खरीदें", "hi").text).toBe(SAFE_SENTENCE.hi);
    expect(applyGuardrails("இந்த பங்கை வாங்குங்கள்", "ta").text).toBe(SAFE_SENTENCE.ta);
    expect(applyGuardrails("Build an emergency reserve", "en").text).toBe("Build an emergency reserve");
  });
  it("recognises stock-tip requests", () => {
    for (const q of ["Which stock should I buy?", "Should I sell my funds?", "give me a multibagger", "कौन सा शेयर लूँ", "எந்த பங்கு வாங்கலாமா"]) {
      expect(isStockTipRequest(q), q).toBe(true);
    }
    expect(isStockTipRequest("How much emergency fund do I need?")).toBe(false);
  });
});
