import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/engine";
import { PRIYA } from "@/data/personas";
import { NUMERIC_ALLOWLIST } from "@/lib/ai/numericAllowlist";
import { normalizeDigits, renderTemplate, validateNumericIntegrity } from "@/lib/ai/numeric";

const e = runEngine(PRIYA); // ef.months = 1.8, ef.target = 6, ef.gap = 105000
const pre = (t: string) => validateNumericIntegrity(t, e, NUMERIC_ALLOWLIST, "pre");
const post = (t: string) => validateNumericIntegrity(t, e, NUMERIC_ALLOWLIST, "post");

describe("numeric integrity - before substitution", () => {
  it("accepts a correct placeholder", () => {
    expect(pre("You have {{ef.months}} months saved.").ok).toBe(true);
  });
  it("rejects an invented number", () => {
    const r = pre("You should save 15 percent more.");
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("number:15");
  });
  it("rejects currency, percent and ratio shapes", () => {
    for (const t of ["Keep ₹1,20,000 aside", "Expect 12% growth", "A 3x cover", "Rs. 5000 per month", "between 8-10 years"]) {
      expect(pre(t).ok, t).toBe(false);
    }
  });
  it("rejects a spelled-out quantity ('twelve percent')", () => {
    const r = pre("Expect twelve percent growth");
    expect(r.ok).toBe(false);
    expect(r.violations).toContain("word:twelve");
  });
  it("rejects lakh / crore / hundred words", () => {
    for (const t of ["save a lakh", "about two crore", "a hundred rupees"]) expect(pre(t).ok, t).toBe(false);
  });
  it("rejects common Hindi and Tamil number words", () => {
    expect(pre("आपको बारह प्रतिशत मिलेगा").ok).toBe(false);
    expect(pre("இருபது சதவீதம் வளர்ச்சி").ok).toBe(false);
    expect(pre("पाँच साल में").ok).toBe(false);
  });
  it("normalizes Devanagari, Tamil and full-width digits", () => {
    expect(normalizeDigits("₹१२,०००")).toBe("₹12,000");
    expect(normalizeDigits("௧௨ சதவீதம்")).toBe("12 சதவீதம்");
    expect(normalizeDigits("１２３")).toBe("123");
    expect(pre("आपको १५ प्रतिशत चाहिए").ok).toBe(false);
    expect(pre("௧௫ சதவீதம்").ok).toBe(false);
  });
  it("rejects a placeholder that does not resolve to an engine value", () => {
    const r = pre("You have {{ef.nonsense}} months");
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatch(/unknown_placeholder/);
  });
  it("accepts allowlisted fixed phrases only", () => {
    expect(pre("Read about Section 80C and 24x7 help, a one-time step").ok).toBe(true);
    expect(pre("Section 80C gives 150000").ok).toBe(false);
  });
});

describe("numeric integrity - after substitution", () => {
  it("accepts a value that equals the engine value", () => {
    const { text } = renderTemplate("You have {{ef.months}} months and a gap of {{ef.gap}}.", e);
    expect(text).toBe("You have 1.8 months and a gap of ₹1,05,000.");
    expect(post(text).ok).toBe(true);
  });
  it("rejects a number that differs from the engine value", () => {
    expect(post("You have 2.5 months saved").ok).toBe(false);
    expect(post("A gap of ₹1,50,000").ok).toBe(false);
  });
  it("rejects leftover placeholders", () => {
    expect(post("You have {{ef.months}} months").violations).toContain("unresolved_placeholder");
  });
  it("accepts engine numbers written in Tamil digits", () => {
    expect(post("உங்களிடம் ௧.௮ மாதங்கள்").ok).toBe(true);
  });
  it("applies rounding tolerance only", () => {
    expect(post("about 1.8 months").ok).toBe(true);
    expect(post("about 1.9 months").ok).toBe(false);
  });
});

describe("allowlist hygiene", () => {
  it("every entry has a reason, passes the validator, and holds no financial quantity", () => {
    for (const a of NUMERIC_ALLOWLIST) {
      expect(a.reason.length).toBeGreaterThan(10);
      expect(pre(`See ${a.phrase}.`).ok, a.phrase).toBe(true);
      expect(a.phrase).not.toMatch(/₹|%|rs\b|lakh|crore/i);
    }
  });
});

describe("tolerance follows what the display rounds to", () => {
  // rupee amounts print as whole numbers, so a small amount such as 52.4 prints as "52" and must still match
  const ground = { flat: { "goal.g1.sip.base": 52.4, "ef.months": 1.8 }, units: { "goal.g1.sip.base": "inr", "ef.months": "months" } } as const;
  const post = (t: string) => validateNumericIntegrity(t, ground as never, undefined, "post");
  it("accepts a small rupee amount printed as a whole number", () => {
    expect(post("about ₹52 a month").ok).toBe(true);
  });
  it("still rejects a whole number that is a full rupee away", () => {
    expect(post("about ₹54 a month").ok).toBe(false);
  });
  it("does not let a decimal token borrow the whole-number allowance", () => {
    expect(post("about 52.5 months").ok).toBe(false);
  });
});
