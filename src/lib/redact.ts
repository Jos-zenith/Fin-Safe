// Client-side redaction for Second Opinion text and for "Report a missed scam". It removes, in this order:
// query strings of links (they often carry IDs), email addresses, UPI handles, PAN numbers, Aadhaar-shaped and
// other long numbers (including phone and account numbers) and, as a best effort, personal names that follow
// a greeting or "my name is".
//
// Names CANNOT be removed reliably: this only catches the common greeting patterns, which is why the page also
// asks people not to paste personal details. Numbers written in Devanagari, Tamil or full-width digits are
// caught too, and invisible characters inserted between digits do not defeat it.
import { foldDigits, stripInvisible } from "./scam/normalize";

export interface RedactionReport {
  text: string;
  counts: Record<"query" | "email" | "upi" | "pan" | "number" | "name" | "code" | "ifsc", number>;
}

// A UPI handle that looks like a person (ravi.k87@bank, 9876543210@bank) rather than a shop or biller QR.
// A labelled heuristic: the detector treats a payment to a personal-looking handle as a stronger warning sign.
export function looksPersonalHandle(local: string): boolean {
  const l = local.toLowerCase();
  if (/qr|merchant|bharatpe|biz|store|shop|enterprise|traders|services/.test(l)) return false;
  if (/^\d{10}$/.test(l)) return true;
  return /^[a-z]+(?:[._-][a-z]+)?\d{0,4}$/.test(l) || /^[a-z]+[._-]?[a-z]*\d{1,4}$/.test(l);
}

const NOT_A_NAME = new Set(
  [
    "customer", "sir", "madam", "sirji", "investor", "user", "client", "member", "friend", "all", "team", "valued", "everyone", "mam", "bhai", "dost",
    "rs", "inr", "sebi", "rbi", "nse", "bse", "upi", "otp", "pan", "kyc", "ipo", "sip", "emi", "telegram", "whatsapp", "instagram", "google", "amazon", "paytm",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december", "the", "this", "that", "here", "there", "today", "tomorrow", "sorry", "thanks", "thank", "please",
  ].map((s) => s.toLowerCase()),
);

/**
 * Runs `re` over a digit-folded copy of `text` (Hindi, Tamil and full-width digits become ASCII ONE FOR ONE, so offsets are
 * the same) and splices each replacement into the ORIGINAL text, so everything outside a match keeps its own digits.
 */
function replaceOnFolded(text: string, re: RegExp, fn: (m: RegExpMatchArray) => string): string {
  const folded = foldDigits(text);
  let out = "";
  let last = 0;
  for (const m of folded.matchAll(re)) {
    const at = m.index ?? 0;
    out += text.slice(last, at) + fn(m);
    last = at + m[0].length;
  }
  return out + text.slice(last);
}

export function redactWithCounts(input: string): RedactionReport {
  const counts: RedactionReport["counts"] = { query: 0, email: 0, upi: 0, pan: 0, number: 0, name: 0, code: 0, ifsc: 0 };
  let t = stripInvisible(input);

  // IPv4 addresses inside links are not personal data and are a useful warning sign, so set them aside.
  const ips: string[] = [];
  t = t.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, (m) => `\u0001${ips.push(m) - 1}\u0001`);

  // link query strings and fragments often carry IDs
  t = t.replace(/(\b(?:https?:\/\/|www\.)[^\s?#<>"']+)[?#][^\s<>"']*/gi, (_m, base: string) => {
    counts.query++;
    return `${base}?[query]`;
  });

  // a link without a scheme ("pay.example.in/go?id=123")
  t = t.replace(/(?<![\w@/.])((?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s?#<>"']*)[?#][^\s<>"']*/gi, (_m, base: string) => {
    counts.query++;
    return `${base}?[query]`;
  });

  // a one-time code or PIN that was typed into the message: "OTP is 482913", "PIN: 4821", "CVV 123"
  t = replaceOnFolded(t, /\b(otp|pin|cvv|cvc|passcode|password|one[- ]time (?:password|code)|verification code|security code)(\s*(?:is|was|:|-|=|code|number|no\.?)*\s*)(\d{3,8})\b/gi, (m) => {
    counts.code++;
    return `${m[1]}${m[2]}[code]`;
  });

  t = t.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, () => {
    counts.email++;
    return "[email]";
  });
  t = t.replace(/(?<![\w.])([\w.-]{2,})@([A-Za-z][\w-]{1,})\b/g, (_m, local: string) => {
    counts.upi++;
    return looksPersonalHandle(local) ? "[upi-id:personal]" : "[upi-id]";
  });
  // an IFSC code: four letters, a zero, six letters or digits (HDFC0001234)
  t = t.replace(/\b[A-Za-z]{4}0[A-Za-z0-9]{6}\b/g, (m) => {
    if (m !== m.toUpperCase() && m !== m.toLowerCase()) return m;
    counts.ifsc++;
    return "[ifsc]";
  });
  // a SHORT account number is still an account number when it says so: "A/c 123456", "account no. 12345678"
  t = replaceOnFolded(t, /\b(a\/c|acct?|account)(\s*(?:no|number|num|#|:|-)*\.?\s*)(\d{5,})\b/gi, (m) => {
    counts.number++;
    return `${m[1]}${m[2]}[number]`;
  });
  t = t.replace(/\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g, (m) => {
    if (m !== m.toUpperCase() && m !== m.toLowerCase()) return m;
    counts.pan++;
    return "[pan]";
  });

  // numbers: match on a digit-folded copy (same length), so Hindi and Tamil digits are seen too
  const folded = foldDigits(t);
  let out = "";
  let last = 0;
  for (const m of folded.matchAll(/\+?\d[\d\s().-]{6,}\d|\d{8,}/g)) {
    const digits = m[0].replace(/\D/g, "").length;
    if (digits < 8) continue;
    const at = m.index ?? 0;
    out += t.slice(last, at) + "[number]";
    last = at + m[0].length;
    counts.number++;
  }
  t = out + t.slice(last);

  // names: only after a greeting or an introduction
  const nameAfter = (re: RegExp) => {
    t = t.replace(re, (m, pre: string, name: string) => {
      const first = name.split(/\s+/)[0].toLowerCase();
      if (NOT_A_NAME.has(first)) return m;
      counts.name++;
      return `${pre}[name]`;
    });
  };
  nameAfter(/\b((?:[Dd]ear|[Hh]i|[Hh]ello|[Hh]ey|Namaste|Namaskaram|Vanakkam|Mr\.?|Mrs\.?|Ms\.?|Shri|Smt|Dr\.?)\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g);
  nameAfter(/\b((?:[Mm]y name is|[Ii] am|[Ii]'m|[Tt]his is|[Nn]ame\s*:)\s+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/g);
  nameAfter(/((?:मेरा\s*नाम|नाम)\s+)([ऀ-ॿ]+)/g);
  nameAfter(/((?:என்\s*பெயர்|பெயர்)\s+)([஀-௿]+)/g);

  t = t.replace(/\u0001(\d+)\u0001/g, (_m, i: string) => ips[Number(i)]);
  return { text: t, counts };
}

export function redact(text: string): string {
  return redactWithCounts(text).text;
}
