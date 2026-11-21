import type { Lang, Unit } from "@/types";

/** 1234567 -> "12,34,567" (Indian digit grouping). */
export function groupIndian(n: number): string {
  const neg = n < 0;
  const s = Math.round(Math.abs(n)).toString();
  let out: string;
  if (s.length <= 3) out = s;
  else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    out = `${rest},${last3}`;
  }
  return neg ? `-${out}` : out;
}

/** The unit words for amountInWords, taken from the dictionary so each language owns its own. */
export interface AmountUnits {
  rupee: string;
  rupees: string;
  thousand: string;
  lakh: string;
  crore: string;
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const under100 = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
const under1000 = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} hundred` : "", under100(n % 100)].filter(Boolean).join(" ");

/**
 * An amount in words, in Indian units, so a stray extra zero is easy to see:
 * 55000 -> "Fifty-five thousand rupees", 125000 -> "One lakh twenty-five thousand rupees".
 * English is spelled out. Hindi and Tamil keep the digits and add the unit word ("55 हज़ार रुपये"), which avoids
 * hand-written number words that nobody has reviewed. Returns "" for zero.
 */
export function amountInWords(n: number, lang: Lang, u: AmountUnits): string {
  const v = Math.round(Math.abs(n));
  if (!Number.isFinite(v) || v === 0) return "";
  const parts: [number, string][] = [
    [Math.floor(v / 1e7), u.crore],
    [Math.floor((v % 1e7) / 1e5), u.lakh],
    [Math.floor((v % 1e5) / 1e3), u.thousand],
    [v % 1e3, ""],
  ];
  const say = lang === "en" ? under1000 : String;
  const text = parts
    .filter(([q]) => q > 0)
    .map(([q, unit]) => [say(q), unit].filter(Boolean).join(" "))
    .join(" ");
  const out = `${text} ${v === 1 ? u.rupee : u.rupees}`;
  return lang === "en" ? out[0].toUpperCase() + out.slice(1) : out;
}

export const inr = (n: number) => `₹${groupIndian(n)}`;
/** A rupee amount with its sign in front: -₹3,000 (a plain inr() would print ₹-3,000). */
export const inrSigned = (n: number) => (n < 0 ? `-${inr(-n)}` : inr(n));

const trim1 = (n: number) => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/** Format an engine value for display. Used by the placeholder renderer AND the UI. */
export function formatValue(v: number, unit: Unit): string {
  switch (unit) {
    case "inr":
      return inr(v);
    case "months":
      return trim1(v);
    case "percent":
      return `${trim1(v)}%`;
    case "ratio":
      return `${trim1(v)}x`;
    default:
      return String(Math.round(v));
  }
}

/** Compact lakh/crore label for charts and big amounts. */
export function compactInr(n: number): string {
  if (n >= 10000000) return `₹${trim1(n / 10000000)} Cr`;
  if (n >= 100000) return `₹${trim1(n / 100000)} L`;
  return inr(n);
}
