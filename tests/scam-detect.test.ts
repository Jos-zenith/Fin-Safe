// Unit tests for the scam check pieces: normalisation, offline link heuristics, weak-signal scoring, redaction,
// the missed-scam queue, and the rule that a model pass can add or raise warning signs but never remove one.
import { describe, expect, it } from "vitest";
import { mergeSecondOpinion, proseOf } from "@/lib/ai/secondOpinionMerge";
import { claimsSafe, LOW_RISK_SUMMARY } from "@/lib/scam/wording";
import { mockSecondOpinion } from "@/lib/ai/mock/secondOpinion";
import type { SecondOpinionResult } from "@/lib/ai/schemas";
import { appendMissed, KEY_MISSED, readMissed } from "@/lib/missedScams";
import { looksPersonalHandle, redact, redactWithCounts } from "@/lib/redact";
import { analyse, detectFlags, overallOf } from "@/lib/scam/detect";
import { foldDigits, normalizeText, romanFold, stripInvisible } from "@/lib/scam/normalize";
import { analyseLink, extractLinks, inspectLinks } from "@/lib/scam/urls";
import { clearAllDemoData, type Stores, type StorageLike } from "@/lib/storage";

const types = (t: string) => detectFlags(redact(t)).map((h) => h.type);
const overall = (t: string) => overallOf(detectFlags(redact(t)));

describe("normalisation", () => {
  it("removes invisible characters, so zero-width joiners cannot split a word", () => {
    expect(stripInvisible("gua‍ran‌tee​d")).toBe("guaranteed");
    expect(types("Assured‍ profit of 25% e​very month")).toContain("guaranteed_returns");
    expect(types("share the O​TP now")).toContain("credential_request");
  });
  it("folds Devanagari, Tamil, full-width and Arabic-Indic digits 1:1", () => {
    expect(foldDigits("௧௦% १०% １０% ١٠%")).toBe("10% 10% 10% 10%");
    expect(foldDigits("१२३").length).toBe(3);
    expect(types("मासिक १०% पक्का मुनाफा")).toContain("guaranteed_returns");
    expect(types("மாதம் ௧௦% லாபம்")).toContain("guaranteed_returns");
  });
  it("repairs spaced-out and stretched letters", () => {
    expect(normalizeText("send the O T P now")).toContain("otp");
    expect(normalizeText("p-i-n number")).toContain("pin");
    expect(normalizeText("guaranteeeeed")).toBe("guaranteed");
    expect(types("Please share your O.T.P. with our executive")).toContain("credential_request");
  });
  it("folds look-alike letters and digit-for-letter swaps", () => {
    expect(normalizeText("gυаrаntееd")).toBe("guaranteed"); // Greek upsilon, Cyrillic а and е
    expect(types("gu4ranteed r3turns every month")).toContain("guaranteed_returns");
  });
  it("treats Devanagari spelling variants alike (nukta, chandrabindu)", () => {
    expect(normalizeText("मुनाफ़ा")).toBe(normalizeText("मुनाफा"));
    expect(normalizeText("पूँजी")).toBe(normalizeText("पूंजी"));
  });
  it("folds romanised Hindi and Tamil spellings together", () => {
    for (const [a, b] of [["laabam", "labam"], ["urudhi", "uruthi"], ["waapas", "vapas"], ["nashtam", "nastam"]]) expect(romanFold(a), `${a}/${b}`).toBe(romanFold(b));
    expect(types("Aapka paisa double ho jayega, uruthi aana laabam")).toContain("guaranteed_returns");
  });
  it("keeps quotes as verbatim substrings of what was pasted", () => {
    const msg = "Hello!\nOur  VIP  channel gave 5x on the last pick.  Join now.";
    for (const h of detectFlags(msg)) expect(msg).toContain(h.quote.split("\n")[0]);
  });
});

