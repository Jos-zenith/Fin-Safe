// Offline link checks. Nothing here visits a link, looks anything up or calls a service: it only reads the
// text of the address. Every reason is a labelled heuristic (a pattern that scam links often show), not proof,
// and an address that shows none of them is NOT thereby safe.
import { foldDigits, stripInvisible } from "./normalize";

export type LinkReason =
  | "shortener"
  | "ip_host"
  | "punycode"
  | "non_ascii_host"
  | "userinfo"
  | "apk_file"
  | "lookalike"
  | "odd_tld_strong"
  | "odd_tld_weak"
  | "not_https"
  | "lure_word_in_host"
  | "many_hyphens"
  | "many_subdomains";

export const LINK_REASON_WEIGHT: Record<LinkReason, number> = {
  ip_host: 3,
  punycode: 3,
  non_ascii_host: 3,
  userinfo: 3,
  apk_file: 3,
  lookalike: 3,
  shortener: 2,
  odd_tld_strong: 2,
  odd_tld_weak: 1,
  not_https: 1,
  lure_word_in_host: 1,
  many_hyphens: 1,
  many_subdomains: 1,
};

/** Plain-language label for each reason. Heuristics, not verdicts. */
export const LINK_REASON_TEXT: Record<LinkReason, { en: string; hi: string; ta: string }> = {
  shortener: {
    en: "A shortened link hides the real address.",
    hi: "छोटा किया गया लिंक असली पता छिपा देता है।",
    ta: "சுருக்கப்பட்ட இணைப்பு உண்மையான முகவரியை மறைக்கும்.",
  },
  ip_host: {
    en: "The address is a string of numbers, not a name. Real companies rarely use that.",
    hi: "पता नाम की जगह अंकों की कड़ी है। असली कंपनियाँ शायद ही ऐसा करती हैं।",
    ta: "முகவரி பெயராக இல்லாமல் எண் வரிசையாக உள்ளது. உண்மையான நிறுவனங்கள் இதை அரிதாகவே பயன்படுத்தும்.",
  },
  punycode: {
    en: "The address uses a disguised, look-alike spelling.",
    hi: "पता भेष बदला हुआ, मिलते-जुलते अक्षरों वाला है।",
    ta: "முகவரி மாறுவேடமிட்ட, ஒத்த எழுத்துகளைப் பயன்படுத்துகிறது.",
  },
  non_ascii_host: {
    en: "The address mixes in unusual letters that can imitate a real name.",
    hi: "पते में असामान्य अक्षर हैं जो असली नाम की नकल कर सकते हैं।",
    ta: "முகவரியில் உண்மையான பெயரைப் போலக் காட்டக்கூடிய அசாதாரண எழுத்துகள் உள்ளன.",
  },
  userinfo: {
    en: "Text before an @ sign in the address can hide where the link really goes.",
    hi: "पते में @ से पहले का हिस्सा असली गंतव्य छिपा सकता है।",
    ta: "முகவரியில் @ க்கு முன் உள்ள பகுதி இணைப்பு உண்மையில் எங்கே செல்கிறது என்பதை மறைக்கலாம்.",
  },
  apk_file: {
    en: "The link downloads an app file directly. Install apps only from the official app store.",
    hi: "लिंक सीधे ऐप फ़ाइल डाउनलोड कराता है। ऐप सिर्फ़ आधिकारिक ऐप स्टोर से इंस्टॉल करें।",
    ta: "இணைப்பு நேரடியாக ஒரு ஆப் கோப்பைப் பதிவிறக்குகிறது. ஆப்களை அதிகாரப்பூர்வ ஆப் ஸ்டோரிலிருந்து மட்டும் நிறுவுங்கள்.",
  },
  lookalike: {
    en: "The address looks like the name of a well-known bank or body, but is not its usual address.",
    hi: "पता किसी जाने-माने बैंक या संस्था के नाम जैसा दिखता है, पर उसका सामान्य पता नहीं है।",
    ta: "முகவரி நன்கு அறியப்பட்ட வங்கி அல்லது அமைப்பின் பெயரைப் போல உள்ளது, ஆனால் அதன் வழக்கமான முகவரி அல்ல.",
  },
  odd_tld_strong: {
    en: "The address ends in a type that scam links often use.",
    hi: "पते का अंत उस प्रकार का है जो ठगी वाले लिंक अक्सर इस्तेमाल करते हैं।",
    ta: "முகவரி மோசடி இணைப்புகள் அடிக்கடி பயன்படுத்தும் முடிவைக் கொண்டுள்ளது.",
  },
  odd_tld_weak: {
    en: "The address ends in a less common type. Many are fine, so this is a weak sign.",
    hi: "पते का अंत कम आम प्रकार का है। कई ठीक होते हैं, इसलिए यह कमज़ोर संकेत है।",
    ta: "முகவரி குறைவாகப் பயன்படுத்தப்படும் முடிவைக் கொண்டுள்ளது. பலவும் சரியானவையே, எனவே இது பலவீனமான அறிகுறி.",
  },
  not_https: {
    en: "The link does not use a secure (https) connection.",
    hi: "लिंक सुरक्षित (https) कनेक्शन का उपयोग नहीं करता।",
    ta: "இணைப்பு பாதுகாப்பான (https) இணைப்பைப் பயன்படுத்தவில்லை.",
  },
  lure_word_in_host: {
    en: "The address name contains words like kyc, verify or login.",
    hi: "पते के नाम में kyc, verify या login जैसे शब्द हैं।",
    ta: "முகவரிப் பெயரில் kyc, verify அல்லது login போன்ற சொற்கள் உள்ளன.",
  },
  many_hyphens: {
    en: "The address name is chained together with several hyphens.",
    hi: "पते का नाम कई हाइफ़न से जुड़ा हुआ है।",
    ta: "முகவரிப் பெயர் பல இணைப்புக் குறிகளால் இணைக்கப்பட்டுள்ளது.",
  },
  many_subdomains: {
    en: "The address has many parts before the main name, which can hide who owns it.",
    hi: "पते में मुख्य नाम से पहले कई हिस्से हैं, जिससे मालिक छिप सकता है।",
    ta: "முகவரியில் முக்கியப் பெயருக்கு முன் பல பகுதிகள் உள்ளன; அது உரிமையாளரை மறைக்கலாம்.",
  },
};

