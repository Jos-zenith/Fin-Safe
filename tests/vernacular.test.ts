// Vernacular protection is the product's pitch, so Tamil, Hindi, romanised Hindi and romanised Tamil scam
// messages are tested as seriously as English. NOTE: these messages were written by the build agent, not
// by native speakers. Add real messages people receive here as they are collected.
import { describe, expect, it } from "vitest";
import { detectFlags, foldDigits, monthlyRateIn, overallOf } from "@/lib/ai/mock/secondOpinion";
import { runTask } from "@/lib/ai/run";

const types = (t: string) => detectFlags(t).map((f) => f.type);
const overall = (t: string) => overallOf(detectFlags(t));

const scams: { lang: string; text: string; must: string[] }[] = [
  // the exact shape the reviewer reported as "LOW, zero flags"
  { lang: "ta", text: "இந்த பங்கை வாங்குங்கள், மாதம் 10% உத்தரவாத லாபம், இன்றே பணம் போடுங்கள்", must: ["guaranteed_returns", "urgency_pressure", "unregistered_signal"] },
  { lang: "ta", text: "இந்த ஸ்டாக்கை வாங்குங்கள். உத்தரவாதமான வருமானம். இன்று மட்டும் சேருங்கள்.", must: ["guaranteed_returns", "urgency_pressure"] },
  { lang: "ta", text: "எங்கள் டெலிகிராம் குழுவில் சேருங்கள். மாதம் ௧௦% உறுதியான வருமானம். சில இடங்கள் மட்டுமே.", must: ["guaranteed_returns", "unregistered_signal", "urgency_pressure"] },
  { lang: "ta", text: "ரிஸ்க் இல்லை, பணம் இரட்டிப்பு ஆகும். உடனே முதலீடு செய்யுங்கள்.", must: ["guaranteed_returns", "urgency_pressure"] },
  { lang: "ta", text: "உங்கள் வங்கிக் கணக்கு முடக்கப்படும். OTP ஐ உடனே பகிருங்கள்.", must: ["credential_request"] },
  { lang: "ta", text: "ஆபரேட்டர் நாளை இந்த பென்னி ஸ்டாக்கை உயர்த்துவார். யாரிடமும் சொல்லாதீர்கள். இந்த பங்கை வாங்குங்கள்.", must: ["pump_pattern", "insider_claim"] },
  { lang: "hi", text: "यह शेयर खरीदें, हर महीने 10% गारंटीड मुनाफा, आज ही पैसा लगाएं", must: ["guaranteed_returns", "urgency_pressure", "unregistered_signal"] },
  { lang: "hi", text: "टेलीग्राम ग्रुप जॉइन करें। पक्का मुनाफा, पैसा दोगुना। सिर्फ आज सीमित सीट बची हैं।", must: ["guaranteed_returns", "unregistered_signal", "urgency_pressure"] },
  { lang: "hi", text: "आपका KYC खत्म हो गया है। अपना ओटीपी भेजें वरना खाता बंद हो जाएगा।", must: ["credential_request"] },
  { lang: "hi", text: "अंदर की खबर: कल यह शेयर उछलेगा। किसी को न बताना। ऑपरेटर तैयार है।", must: ["insider_claim", "pump_pattern"] },
  { lang: "hinglish", text: "Is share me paisa double ho jayega, pakka munafa, aaj hi group join karo", must: ["guaranteed_returns", "urgency_pressure"] },
  { lang: "hinglish", text: "Indha stock vaanga, maatham 10% guaranteed profit, innaiku mattum udane pay pannunga", must: ["guaranteed_returns", "urgency_pressure", "unregistered_signal"] },
  { lang: "hinglish", text: "Sir OTP batao jaldi karo warna account block ho jayega", must: ["credential_request"] },
  { lang: "tanglish", text: "Maatham 10% urudhi aana laabam, indha stock vaanga, udane", must: ["guaranteed_returns", "urgency_pressure"] },
];