describe("offline link checks", () => {
  const reasons = (u: string) => analyseLink(u).reasons;
  it("flags shorteners, raw IPs, punycode, user-info tricks and app downloads", () => {
    expect(reasons("https://bit.ly/3xYz")).toContain("shortener");
    expect(reasons("http://185.44.12.9/login")).toContain("ip_host");
    expect(analyseLink("http://185.44.12.9/login").level).toBe("high");
    expect(reasons("https://xn--hdfcbnk-4ya.com/kyc")).toContain("punycode");
    expect(reasons("https://hdfcbank.com@evil-host.top/")).toContain("userinfo");
    expect(reasons("https://files-host.com/support.apk")).toContain("apk_file");
  });
  it("flags look-alike names but not the real address of the same name", () => {
    expect(reasons("https://hdfc-kyc-update.top/verify")).toContain("lookalike");
    expect(reasons("https://hdfcbamk.com/login")).toContain("lookalike");
    expect(reasons("https://sbi-secure-login.xyz")).toContain("lookalike");
    expect(reasons("https://www.hdfcbank.com/personal")).not.toContain("lookalike");
    expect(reasons("https://www.sbi.co.in/web/home")).not.toContain("lookalike");
  });
  it("scores unusual endings, no-https and hyphen chains as labelled heuristics", () => {
    const l = analyseLink("http://sunrise-kyc-update.top/verify?id=88213");
    expect(l.reasons).toEqual(expect.arrayContaining(["not_https", "odd_tld_strong", "lure_word_in_host", "many_hyphens"]));
    expect(l.level).toBe("high");
  });
  it("does not mark an ordinary address (and does not call it safe either)", () => {
    const l = analyseLink("https://www.examplebank.in/statements");
    expect(l.reasons).toEqual([]);
    expect(l.level).toBe("none");
  });
  it("extracts links from messy text, including trailing danda and bare shorteners", () => {
    expect(extractLinks("Update at https://a-b.top/x। Then call")).toContain("https://a-b.top/x");
    expect(extractLinks("see bit.ly/abc123 now")).toContain("bit.ly/abc123");
    expect(extractLinks("No links here, only 3.5% and e.g. fine")).toEqual([]);
    expect(inspectLinks("pay at tiny-link.top/a9").length).toBe(1);
  });
  it("a high-risk link alone is a phishing flag; an ordinary link with bank words is not", () => {
    expect(types("Click here to activate your trading account: http://185.44.12.9/login")).toContain("phishing_link");
    expect(types("Your October statement is ready: https://www.examplebank.in/statements. Log in from the official app only.")).not.toContain("phishing_link");
  });
});

describe("scoring combines weak signals, and a lone weak signal is ignored", () => {
  it("a lone weak signal reports nothing", () => {
    const d = analyse("Dinner split: please send Rs 600 to ravi.k87@oksunrise, I paid the bill at the restaurant.");
    expect(d.hits).toEqual([]);
    expect(overallOf(d.hits)).toBe("low");
  });
  it("the same payee request inside an investment pitch is a strong sign", () => {
    expect(types("Pay the registration amount to ravi.k87@oksunrise and send the screenshot to join.")).toContain("payment_to_individual");
  });
  it("two weak signals together are reported as medium", () => {
    const d = analyse("Special offer, by invitation only. Click here to claim your bonus.");
    expect(d.hits.length).toBeGreaterThanOrEqual(2);
    expect(d.hits.every((h) => h.severity === "low")).toBe(true);
    expect(overallOf(d.hits)).toBe("medium");
  });
  it("overallOf: any strong sign is high, three medium signs are high, one medium is medium", () => {
    expect(overallOf([{ severity: "high" }])).toBe("high");
    expect(overallOf([{ severity: "medium" }, { severity: "medium" }, { severity: "medium" }])).toBe("high");
    expect(overallOf([{ severity: "medium" }])).toBe("medium");
    expect(overallOf([{ severity: "low" }])).toBe("low");
    expect(overallOf([{ severity: "low" }, { severity: "low" }])).toBe("medium");
    expect(overallOf([])).toBe("low");
  });
});

describe("new warning-sign types", () => {
  it("advance fee before withdrawal", () => {
    expect(types("Your profits are ready for withdrawal. A clearance fee of Rs 8,500 must be paid to release the funds.")).toContain("advance_fee");
    expect(types("Fraudsters pose as officials and ask for a fee to release your profits. Never pay such fees.")).not.toContain("advance_fee");
  });
  it("claimed approval or backing", () => {
    expect(types("SEBI approved scheme with assured payouts")).toContain("false_authority");
    expect(types("This is a government-backed plan authorised by the regulator")).toContain("false_authority");
  });
  it("'you were selected' offers, but not an interview shortlist", () => {
    expect(types("You have been selected for a private wealth allocation.")).toContain("exclusive_selection");
    expect(types("Congratulations, you have been shortlisted for the interview round on Monday. Please bring your documents.")).toEqual([]);
  });
  it("remote-access apps and 'screen share' requests", () => {
    expect(types("Install AnyDesk and give us the 9-digit code")).toContain("credential_request");
    expect(types("Never install AnyDesk at the request of a caller. Banks do not ask for it.")).toEqual([]);
  });
});

