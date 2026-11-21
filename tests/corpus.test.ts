// Regression corpus from review rounds. Every row is a sentence that once failed in one direction.
// Add a row here whenever the guardrails or the Second Opinion detector are tuned, so their history is kept.
import { describe, expect, it } from "vitest";
import { checkGuardrails, isStockTipRequest } from "@/lib/ai/guardrails";
import { PRIYA } from "@/data/personas";
import { runEngine } from "@/lib/engine";
import { validateNumericIntegrity } from "@/lib/ai/numeric";
import { NUMERIC_ALLOWLIST } from "@/lib/ai/numericAllowlist";
import { detectFlags, overallOf } from "@/lib/ai/mock/secondOpinion";
import { redact } from "@/lib/redact";

const blocked = (t: string, mode: "personal" | "education" = "personal") => checkGuardrails(t, mode).length > 0;

describe("guardrails must NOT block legitimate planning text", () => {
  const ok = [
    "Your goal is to reach ₹50,00,000 in 10 years",
    "A goal this size is likely to reach its target only with steady saving",
    "Check the sum assured and any guaranteed renewal terms with your reviewer",
    "Your term cover has a sum assured of ₹1,00,00,000",
    "The risk-free rate is used as a benchmark in many calculations",
    "TCS on foreign remittances is collected at source and can be claimed against tax",
    "You have an HDFC home loan at 8.5%, so compare prepayment with investing",
    "Your ICICI term plan covers ₹1,00,00,000, which is above the starting point",
    "Waiting is in your best interest",
    "Reliance on social-media tips can be costly",
    "आपका लक्ष्य लगभग 20 साल दूर है",
    "टारगेट राशि तक पहुंचने के लिए मासिक बचत देखें",
    "உங்கள் இலக்கு தொகையை அடைய மாதச் சேமிப்பைப் பாருங்கள்",
  ];
  for (const t of ok) it(`allows: ${t}`, () => expect(checkGuardrails(t), t).toEqual([]));
});

describe("guardrails MUST block these (once passed)", () => {
  const bad = [
    "Tata Motors looks attractive right now",
    "Move your money into SBI Bluechip",
    "Expect around 15% returns every year",
    "This will double in 5 years",
    "Your money will definitely double",
    "The stock price will reach ₹500 by March",
    "Put some money in HDFC mutual fund",
    "Buy Infosys shares",
    "This fund offers guaranteed returns",
    "आपको निश्चित रूप से पक्का मुनाफा मिलेगा",
    "यह शेयर खरीदें",
  ];
  for (const t of bad) it(`blocks: ${t}`, () => expect(blocked(t), t).toBe(true));
});

describe("stock-tip refusal: only specific securities", () => {
  const answerable = [
    "Should I buy a house?",
    "Should I buy term insurance?",
    "I have an HDFC home loan, should I prepay?",
    "My ICICI term plan covers 1 crore, is that enough?",
    "Can I invest in gold for my goal?",
    "Should I invest in equity for a 10 year goal?",
    "What is a mutual fund?",
    "How much emergency fund do I need?",
    "How is my health score calculated?",
    "घर खरीदना चाहिए क्या?",
  ];
  for (const q of answerable) it(`answers: ${q}`, () => expect(isStockTipRequest(q), q).toBe(false));

  const refused = [
    "Which stock should I buy?",
    "Should I sell my funds?",
    "Is Tata Motors a good buy?",
    "Is HDFC bank share worth it?",
    "SBI share lena chahiye kya",
    "kaun sa share lun",
    "kaunsa stock kharidu",
    "entha share vanganum",
    "Should I buy bitcoin?",
    "give me a multibagger",
    "paisa double karne ka tip do",
    "कौन सा शेयर लूँ",
    "எந்த பங்கு வாங்கலாமா",
  ];
  for (const q of refused) it(`refuses: ${q}`, () => expect(isStockTipRequest(q), q).toBe(true));
});

describe("numeric validator accepts normal prose", () => {
  const e = runEngine(PRIYA);
  const pre = (t: string) => validateNumericIntegrity(t, e, NUMERIC_ALLOWLIST, "pre");
  for (const t of ["No one can promise returns", "Any one of these steps helps", "One of the risks is a sudden fall", "Nobody should rely on a single tip", "Each one of us reacts differently"]) {
    it(`accepts: ${t}`, () => expect(pre(t).ok, JSON.stringify(pre(t).violations)).toBe(true));
  }
  it("Hindi 'एक' as an article passes, but a counted quantity still fails", () => {
    expect(pre("यह एक अच्छा सवाल है").ok).toBe(true);
    expect(pre("आपके पास एक प्रतिशत की कमी है").ok).toBe(false);
    expect(pre("दो साल में").ok).toBe(false);
    expect(pre("एक लाख रुपये").ok).toBe(false);
  });
  it("still rejects real quantities in English", () => {
    for (const t of ["one percent more", "save one lakh", "in one year", "two months of costs"]) expect(pre(t).ok, t).toBe(false);
  });
});