describe("vernacular scams are caught", () => {
  for (const s of scams) {
    it(`${s.lang}: ${s.text.slice(0, 40)}…`, () => {
      const got = types(s.text);
      expect(got, JSON.stringify(got)).toEqual(expect.arrayContaining(s.must));
    });
    it(`${s.lang}: rated at least medium: ${s.text.slice(0, 30)}…`, () => {
      expect(["medium", "high"]).toContain(overall(s.text));
    });
  }
  it("the Tamil tip from the review is rated HIGH, not LOW", () => {
    expect(overall("இந்த பங்கை வாங்குங்கள், மாதம் 10% உத்தரவாத லாபம், இன்றே பணம் போடுங்கள்")).toBe("high");
  });
});

describe("vernacular warnings and education are NOT flagged", () => {
  const clean = [
    "முதலீட்டில் உத்தரவாதம் இல்லை. எச்சரிக்கை: யாரிடமும் OTP பகிர வேண்டாம்.",
    "SIP என்பது ஒவ்வொரு மாதமும் ஒரு குறிப்பிட்ட தொகையை முதலீடு செய்யும் முறை. மதிப்பு ஏறி இறங்கும்.",
    "அவசர நிதி என்பது திடீர்த் தேவைகளுக்காக ஒதுக்கிய பணம்.",
    "सावधान रहें: कोई भी असली बैंक आपसे ओटीपी साझा करने को नहीं कहता। ओटीपी किसी को न बताएं।",
    "निवेश में कोई गारंटी नहीं होती। जोखिम समझकर ही निवेश करें और पंजीकृत सलाहकार से सलाह लें।",
    "आपातकालीन निधि अचानक ज़रूरतों के लिए अलग रखा गया पैसा है। जल्दी शुरू करना अच्छा रहता है।",
    "Kisi ko OTP mat batana, bank kabhi nahi maangta. Savdhaan rahein.",
  ];
  for (const t of clean) it(`clean: ${t.slice(0, 40)}…`, () => expect(detectFlags(t), JSON.stringify(detectFlags(t))).toEqual([]));
});

describe("vernacular digits and rates", () => {
  it("folds Tamil, Devanagari and full-width digits one-to-one", () => {
    expect(foldDigits("௧௦% १०% １０%")).toBe("10% 10% 10%");
    const t = "மாதம் ௧௦% உறுதியான வருமானம்";
    expect(foldDigits(t).length).toBe(t.length);
  });
  it("reads a monthly rate written in Tamil, Hindi or romanised Tamil", () => {
    expect(monthlyRateIn("மாதம் ௧௦% உத்தரவாத லாபம்")).toBe(10);
    expect(monthlyRateIn("हर महीने १०% मुनाफा")).toBe(10);
    expect(monthlyRateIn("maatham 3% laabam")).toBe(3);
    expect(monthlyRateIn("guaranteed 3% every month")).toBe(3);
    expect(monthlyRateIn("no rate here")).toBeNull();
  });
  it("quotes stay verbatim substrings even with Tamil digits", () => {
    const text = "எங்கள் டெலிகிராம் குழுவில் சேருங்கள். மாதம் ௧௦% உறுதியான வருமானம். சில இடங்கள் மட்டுமே.";
    for (const f of detectFlags(text)) expect(text).toContain(f.quote);
  });
  it("end to end: the Tamil message gets an explanation in Tamil with the engine's yearly figure", async () => {
    const out = await runTask({ task: "secondOpinion", language: "ta", text: "மாதம் 10% உத்தரவாத லாபம், இன்றே பணம் போடுங்கள்" });
    const d = out.data as { overall: string; flags: { type: string; explanation: string }[] };
    expect(d.overall).toBe("high");
    expect(JSON.stringify(d)).toContain("213.8%"); // (1.10^12 - 1) x 100, computed by the engine
    expect(out.events).toEqual([]);
  });
});