describe("awareness text is not a scam", () => {
  const warnings = [
    "Investor alert: beware of persons promising guaranteed returns or sharing inside information.",
    "Do not share your OTP, PIN or password with anyone. Banks and regulators never ask for them.",
    "Your OTP for the transfer is 482913. Valid for 10 minutes. Never share this OTP with anyone, including bank staff.",
    "Download the official app from the app store to view your statement. We will never ask for your PIN or OTP.",
    "अपना OTP, पिन या पासवर्ड किसी को साझा न करें। बैंक और नियामक कभी इन्हें नहीं मांगते।",
    "यह OTP किसी को न बताएं, बैंक कर्मचारी को भी नहीं।",
    "உங்கள் OTP, பின் அல்லது கடவுச்சொல்லை யாரிடமும் பகிர வேண்டாம்.",
    "Apna OTP, PIN ya password kisi ko share na karein. Bank aur regulator kabhi nahi maangte.",
    "Ungal OTP, PIN, password ah yaaridamum share panna vendaam. Bank um regulator um ivatrai ketkaadhu.",
  ];
  for (const w of warnings) it(w.slice(0, 60), () => expect(overall(w)).toBe("low"));

  it("but a scam that borrows the words is still caught when it also pitches", () => {
    expect(overall("Beware of fakes! Join our VIP group now, guaranteed 25% every month.")).toBe("high");
  });
  it("and 'Never share' does not hide a real request in the next sentence", () => {
    expect(types("Never share your PIN. Please send your UPI PIN now to receive the cashback.")).toContain("credential_request");
  });
});

describe("a model pass can add or raise warning signs but never remove or lower them", () => {
  const rules = mockSecondOpinion("Guaranteed 25% every month. Only 3 seats left.", "en");
  const base: SecondOpinionResult = { overall: "low", summary: "Looks fine to me, completely safe.", flags: [], questions: ["Who are you?"], educationalNote: "n" };

  it("an empty, lenient model answer cannot remove a rule flag or lower the level", () => {
    const merged = mergeSecondOpinion(base, rules, "en");
    expect(merged.overall).toBe(rules.overall);
    for (const f of rules.flags) expect(merged.flags.find((m) => m.type === f.type)?.severity).toBe(f.severity);
  });
  it("a model flag with a LOWER severity does not lower the rule's", () => {
    const f = rules.flags[0];
    const merged = mergeSecondOpinion({ ...base, flags: [{ ...f, severity: "low", explanation: "minor" }] }, rules, "en");
    expect(merged.flags.find((m) => m.type === f.type)?.severity).toBe(f.severity);
  });
  it("a model flag the rules did not find is added, and a higher severity raises", () => {
    const merged = mergeSecondOpinion(
      { ...base, flags: [{ type: "leverage", severity: "high", quote: "", explanation: "Borrowing magnifies losses." }, { type: "urgency_pressure", severity: "high", quote: "", explanation: "Pressure to act." }] },
      rules,
      "en",
    );
    expect(merged.flags.some((m) => m.type === "leverage")).toBe(true);
    expect(merged.flags.find((m) => m.type === "urgency_pressure")?.severity).toBe("high");
    expect(merged.overall).toBe("high");
  });
  it("a merged result never carries a safe verdict", () => {
    const merged = mergeSecondOpinion({ ...base, summary: "This message is safe.", educationalNote: "It is a legitimate offer." }, mockSecondOpinion("hello there", "en"), "en");
    expect(claimsSafe(proseOf(merged))).toBe(false);
    expect(merged.summary).toBe(LOW_RISK_SUMMARY.en);
  });
});