export interface LinkFinding {
  /** The link as it appeared in the message. */
  raw: string;
  host: string;
  reasons: LinkReason[];
  score: number;
  /** none: no heuristic matched (NOT a safety verdict). */
  level: "none" | "low" | "medium" | "high";
}

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.me", "wa.me", "goo.gl", "cutt.ly", "is.gd", "rb.gy", "t.co", "ow.ly", "shorturl.at", "tiny.cc", "buff.ly", "rebrand.ly", "bl.ink", "lnkd.in", "s.id", "v.gd", "shorturl.asia", "tr.ee",
]);
const STRONG_TLDS = new Set(["top", "xyz", "help", "click", "link", "icu", "buzz", "cyou", "sbs", "cfd", "tk", "ml", "ga", "cf", "gq", "vip", "loan", "win", "bid", "men", "support", "rest", "fun", "monster", "zip", "mov", "work", "country", "stream", "gdn"]);
const WEAK_TLDS = new Set(["live", "club", "online", "site", "shop", "store", "today", "website", "space", "life", "world", "pro", "cc", "ws", "info", "biz", "me", "app", "page"]);
const COMMON_TLDS = new Set(["com", "in", "org", "net", "co", "io", "gov", "edu", "ly", "gl", "to", "ai", "dev"]);
const LURE_IN_HOST = /(?:kyc|verif|update|login|signin|secure|refund|bonus|reward|claim|otp|helpdesk|unlock|reactivat|suspend|allotment)/;

// A small list of names scammers imitate, and the real addresses those bodies use.
// Well-known registrable domains only. This list is not exhaustive and the check never says an address "is official".
const BRANDS: Record<string, string[]> = {
  sbi: ["sbi.co.in", "onlinesbi.sbi", "sbi.bank.in"],
  hdfc: ["hdfcbank.com", "hdfcbank.net", "hdfc.com", "hdfclife.com", "hdfcsec.com"],
  icici: ["icicibank.com", "icicidirect.com", "iciciprulife.com", "icicilombard.com"],
  axis: ["axisbank.com", "axismf.com"],
  kotak: ["kotak.com", "kotaksecurities.com", "kotakmf.com"],
  paytm: ["paytm.com", "paytmmoney.com"],
  phonepe: ["phonepe.com"],
  zerodha: ["zerodha.com", "kite.trade"],
  groww: ["groww.in"],
  upstox: ["upstox.com"],
  sebi: ["sebi.gov.in"],
  nse: ["nseindia.com"],
  bse: ["bseindia.com"],
  npci: ["npci.org.in"],
  rbi: ["rbi.org.in"],
  uidai: ["uidai.gov.in"],
  irctc: ["irctc.co.in"],
  epfo: ["epfindia.gov.in"],
  amazon: ["amazon.in", "amazon.com"],
  flipkart: ["flipkart.com"],
};

/** Letters that are easy to swap for look-alikes: rn/m, vv/w, 0/o, 1/l/i, 5/s. */
const deSwap = (s: string) => s.replace(/rn/g, "m").replace(/vv/g, "w").replace(/0/g, "o").replace(/[1|]/g, "l").replace(/5/g, "s").replace(/3/g, "e");

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

