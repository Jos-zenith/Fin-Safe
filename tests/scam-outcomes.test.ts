// The check has three outcomes: High risk (strong indicators), Needs verification (not enough evidence either way) and
// No known indicators found. There is no green tick and no "safe" verdict, and a message with only weak signals about how
// it reached you (an unknown sender claiming to be your adviser, a private group, a new payee) is never "no known indicators".
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mockSecondOpinion, SO_TEXT } from "@/lib/ai/mock/secondOpinion";
import { FLAG_TYPES } from "@/lib/ai/schemas";
import { analyse } from "@/lib/scam/detect";
import { claimsSafe, LOW_RISK_SUMMARY } from "@/lib/scam/wording";
import { en, hi, ta } from "./helpers";

const level = (t: string, lang: "en" | "hi" | "ta" = "en") => mockSecondOpinion(t, lang).overall;
const types = (t: string) => analyse(t).hits.map((h) => h.type);

describe("three outcomes", () => {
  it("strong indicators are 'high' (High risk)", () => {
    expect(level("Guaranteed 25% every month, pay today to this UPI ID and join our VIP group.")).toBe("high");
  });

  it("weak signals about how the message reached you default to 'medium' (Needs verification), never 'low'", () => {
    const cases: [string, string, string][] = [
      ["impersonation", "Hello Sir, I am your new relationship manager at Crestline Wealth. I will guide your investments from now on, kindly reply YES.", "impersonation"],
      ["private group", "Reply and I will add you to our private community where I share my investment views every morning.", "private_channel"],
      ["new payee", "Please transfer your monthly investment to our new account details below, the old account is closed.", "new_payee"],
    ];
    for (const [label, text, type] of cases) {
      expect(types(text), label).toContain(type);
      expect(level(text), label).not.toBe("low");
    }
  });

  it("the same weak signals in Hindi and Tamil are also 'needs verification' or stronger", () => {
    expect(level("नमस्ते, मैं आपका नया रिलेशनशिप मैनेजर हूँ, अब से मैं आपके निवेश संभालूंगा। योजना भेजने के लिए हाँ लिखकर जवाब दें।", "hi")).not.toBe("low");
    expect(level("வணக்கம், நான் உங்கள் புதிய உறவு மேலாளர். இனி உங்கள் முதலீடுகளை நான் கவனிப்பேன். திட்டத்தை அனுப்ப ஆம் என்று பதிலளியுங்கள்.", "ta")).not.toBe("low");
  });

  it("plain, ordinary messages are 'low' (No known indicators found), including look-alikes", () => {
    for (const t of [
      "What a lovely evening, see you tomorrow",
      "Hi team, adding everyone to the office WhatsApp group for the annual day plan.",
      "You can open a new savings account at any branch with your KYC documents. Visit the bank's official website for the list.",
      "Please send the rent to my new account, I changed banks last month.",
      "My relationship manager at the bank called me yesterday about the loan.",
      "Mutual fund investments are subject to market risks. Read all scheme documents carefully.",
    ])
      expect(level(t), t).toBe("low");
  });

  it("the signals need a financial context: a family chat is not a private investment group", () => {
    expect(types("Mom: please join the family WhatsApp group for Diwali plans, I am adding you now.")).toEqual([]);
  });

  it("a warning that quotes the tactic is not the tactic", () => {
    expect(types("Beware: fraudsters say I am your relationship manager and ask you to pay a new account. Never pay to a personal account.")).not.toContain("impersonation");
  });

  it("'implied certainty' needs a call to act and no explicit guarantee", () => {
    const pitch = "We have never seen a losing month and you will definitely earn like our members. Contact us today to start, and join our private investment group.";
    expect(types(pitch)).toContain("implied_certainty");
    expect(types("A balanced fund may offer steady returns over many years, but returns are not guaranteed and you can lose money.")).not.toContain("implied_certainty");
    // with an explicit guarantee the stronger flag already says it
    expect(types("Guaranteed returns every month and steady income. Join now.")).not.toContain("implied_certainty");
  });

  it("combined weak signals add up past 'needs verification' to 'high'", () => {
    const t = "I am your new relationship manager. Join our private VIP trading group, steady income, never had a losing month. Pay the fee to our new account today.";
    expect(level(t)).toBe("high");
  });
});

