// Wording rules for the scam check. The check never calls a message safe. The only place the word may appear
// is inside the exact low-risk disclaimer below, where it is negated ("not a guarantee that ... is safe").
import type { Lang } from "@/types";

/** The summary of the third outcome ("No known indicators found"). Every language says: nothing known was found, and that does not mean the message is safe. */
export const LOW_RISK_SUMMARY: Record<Lang, string> = {
  en: "No known warning signs were found in this check. That does not mean the message is safe.",
  hi: "इस जांच में कोई ज्ञात चेतावनी संकेत नहीं मिला। इसका मतलब यह नहीं कि संदेश सुरक्षित है।",
  ta: "இந்தச் சோதனையில் அறியப்பட்ட எச்சரிக்கை அறிகுறிகள் எதுவும் கண்டறியப்படவில்லை. அதற்கு அந்தச் செய்தி பாதுகாப்பானது என்று பொருளல்ல.",
};

// A verdict is a safe/genuine word that is PREDICATED of the message ("looks safe", "is legitimate"), or a
// "not a scam" / "risk-free" claim. The word alone is not enough: "Genuine investments are bought through
// regulated platforms" describes investments in general and is allowed.
const VERDICT_WORDS: RegExp[] = [
  /\b(?:is|are|was|were|be|looks?|seems?|appears?|sounds?|considered|found to be)\s+(?:\w+\s+){0,2}?(?:safe|secure|legit|legitimate|genuine|trustworthy|reliable|authentic)\b/i,
  /\b(?:not a scam|isn'?t a scam|is not a scam|no risk|risk[- ]free|safe to (?:invest|pay|click|proceed|trust))\b/i,
  /(?:सुरक्षित|भरोसेमंद|वैध|जायज़|जायज)\s*(?:है|हैं|लगता|लगती|लग\s*रहा|दिखता|दिखती)/u,
  /பாதுகாப்பானது|பாதுகாப்பானவை|நம்பகமானது|நம்பகமானவை|உண்மையானது/u,
];

/** True if the text says a message is safe, genuine or trustworthy. The exact low-risk disclaimers are allowed. */
export function claimsSafe(text: string): boolean {
  let t = text;
  for (const d of Object.values(LOW_RISK_SUMMARY)) t = t.split(d).join(" ");
  return VERDICT_WORDS.some((r) => r.test(t));
}
