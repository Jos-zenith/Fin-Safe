// Regression tests for a third-party review: classic Indian phishing that carries no investment pitch, and two
// guardrail edges. These are NOT the frozen adversarial set and were not drawn from it.
import { describe, expect, it } from "vitest";
import { checkGuardrails } from "@/lib/ai/guardrails";
import { detectFlags, overallOf } from "@/lib/scam/detect";

const level = (t: string) => overallOf(detectFlags(t));

describe("account-threat phishing without an investment pitch", () => {
  const scams: [string, string][] = [
    ["en, no link", "Your KYC will expire, update on this link to avoid account suspension"],
    ["en, bank threat", "Dear customer your bank account will be blocked in 24 hrs. Complete KYC now: bit.ly/3xKyc"],
    ["en, PAN", "HDFC Bank: PAN not linked, your account will be suspended. Click to update immediately."],
    ["hinglish", "Aapka KYC expire ho gaya hai, abhi link par update karein warna account band ho jayega"],
    ["ta", "உங்கள் KYC காலாவதியாகிவிட்டது, கணக்கு முடக்கப்படும், இந்த இணைப்பில் உடனே புதுப்பிக்கவும்"],
    ["lottery with fee", "Congratulations! You won a lottery of 25 lakh. Pay 5000 processing fee to claim."],
  ];
  for (const [name, text] of scams) it(`rates ${name} as high`, () => expect(level(text)).toBe("high"));

  it("flags a utility cut-off with a call-now request at least medium", () => {
    expect(["medium", "high"]).toContain(level("Your electricity will be disconnected tonight 9:30pm. Call 98xxxxxx01 to update bill"));
  });

  const benign = [
    "Your account statement for October is ready. Never share your OTP with anyone.",
    "Your credit card bill of Rs 4,200 is due on 25th. Pay via the official app.",
    "Your electricity bill has been paid. Thank you.",
    "Your KYC is verified. Thank you for visiting the branch.",
    "Reminder: your SIP of Rs 5000 will be debited on the 5th. No action needed.",
    "SEBI warns investors: beware of guaranteed return schemes. Verify advisers on the official registry.",
  ];
  for (const t of benign) it(`does not raise a warning for: ${t.slice(0, 48)}`, () => expect(level(t)).toBe("low"));
});

describe("guardrail edges", () => {
  it("lets ordinary comparison wording through", () => {
    expect(checkGuardrails("Compare plans to find the best balance between cost and cover.")).toEqual([]);
  });
  it("still blocks a pushed superlative", () => {
    expect(checkGuardrails("This is the best option for you.").map((h) => h.category)).toContain("superlative");
    expect(checkGuardrails("ABC is the best fund").map((h) => h.category)).toContain("superlative");
  });
  it("catches a branded cap-class fund in personal text, not generic wording", () => {
    expect(checkGuardrails("Switching to a Quant Small Cap Fund could help.").map((h) => h.category)).toContain("instrument_pick");
    expect(checkGuardrails("A small cap fund can swing a lot in the short run.").map((h) => h.category)).not.toContain("instrument_pick");
    expect(checkGuardrails("Build your Emergency Fund first.").map((h) => h.category)).not.toContain("instrument_pick");
  });
});
