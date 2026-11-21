// The numeric contract: the model NEVER writes literal numbers. It writes {{placeholders}};
// the server substitutes engine values. This validator runs BEFORE and AFTER substitution.
import { formatValue } from "@/lib/format";
import type { Unit } from "@/types";
import { NUMERIC_ALLOWLIST, type AllowEntry } from "./numericAllowlist";

export interface Ground {
  flat: Record<string, number>;
  units: Record<string, Unit>;
}
export interface NumericResult {
  ok: boolean;
  violations: string[];
}

const DEVANAGARI = "०१२३४५६७८९";
const TAMIL = "௦௧௨௩௪௫௬௭௮௯";
const FULLWIDTH_MAP: Record<string, string> = { "，": ",", "．": ".", "％": "%", "＋": "+" };

/** Devanagari, Tamil and full-width digits -> ASCII. */
export function normalizeDigits(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const d = DEVANAGARI.indexOf(ch);
    if (d >= 0) {
      out += String(d);
      continue;
    }
    const t = TAMIL.indexOf(ch);
    if (t >= 0) {
      out += String(t);
      continue;
    }
    const cp = ch.codePointAt(0)!;
    if (cp >= 0xff10 && cp <= 0xff19) {
      out += String(cp - 0xff10);
      continue;
    }
    out += FULLWIDTH_MAP[ch] ?? ch;
  }
  return out;
}

export const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.@-]+)\s*\}\}/g;
// Integers, decimals, lakh/crore grouped (1,20,000), and the digits inside ₹ / % / x / ranges / ratios.
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

const EN_WORDS = new Set(
  (
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen " +
    "twenty thirty forty fifty sixty seventy eighty ninety hundred hundreds thousand thousands lakh lakhs crore crores million millions billion"
  ).split(" "),
);
const HI_WORDS = new Set(
  (
    "शून्य तीन चार पाँच पांच छह छः छ सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह पन्द्रह सोलह सत्रह अठारह उन्नीस बीस तीस चालीस पचास साठ सत्तर अस्सी नब्बे " +
    "सौ हज़ार हजार लाख करोड़ करोड मिलियन"
  ).split(" "),
);
const TA_WORDS = new Set(
  (
    "பூஜ்ஜியம் ஒன்று இரண்டு மூன்று நான்கு ஐந்து ஆறு ஏழு எட்டு ஒன்பது பத்து பதினொன்று பன்னிரண்டு இருபது முப்பது நாற்பது ஐம்பது அறுபது எழுபது எண்பது தொண்ணூறு " +
    "நூறு ஆயிரம் லட்சம் கோடி மில்லியன் ௰ ௱ ௲"
  ).split(" "),
);
// Inflected Tamil forms: match on these stems.
const TA_STEMS = ["ஆயிர", "லட்ச", "இரண்ட", "நான்க", "ஒன்பத", "பன்னிர", "ஆயிரத்"];

// Hindi "एक" (a / one) and "दो" (two / give) are everyday words. They count as a quantity only when
// they sit right before a unit: "एक प्रतिशत", "दो साल". Magnitude words (लाख, हज़ार, सौ) are always flagged.
const HI_AMBIGUOUS = new Set(["एक", "दो"]);
const HI_UNITS = new Set([
  "प्रतिशत", "फीसदी", "फ़ीसदी", "महीने", "महीना", "महीनों", "साल", "सालों", "वर्ष", "रुपये", "रुपया", "रुपए", "गुना", "गुणा", "दिन", "हफ्ते", "हफ़्ते", "सप्ताह",
]);

export function findNumberWords(text: string): string[] {
  const out: string[] = [];
  const tokens = text.normalize("NFC").split(/[^\p{L}\p{M}]+/u).filter(Boolean);
  tokens.forEach((tok, i) => {
    const lower = tok.toLowerCase();
    if (HI_AMBIGUOUS.has(tok)) {
      if (HI_UNITS.has(tokens[i + 1] ?? "")) out.push(tok);
      return;
    }
    if (EN_WORDS.has(lower) || HI_WORDS.has(tok) || TA_WORDS.has(tok) || TA_STEMS.some((s) => tok.startsWith(s))) out.push(tok);
  });
  return out;
}

// Whole-phrase match only, so "one of" inside another word can never hide a number.
function stripAllowlisted(text: string, allow: AllowEntry[]): string {
  let t = text;
  for (const a of allow) {
    const esc = a.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, "giu"), " ");
  }
  return t;
}

export function extractNumericTokens(text: string): { raw: string; value: number }[] {
  const t = normalizeDigits(text);
  return [...t.matchAll(NUMBER)].map((m) => {
    const raw = m[0].replace(/,+$/, "");
    return { raw, value: parseFloat(raw.replace(/,/g, "")) };
  });
}

/**
 * A printed number may differ from the engine value by half of what the display rounds to. formatValue shows months,
 * percent and ratio to one decimal, and everything else (rupees, counts, years, scores) as a whole number. So a
 * WHOLE-number token may be off by up to 0.5 from a value shown as a whole number (a rupee amount of 52.4 prints as
 * "52"); a token with a decimal point can only be a one-decimal value and must match to 0.05.
 */
const DECIMAL_UNITS: ReadonlySet<Unit> = new Set<Unit>(["months", "percent", "ratio"]);

function matchesGround(v: number, raw: string, ground: Ground): boolean {
  const whole = !/\.\d/.test(raw);
  return Object.entries(ground.flat).some(([k, g]) => {
    const half = whole && !DECIMAL_UNITS.has(ground.units[k] ?? "count") ? 0.5 : 0.05;
    return Math.abs(g - v) <= Math.max(half + 0.001, Math.abs(g) * 0.001);
  });
}

/**
 * phase "pre": text still holds {{placeholders}}; any literal number or number word fails.
 * phase "post": placeholders were substituted; every number must equal an engine value.
 */
export function validateNumericIntegrity(
  text: string,
  engine: Ground,
  allowlist: AllowEntry[] = NUMERIC_ALLOWLIST,
  phase: "pre" | "post" = "pre",
): NumericResult {
  const violations: string[] = [];
  let t = normalizeDigits(text);

  if (phase === "pre") {
    t = t.replace(PLACEHOLDER, (_m, key: string) => {
      if (!(key in engine.flat)) violations.push(`unknown_placeholder:${key}`);
      return " ";
    });
  } else if (/\{\{|\}\}/.test(t)) {
    violations.push("unresolved_placeholder");
  }

  t = stripAllowlisted(t, allowlist);

  for (const m of t.matchAll(NUMBER)) {
    const raw = m[0].replace(/,+$/, "");
    const v = parseFloat(raw.replace(/,/g, ""));
    if (phase === "pre" || !matchesGround(v, raw, engine)) violations.push(`number:${raw}`);
  }
  for (const w of findNumberWords(t)) violations.push(`word:${w}`);
  return { ok: violations.length === 0, violations };
}

/** Server-side renderer: substitutes {{key}} with engine values formatted per unit. */
export function renderTemplate(text: string, engine: Ground): { text: string; missing: string[] } {
  const missing: string[] = [];
  const out = text.replace(PLACEHOLDER, (_m, key: string) => {
    if (!(key in engine.flat)) {
      missing.push(key);
      return `{{${key}}}`;
    }
    return formatValue(engine.flat[key], engine.units[key] ?? "count");
  });
  return { text: out, missing };
}
