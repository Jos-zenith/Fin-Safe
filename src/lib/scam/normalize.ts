// Text normalisation for the scam check. Matching runs on normalised text; quotes shown to the person always
// come from the ORIGINAL sentence, so a quote is always a verbatim substring of what they pasted.
//
// Covers the five groups the corpus measures: English, Hindi, Tamil, Hinglish (romanised Hindi), Tanglish
// (romanised Tamil). Handles: zero-width and invisible characters, Devanagari / Tamil / full-width digits,
// look-alike letters, spaced-out words ("O T P"), stretched letters ("guaranteeeed"), Devanagari nukta and
// chandrabindu variants, and the many spellings of romanised Hindi and Tamil.

// 1:1 digit folding, so Tamil "௧௦%" and Hindi "१०%" are seen as "10%" without changing any offset.
const DIGIT_SETS = ["०१२३४५६७८९", "௦௧௨௩௪௫௬௭௮௯", "０１２３４５６７８９", "٠١٢٣٤٥٦٧٨٩"];
export function foldDigits(s: string): string {
  let out = "";
  for (const ch of s) {
    let r = ch;
    for (const set of DIGIT_SETS) {
      const d = set.indexOf(ch);
      if (d >= 0) {
        r = String(d);
        break;
      }
    }
    out += r;
  }
  return out;
}

/** Zero-width joiners and spaces, soft hyphens, BOM, bidi marks. They are invisible, so a scammer can put them anywhere. */
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿­͏᠎]/g;
export const stripInvisible = (s: string) => s.replace(INVISIBLE, "");

// Cyrillic and Greek letters that look like Latin ones.
const HOMOGLYPHS: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", у: "y", і: "i", ј: "j", ѕ: "s", ԁ: "d", ԛ: "q", һ: "h", ӏ: "l",
  α: "a", ο: "o", ρ: "p", ν: "v", τ: "t", ι: "i", κ: "k", ε: "e", β: "b", υ: "u", χ: "x", γ: "y", η: "n", μ: "u",
};
const foldHomoglyphs = (s: string) => s.replace(/[а-яёіјѕԁԛһӏα-ω]/giu, (c) => HOMOGLYPHS[c.toLowerCase()] ?? c);

/** Devanagari: drop the nukta dot and unify chandrabindu with anusvara, so spelling variants match. */
export function foldIndic(s: string): string {
  return s
    .normalize("NFD")
    .replace(/़/g, "")
    .replace(/ँ/g, "ं")
    .normalize("NFC");
}

/** "o t p", "o.t.p", "p-i-n" -> "otp", "pin" (three or more single letters). */
const SPACED_LETTERS = /(?<![\p{L}\p{N}])(?:\p{Script=Latin}[\s.\-_*]){2,}\p{Script=Latin}(?![\p{L}\p{N}])/gu;
const unspace = (s: string) => s.replace(SPACED_LETTERS, (m) => m.replace(/[\s.\-_*]/g, ""));

/** "guaranteeeed" -> "guaranteed" (3+ of the same letter become 2). */
const unstretch = (s: string) => s.replace(/(\p{Script=Latin})\1{2,}/gu, "$1$1");

/** "g4ranteed", "0tp" -> letters. Only inside a token that already has two or more letters. */
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };
function unleet(s: string): string {
  return s.replace(/[\p{L}\p{N}@$]+/gu, (tok) => {
    if (!/\p{Script=Latin}/u.test(tok)) return tok;
    const letters = (tok.match(/\p{Script=Latin}/gu) ?? []).length;
    if (letters < 2 || /^\d+[a-z]{1,2}$/i.test(tok) || /^[a-z]+\d+$/i.test(tok) && letters > 3) return tok;
    return tok.replace(/[013457@$]/g, (c) => LEET[c]);
  });
}

/**
 * Normalised text used for matching English, Hindi and Tamil patterns. Lowercase, invisible characters gone,
 * digits ASCII, look-alikes folded, spaced and stretched letters repaired.
 */
export function normalizeText(s: string): string {
  const t = foldHomoglyphs(foldIndic(foldDigits(stripInvisible(s)))).normalize("NFKC").toLowerCase();
  return unstretch(unleet(unspace(t)));
}

/**
 * Further folding for romanised Hindi and Tamil, where spelling is unregulated:
 * "laabam / labam", "urudhi / uruthi", "paisa / paise", "waapas / vapas", "pakka / pakki".
 * Patterns are folded with the SAME function, so write romanised patterns in any spelling.
 */
export function romanFold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{Script=Latin}\p{N}\s%]/gu, (c) => (/\p{L}/u.test(c) ? c : " "))
    .replace(/(?:th|dh)/g, "t")
    .replace(/(?:bh|b)/g, "p")
    .replace(/(?:gh|g)/g, "k")
    .replace(/kh/g, "k")
    .replace(/d/g, "t")
    .replace(/sh/g, "s")
    .replace(/ph/g, "f")
    .replace(/[zj]/g, "j")
    .replace(/[wv]/g, "v")
    .replace(/(?:aa|ah?\b)/g, "a")
    .replace(/(?:ee|ii|ie|ey?\b)/g, "i")
    .replace(/(?:oo|uu|ou)/g, "u")
    .replace(/([a-z])\1+/g, "$1");
}

/** Builds a case-insensitive Unicode pattern; Devanagari variants in the pattern are folded like the text. */
export const R = (source: string, flags = "iu") => new RegExp(foldIndic(source), flags);
/** Same, for a romanised pattern: the pattern source is folded with {@link romanFold}. Word boundaries stay as written. */
export function RR(words: string[], flags = "iu"): RegExp {
  const alt = words.map((w) => romanFold(w).replace(/\s+/g, "\\s+")).join("|");
  return new RegExp(`(?<![a-z])(?:${alt})(?![a-z])`, flags);
}