describe("redaction", () => {
  it("hides PAN, Aadhaar-shaped and account numbers, phones, emails and UPI handles", () => {
    const r = redact("PAN ABCDE1234F, Aadhaar 1234 5678 9012, a/c 123456789012345, phone +91 98765 43210, mail a.b@x.com, pay ravi.k87@oksunrise");
    expect(r).not.toMatch(/ABCDE1234F|1234 5678 9012|123456789012345|98765|a\.b@x|ravi\.k87/);
    expect(r).toMatch(/\[pan\]/);
    expect(r).toMatch(/\[email\]/);
    expect(r).toMatch(/\[upi-id/);
  });
  it("strips link query strings and fragments but keeps the address", () => {
    const r = redact("Update here http://sunrise-kyc-update.top/verify?id=88213&token=abc#frag now");
    expect(r).toContain("http://sunrise-kyc-update.top/verify?[query]");
    expect(r).not.toMatch(/88213|token=abc|frag/);
  });
  it("keeps the dotted address of an IP link (it is a warning sign, not personal data)", () => {
    expect(redact("go to http://185.44.12.9/login")).toContain("185.44.12.9");
  });
  it("sees numbers written in Devanagari or Tamil digits and numbers split by invisible characters", () => {
    expect(redact("खाता संख्या ५०१२३४५६७८९०१")).toContain("[number]");
    expect(redact("எண் ௫௦௧௨௩௪௫௬௭௮௯௦௧")).toContain("[number]");
    expect(redact("call 98765​43210 now")).not.toMatch(/98765/);
  });
  it("keeps amounts and ordinary short numbers", () => {
    const r = redact("Pay Rs 999 or 50,000 by 31 December, 4821 is the last four");
    expect(r).toContain("Rs 999");
    expect(r).toContain("50,000");
    expect(r).toContain("4821");
  });
  it("removes names after a greeting or introduction on a best-effort basis, and leaves generic words alone", () => {
    expect(redact("Dear Priya Sharma, your account is blocked")).toContain("Dear [name]");
    expect(redact("my name is Ravi Kumar and I can help")).toContain("[name]");
    expect(redact("Dear customer, your account is blocked")).toContain("Dear customer");
    expect(redact("I am going home")).toBe("I am going home");
    expect(redact("மெரா பெயர் ரவி")).toContain("[name]");
    expect(redactWithCounts("Dear Priya, mail a@b.com").counts).toMatchObject({ name: 1, email: 1 });
  });
  it("tells personal-looking UPI handles from shop or biller ones, as a labelled heuristic", () => {
    expect(looksPersonalHandle("ravi.k87")).toBe(true);
    expect(looksPersonalHandle("9876543210")).toBe(true);
    expect(looksPersonalHandle("paytmqr281005050101")).toBe(false);
    expect(looksPersonalHandle("sharma.traders")).toBe(false);
    expect(redact("pay ravi.k87@oksunrise")).toContain("[upi-id:personal]");
  });
});

describe("Report a missed scam queue", () => {
  const mem = (): StorageLike & { m: Map<string, string> } => {
    const m = new Map<string, string>();
    return {
      m,
      get length() {
        return m.size;
      },
      key: (i) => [...m.keys()][i] ?? null,
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => void m.set(k, v),
      removeItem: (k) => void m.delete(k),
    };
  };
  const stores = (): Stores => ({ session: mem(), local: mem() });

  it("saves only redacted text, caps the list at 50 and drops entries older than 24 hours", () => {
    const s = stores();
    const t0 = 1_000_000_000_000;
    appendMissed("Pay ravi.k87@oksunrise, PAN ABCDE1234F, a/c 123456789012345, Dear Priya Sharma", "en", "low", s, t0);
    const raw = s.local.getItem(KEY_MISSED)!;
    expect(raw).not.toMatch(/ravi\.k87|ABCDE1234F|123456789012345|Priya/);
    for (let i = 0; i < 60; i++) appendMissed(`m${i}`, "en", "low", s, t0 + i);
    expect(readMissed(s, t0 + 100).length).toBe(50);
    expect(readMissed(s, t0 + 25 * 3_600_000).length).toBe(0);
  });
  it("is removed by 'Delete my demo data'", () => {
    const s = stores();
    appendMissed("a scam", "en", "low", s);
    expect(readMissed(s).length).toBe(1);
    clearAllDemoData(s);
    expect(readMissed(s).length).toBe(0);
  });
  it("works (does nothing) when storage is blocked", () => {
    expect(appendMissed("x", "en", "low", null)).toBe(0);
    expect(readMissed(null)).toEqual([]);
  });
});