/** The last two labels, or three for second-level endings such as co.in / org.in / gov.in. */
function registrable(host: string): string {
  const p = host.split(".");
  if (p.length <= 2) return host;
  const sld = p[p.length - 2];
  return ["co", "org", "gov", "net", "ac", "edu", "com"].includes(sld) && p[p.length - 1].length === 2 ? p.slice(-3).join(".") : p.slice(-2).join(".");
}

/** Pulls link-shaped text out of a message. Bare names count only when they end in a known address type. */
export function extractLinks(text: string): string[] {
  const t = foldDigits(stripInvisible(text));
  const found: string[] = [];
  // trailing punctuation is not part of the link; a closing ] stays when the link carries our "[query]" marker
  const clean = (s: string) => {
    const t = s.replace(/[.,;:!?)}>'"।]+$/u, "");
    return t.includes("[") ? t : t.replace(/\]+$/, "");
  };
  for (const m of t.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi)) found.push(clean(m[0]));
  const tldAlt = [...STRONG_TLDS, ...WEAK_TLDS, ...COMMON_TLDS].join("|");
  const bare = new RegExp(`(?<![\\w@./-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${tldAlt})(?:\\/[^\\s<>"'\`]*)?(?![\\w@-])`, "gi");
  for (const m of t.matchAll(bare)) {
    const c = clean(m[0]);
    if (!found.some((f) => f.includes(c))) found.push(c);
  }
  for (const m of t.matchAll(/(?<![\w@./-])[\w.-]+\.apk\b/gi)) if (!found.some((f) => f.includes(m[0]))) found.push(m[0]);
  return [...new Set(found)];
}

export function analyseLink(raw: string): LinkFinding {
  const reasons = new Set<LinkReason>();
  let rest = raw.trim();
  const scheme = /^(https?):\/\//i.exec(rest);
  const https = scheme?.[1].toLowerCase() === "https";
  rest = rest.replace(/^(?:https?:\/\/)/i, "");
  const authority = rest.split(/[/?#]/)[0];
  const path = rest.slice(authority.length);
  if (authority.includes("@")) reasons.add("userinfo");
  const hostPort = authority.split("@").pop() ?? authority;
  const host = hostPort.replace(/:\d+$/, "").toLowerCase();

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || /^0x[0-9a-f]+$/i.test(host) || /^\d{8,}$/.test(host)) reasons.add("ip_host");
  if (host.split(".").some((l) => l.startsWith("xn--"))) reasons.add("punycode");
  if (/[^\x00-\x7F]/.test(host)) reasons.add("non_ascii_host");
  if (SHORTENERS.has(host.replace(/^www\./, ""))) reasons.add("shortener");
  if (/\.apk(?:$|[?#])/i.test(raw)) reasons.add("apk_file");
  if (scheme && !https) reasons.add("not_https");

  const labels = host.split(".");
  const tld = labels[labels.length - 1];
  const isIp = reasons.has("ip_host");
  if (!isIp && labels.length >= 2) {
    if (STRONG_TLDS.has(tld)) reasons.add("odd_tld_strong");
    else if (WEAK_TLDS.has(tld)) reasons.add("odd_tld_weak");
  }
  if (!isIp) {
    const name = labels.slice(0, -1).join(".");
    if (LURE_IN_HOST.test(name)) reasons.add("lure_word_in_host");
    if ((host.match(/-/g) ?? []).length >= 2) reasons.add("many_hyphens");
    if (labels.length >= 5) reasons.add("many_subdomains");

    // look-alike: a label resembling a well-known name, on an address that is not that name's usual one
    const reg = registrable(host);
    const parts = host.split(/[.\-]/).filter((p) => p.length >= 3);
    for (const [brand, official] of Object.entries(BRANDS)) {
      if (official.includes(reg)) continue;
      for (const p of parts) {
        const d = deSwap(p);
        const exact = d === brand || p === brand;
        // one letter away from the name, or from "<name>bank" / "<name>online" (hdfcbamk, icicibank-like)
        const near = [brand, `${brand}bank`, `${brand}online`].some((target) => target.length >= 5 && editDistance(d, target) === 1);
        const embedded = brand.length >= 4 && p.length > brand.length && p.startsWith(brand) && /^(?:bank|kyc|pay|secure|login|online|care|support|update|verify|help)/.test(p.slice(brand.length));
        if (exact || near || embedded) reasons.add("lookalike");
      }
    }
  }
  void path;

  const list = [...reasons];
  const score = list.reduce((a, r) => a + LINK_REASON_WEIGHT[r], 0);
  const level = score >= 3 ? "high" : score === 2 ? "medium" : score === 1 ? "low" : "none";
  return { raw, host, reasons: list, score, level };
}

export function inspectLinks(text: string): LinkFinding[] {
  return extractLinks(text).map(analyseLink);
}