describe("Second Opinion: broader scams, fewer false flags", () => {
  const types = (t: string) => detectFlags(t).map((f) => f.type);
  const missedBefore: [string, string][] = [
    ["Paisa double ho jayega bas 30 din mein, pakka munafa", "guaranteed_returns"],
    ["Pre-IPO shares available, allotment guaranteed. Transfer the amount to name@okaxis today", "unlisted_offering"],
    ["Pre-IPO shares available, allotment guaranteed. Transfer the amount to [upi-id] today", "payment_to_individual"],
    ["Your KYC has expired. Click here to update or your account will be blocked: bit.ly/kyc-now", "phishing_link"],
    ["Sir please share the OTP you just received to complete your refund", "credential_request"],
    ["Send your UPI PIN to claim the bonus", "credential_request"],
  ];
  for (const [t, type] of missedBefore) it(`flags ${type}: ${t.slice(0, 45)}…`, () => expect(types(t)).toContain(type));

  const cleanNotices = [
    "Please consult a SEBI-registered adviser before investing. Beware of guaranteed returns and never share your OTP with anyone.",
    "Our commission-free direct plans have a lower yearly cost than regular plans.",
    "Please finish your KYC before the 31st to keep trading. Visit your broker's branch or official website.",
    "Investor awareness: no regulated product can promise guaranteed returns. Do not share your OTP or PIN.",
  ];
  for (const t of cleanNotices) it(`no flags on: ${t.slice(0, 50)}…`, () => expect(detectFlags(t), t).toEqual([]));

  it("claiming to be SEBI-registered does not switch the unregistered flag off", () => {
    const t = "We are SEBI registered. Join our VIP Telegram group for sure profit tips, only 3 seats left";
    expect(types(t)).toContain("unregistered_signal");
    expect(overallOf(detectFlags(t))).toBe("high");
  });

  it("UPI IDs, PANs and emails are redacted before anything is sent", () => {
    const r = redact("Pay to name@okaxis, PAN ABCDE1234F, mail a.b@x.com");
    expect(r).not.toMatch(/okaxis|ABCDE1234F|a\.b@x/);
    expect(r).toMatch(/\[upi-id(?::personal)?\]/);
  });
});

// ---- every scripted Second Opinion text must itself pass the validators, in every language ----
import { SO_TEXT } from "@/lib/ai/mock/secondOpinion";
import { FLAG_TYPES, ASSET_CLASSES } from "@/lib/ai/schemas";
import { processOutput } from "@/lib/ai/run";
import { en, hi, ta } from "./helpers";

describe("scripted Second Opinion texts pass numeric + guardrail checks", () => {
  for (const lang of ["en", "hi", "ta"] as const) {
    for (const type of FLAG_TYPES) {
      it(`${lang} ${type}`, () => {
        const r = processOutput(SO_TEXT[lang][type], { flat: {}, units: {} }, lang, "education");
        expect(r.ok, JSON.stringify(r.events)).toBe(true);
        if (r.ok) expect(r.events).toEqual([]);
      });
    }
  }
});

describe("dynamically built i18n keys exist in all languages", () => {
  const dyn = [
    ...FLAG_TYPES.map((t) => `flag.${t}`),
    ...ASSET_CLASSES.map((t) => `asset.${t}`),
    ...["ef_low", "term_gap", "health_gap", "high_cost_debt", "dti_high", "savings_low", "concentration", "overlap_high", "tip_following", "irregular_income", "panic_sell"].map((t) => `eflag.${t}`),
    ...["INTAKE_DONE", "DRAFT_READY", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"].map((t) => `status.s.${t}`),
    ...["pending", "accepted", "edited", "rejected"].map((t) => `dec.${t}`),
    ...["high", "medium", "low"].flatMap((t) => [`sev.${t}`, `check.risk.${t}`]),
    ...["home", "education", "retirement", "travel", "wedding", "other"].map((t) => `goal.${t}`),
    ...["equity", "debt", "gold", "international_equity", "other"].map((t) => `class.${t}`),
    ...["suitability", "risk", "conflicts", "fee", "language"].map((t) => `adv.check.${t}`),
    ...["user", "ai", "adviser", "system"].map((t) => `actor.${t}`),
    ...["demo_banner", "earn_banner", "not_final", "reviewed_demo", "adviser_synthetic", "demo_workflow"].map((t) => `disc.${t}`),
    ...["plan_requested", "draft_generated", "case_opened", "item_accepted", "item_edited", "item_rejected", "item_comment", "approved_demo", "changes_requested", "user_replied", "panic_escalated", "cooling_off_shown",
      "system_numeric_rejected", "system_guardrail", "system_refusal", "system_schema_invalid", "system_provider_error", "system_fallback", "system_rate_limited"].map((t) => `action.${t}`),
    ...["lang", "name", "city", "income", "monthlyIncome", "essential", "other", "dependents", "savings", "debts", "term", "health", "goals", "holdings", "risk1", "risk2"].flatMap((t) => [`intake.q.${t}`, `intake.hint.${t}`]),
    ...["priya", "ramesh", "anita", "fresh"].map((t) => `persona.${t}`),
  ];
  it("no dynamic key is missing", () => {
    for (const [name, d] of [["en", en], ["hi", hi], ["ta", ta]] as const) {
      const missing = dyn.filter((k) => !(k in d));
      expect(missing, name).toEqual([]);
    }
  });
});

// ---- a label must never be shown twice (plan item "Range for discussion: Range for discussion: ...") ----
import { mockPlanPack } from "@/lib/ai/mock";
import { ANITA as ANITA_P, RAMESH as RAMESH_P } from "@/data/personas";
describe("plan item range notes read cleanly", () => {
  for (const lang of ["en", "hi", "ta"] as const) {
    it(`${lang}: no repeated label inside a note`, () => {
      for (const p of [PRIYA, RAMESH_P, ANITA_P]) {
        for (const item of mockPlanPack(p, runEngine(p), lang).items) {
          const note = item.rangeNote ?? "";
          const words = note.split(/[:：]/).map((x) => x.trim()).filter(Boolean);
          expect(new Set(words.slice(0, -1)).size, note).toBe(words.slice(0, -1).length);
          expect((note.match(/Range for discussion/gi) ?? []).length, note).toBeLessThanOrEqual(1);
        }
      }
    });
  }
});