describe("no green tick, no 'safe' verdict, and the agreed third-outcome wording", () => {
  it("says exactly that nothing known was found and that this does not mean the message is safe", () => {
    expect(LOW_RISK_SUMMARY.en).toBe("No known warning signs were found in this check. That does not mean the message is safe.");
    for (const lang of ["en", "hi", "ta"] as const) expect(mockSecondOpinion("hello, lunch at one?", lang).summary).toBe(LOW_RISK_SUMMARY[lang]);
  });

  it("the three outcome labels exist in every language and none is a safe verdict", () => {
    for (const d of [en, hi, ta] as Record<string, string>[]) {
      for (const k of ["check.risk.high", "check.risk.medium", "check.risk.low"]) {
        expect(d[k], k).toBeTruthy();
        expect(claimsSafe(d[k]), d[k]).toBe(false);
      }
    }
    expect(en["check.risk.high"]).toBe("High risk: strong indicators");
    expect(en["check.risk.medium"]).toBe("Needs verification: not enough evidence either way");
    expect(en["check.risk.low"]).toBe("No known indicators found");
  });

  it("every result summary for every outcome in every language is free of a safe verdict", () => {
    for (const lang of ["en", "hi", "ta"] as const) {
      for (const text of ["lunch at one?", "I am your new relationship manager, join our private VIP trading group", "Guaranteed 25% monthly, pay today to this UPI ID"]) {
        const out = mockSecondOpinion(text, lang);
        expect(claimsSafe([out.summary, out.educationalNote, ...out.questions, ...out.flags.map((f) => f.explanation)].join(" ")), `${lang}: ${text}`).toBe(false);
      }
    }
  });

  it("the result page never uses a green 'ok' chip or a check-mark icon for the third outcome", () => {
    const page = readFileSync("src/app/second-opinion/result/page.tsx", "utf8");
    // "low" is the informational (blue) chip: nothing found is not the same as safe
    expect(page).toMatch(/low: "info"/);
    expect(page).not.toMatch(/low: "ok"/);
    expect(page).not.toMatch(/CircleCheck|ShieldCheck|BadgeCheck/);
  });
});

describe("the 'needs verification' action list", () => {
  const steps = (d: Record<string, string>) => [1, 2, 3, 4].map((n) => d[`check.verify.${n}`]);

  it("exists in every language with the advised actions", () => {
    for (const d of [en, hi, ta] as Record<string, string>[]) for (const s of steps(d)) expect(s?.length).toBeGreaterThan(20);
    expect(en["check.verify.1"]).toMatch(/official number printed on your bank card/i);
    expect(en["check.verify.2"]).toMatch(/Do not use links from the message/i);
    expect(en["check.verify.3"]).toMatch(/registration you can check yourself on the official registry/i);
  });

  it("contains no phone number, link or web address (nothing fabricated)", () => {
    for (const d of [en, hi, ta] as Record<string, string>[]) {
      for (const s of steps(d)) expect(s, s).not.toMatch(/https?:|www\.|\.com|\.in\b|\.org|\d{4,}/i);
    }
  });

  it("is on the result page for the first and the second outcome", () => {
    expect(readFileSync("src/app/second-opinion/result/page.tsx", "utf8")).toMatch(/out\.overall !== "low"[\s\S]{0,200}check-verify/);
  });
});

describe("the new warning-sign types are first-class", () => {
  it("each has a label in every language and an explanation and question in the scripted text", () => {
    for (const t of ["impersonation", "private_channel", "new_payee", "implied_certainty"] as const) {
      expect(FLAG_TYPES).toContain(t);
      for (const d of [en, hi, ta] as Record<string, string>[]) expect(d[`flag.${t}`], t).toBeTruthy();
      for (const lang of ["en", "hi", "ta"] as const) {
        expect(SO_TEXT[lang][t].explanation.length, `${lang} ${t}`).toBeGreaterThan(30);
        expect(SO_TEXT[lang][t].question.length).toBeGreaterThan(15);
      }
    }
  });
});
