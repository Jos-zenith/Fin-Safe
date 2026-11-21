// Guardrail layer: runs on EVERY AI output before display.
// Blocks specific-security directives, instrument-level picks, price targets, guaranteed-return
// language, return projections and unqualified superlatives (EN / HI / TA).
//
// Design rule: a word alone never blocks. Insurance vocabulary ("sum assured"), finance terms
// ("risk-free rate"), a goal sentence ("your goal is to reach ₹50,00,000") and the user's own bank
// ("your HDFC home loan") are legitimate planning text. Blocking needs a promise, a price call,
// a directive, or a named instrument paired with an instrument word, action or verdict.
// Every row that once misfired lives in tests/corpus.test.ts.
import type { Lang } from "@/types";

export type GuardrailCategory = "security_directive" | "instrument_pick" | "price_target" | "guaranteed_return" | "superlative";
export interface GuardrailHit {
  category: GuardrailCategory;
  match: string;
}
export type GuardrailMode = "personal" | "education";

export const SAFE_SENTENCE: Record<Lang, string> = {
  en: "This part was removed because it could read like a specific recommendation. A reviewer can discuss goal-based options with you in this demo.",
  hi: "यह हिस्सा हटाया गया क्योंकि यह किसी विशेष सिफ़ारिश जैसा लग सकता है। इस डेमो में रिव्यूअर लक्ष्य-आधारित विकल्पों पर आपसे बात कर सकता है।",
  ta: "இந்தப் பகுதி குறிப்பிட்ட பரிந்துரை போலத் தோன்றலாம் என்பதால் நீக்கப்பட்டது. இந்த டெமோவில் மதிப்பாய்வாளர் இலக்கு-சார்ந்த வழிகளைப் பற்றி உங்களுடன் பேசலாம்.",
};

export const REFUSAL_SENTENCE: Record<Lang, string> = {
  en: "I can't suggest specific stocks, funds or promised returns. I can help with goal-based planning options, and a reviewer can talk them through with you in this demo.",
  hi: "मैं किसी विशेष शेयर, फंड या वादा किए गए रिटर्न का सुझाव नहीं दे सकता। मैं लक्ष्य-आधारित योजना विकल्पों में मदद कर सकता हूँ, और इस डेमो में रिव्यूअर आपके साथ उन पर बात कर सकता है।",
  ta: "குறிப்பிட்ட பங்குகள், ஃபண்டுகள் அல்லது உறுதியளிக்கப்பட்ட வருமானத்தை என்னால் பரிந்துரைக்க முடியாது. இலக்கு-சார்ந்த திட்ட வழிகளில் உதவ முடியும்; இந்த டெமோவில் மதிப்பாய்வாளர் அவற்றை உங்களுடன் பேசலாம்.",
};

// ---------- Named instruments ----------
// Ambiguous words (TCS = tax collected at source, Reliance = dependence, ITC = input tax credit,
// axis) are handled separately or left out, so ordinary tax and planning words are not blocked.
const CRYPTO = "bitcoin|btc|ethereum|dogecoin|solana|shiba(?: inu)?";
const COMPANY =
  "infosys|wipro|zomato|paytm|adani|hdfc|icici|sbi|kotak|mirae|nippon|parag parikh|axis (?:bluechip|mutual|small ?cap|mid ?cap|long term)|tata (?:motors|steel|power|consultancy|capital|mutual)|reliance industries|jio financial|bajaj finance|maruti|ongc";
const AMBIGUOUS = "tcs|reliance"; // only counted with an instrument word, action or verdict
const NAMES_LOCAL = "बिटकॉइन|रिलायंस इंडस्ट्रीज|इंफोसिस|पेटीएम|பிட்காயின்|ரிலையன்ஸ் இண்டஸ்ட்ரீஸ்|இன்ஃபோசிஸ்|பேடிஎம்";

const INSTR =
  "mutual funds?|funds?|schemes?|shares?|stocks?|etfs?|bluechip|blue chip|index funds?|flexi ?cap|large ?cap|mid ?cap|small ?cap|ipo|ltd|limited|equity funds?|nifty";
const ACTION = "buy|sell|hold|invest(?:ing)? in|invest|move|put|switch(?: to)?|shift(?: to)?|add|bet on|allocate|park|exit|accumulate";
const VERDICT =
  "attractive|undervalued|overvalued|looks? (?:good|great|strong|promising|cheap)|strong (?:buy|sell)|good (?:buy|bet|pick|stock)|great (?:buy|pick)|upside|outperform\\w*|multibagger|rally|will (?:rise|go up|go down|fall|rally|double)|going (?:up|down)|safe bet|top pick|worth (?:buying|investing)|scam";

const ANY_COMPANY = `(?:${COMPANY}|${AMBIGUOUS}|${CRYPTO})`;
const COMPANY_RX = new RegExp(`\\b(?:${COMPANY})\\b`, "i");
const CRYPTO_RX = new RegExp(`\\b(?:${CRYPTO})\\b|${NAMES_LOCAL}`, "iu");
const TCS_RX = /\bTCS\b/; // uppercase only: lowercase/tax use is not a stock
const RELIANCE_RX = /\bReliance(?!\s+(?:on|upon|in)\b)/; // "reliance on tips" is the English word
const INSTR_AFTER = new RegExp(`\\b${ANY_COMPANY}\\b(?:\\W+\\w+){0,3}?\\W+(?:${INSTR})\\b`, "i");
const ACTION_BEFORE = new RegExp(`\\b(?:${ACTION})\\b[^.!?\\n]{0,35}?\\b${ANY_COMPANY}\\b`, "i");
const VERDICT_RX = new RegExp(`\\b(?:${VERDICT})\\b`, "i");

/** Instrument names are only excused in education text when nothing recommends or judges them. */
const RECOMMENDS =
  /\b(?:you should|should you|i recommend|we recommend|recommended|top pick|worth (?:buying|investing)|invest in|put (?:your )?money in|safe bet|good (?:buy|stock|fund|choice)|great (?:buy|stock|fund)|scam)\b/i;

function namedInstrument(sentence: string): RegExpExecArray | null {
  return CRYPTO_RX.exec(sentence) ?? COMPANY_RX.exec(sentence) ?? TCS_RX.exec(sentence) ?? RELIANCE_RX.exec(sentence);
}

// A branded fund by category ("Quant Small Cap Fund") is not in the company deny-list. Generic wording ("a small cap fund") and
// sentence openers ("Your small cap fund") do not match. The plan schema still has no instrument field; this is a second layer.
const NAMED_CAP_FUND = /\b(?!(?:Small|Mid|Large|Flexi|Multi|Your|The|Any|An?|This|That|Our|Each|Every|Some|Consider|Choose|Compare)\b)[A-Z][A-Za-z&]{2,}\s+(?:Small|Mid|Large|Flexi|Multi)[- ]?Cap\s+(?:Fund|Index)\b/;

function instrumentPick(text: string, mode: GuardrailMode): string | null {
  for (const sentence of text.split(/(?<=[.!?।])\s+|\n+/)) {
    const m = namedInstrument(sentence);
    if (!m) continue;
    const isCrypto = CRYPTO_RX.test(sentence);
    const judged = VERDICT_RX.test(sentence) || ACTION_BEFORE.test(sentence) || RECOMMENDS.test(sentence);
    if (mode === "personal") {
      // a named bank or company next to a loan, policy or account is fine; next to an instrument word it is not
      if (isCrypto || judged || INSTR_AFTER.test(sentence)) return m[0];
    } else if (judged) {
      return m[0];
    }
  }
  return null;
}

const VERB_EN = "buy|sell|hold|accumulate|exit|short";
const NOUN_EN = "stocks?|shares?|scrips?|etfs?|funds?|schemes?|tokens?|coins?|crypto";

const RX = {
  directiveEn: [
    new RegExp(`\\b(?:${VERB_EN})\\b[^.!?\\n]{0,30}?\\b(?:this|that|these|those)\\b[^.!?\\n]{0,15}?\\b(?:${NOUN_EN})\\b`, "i"),
    new RegExp(`\\b(?:${VERB_EN})\\b\\s+(?:\\w+\\s+){0,2}?(?:${COMPANY}|${CRYPTO})\\b`, "i"),
    /\b(?:[Bb]uy|[Ss]ell|[Hh]old|BUY|SELL|HOLD)\s+[A-Z]{2,6}\b/, // ticker shape, e.g. "Buy ABCD"
    /\b(?:buy now|sell now|sell all|buy more|buy the dip|book profits?)\b/i,
  ],
  directiveHi: [
    /(शेयर|स्टॉक|फंड|टोकन|कॉइन|क्रिप्टो|ईटीएफ)[^।.!?\n]{0,30}(खरीदें|खरीदिए|खरीदो|खरीद लें|बेचें|बेचिए|बेचो|बेच दें)/u,
    /(खरीदें|खरीदिए|खरीदो|बेचें|बेचिए|बेचो)[^।.!?\n]{0,30}(शेयर|स्टॉक|फंड|टोकन|कॉइन|क्रिप्टो|ईटीएफ)/u,
  ],
  directiveTa: [
    /(பங்|ஷேர்|ஸ்டாக்|ஃபண்ட்|டோக்கன்|கிரிப்டோ|நாணய)[^.!?\n]{0,30}(வாங்குங்கள்|வாங்கவும்|வாங்கலாம்|விற்கவும்|விற்குங்கள்|விற்கலாம்)/u,
    /(வாங்குங்கள்|வாங்கவும்|விற்கவும்|விற்குங்கள்)[^.!?\n]{0,30}(பங்|ஷேர்|ஸ்டாக்|ஃபண்ட்|டோக்கன்|கிரிப்டோ|நாணய)/u,
  ],
  // A price call needs a price subject. "Your goal is to reach ₹50,00,000" is a goal, not a price call.
  priceTarget: [
    /\b(?:price\s*target|target\s*price)\b/i,
    /\b(?:it|this|that)\s+(?:will|could|may|is going to)\s+(?:reach|hit|touch|cross)\s+(?:₹|rs\.?\s*|inr\s*)\d/i,
    /\b(?:stock|share|price|nav|index|nifty|sensex|fund|token|coin)\b[^.!?\n]{0,30}\b(?:will|to|could|may|going to|expected to)\s+(?:reach|hit|touch|cross|go\s+to|rise to|jump to|fall to)\b/i,
    /(?:टारगेट|लक्ष्य)\s*(?:प्राइस|मूल्य|कीमत)/u,
    /(?:शेयर|स्टॉक|भाव|कीमत|प्राइस)[^।.!?\n]{0,20}(?:टारगेट|पहुंच(?:ेगा|ेगी)|छू(?:एगा|एगी))/u,
    /இலக்கு\s*விலை/u,
    /(?:பங்கு|ஷேர்)[^.!?\n]{0,20}டார்கெட்/u,
  ],
  // A guarantee is about returns. "Sum assured", "guaranteed renewal" and "risk-free rate" are
  // ordinary insurance and finance words.
  guaranteed: [
    /\b(?:guarantee[sd]?|assured)\s+(?:\w+\s+){0,2}?(?:returns?|profits?|gains?|growth|appreciation|income|yield|multiples?|payouts?)\b/i,
    /\b(?:returns?|profits?|gains?|growth|income)\s+(?:are|is|will be|would be|shall be)\s+(?:fully |100\s*%\s*)?(?:guaranteed|assured)\b/i,
    /\bguaranteed to\s+(?:grow|rise|double|beat|earn|make)\b/i,
    /\b(?:sure[- ]?shot|no[- ]risk|zero[- ]risk|double your money)\b/i,
    /\brisk[- ]?free\b(?!\s+(?:rate|assets?|debt))/i,
    /(?:गारंटी(?:ड|शुदा)?|पक्का|पक्की)\s*(?:\S+\s+){0,2}?(?:रिटर्न|मुनाफ़?ा|लाभ|कमाई)/u,
    /(?:जोखिम\s*(?:मुक्त|रहित)|बिना\s*जोखिम)/u,
    /உத்தரவாத\w*\s*(?:\S+\s+){0,2}?(?:வருமானம்|லாபம்|வருவாய்)/u,
    /நிச்சய\s*லாப/u,
    /(?:ஆபத்து\s*இல்லாத|ஆபத்தில்லாத)/u,
  ],
  // Projections that read as a promise ("this will double in 5 years", "expect 15% returns every year").
  projection: [
    /\b(?:will|going to|can|could|should)\s+(?:definitely |surely |easily |certainly )?(?:double|triple|quadruple|multiply)\b/i,
    /\b(?:double|triple|quadruple)s?\s+(?:your\s+\w+\s+)?(?:in|within)\s+(?:\d+|a few)\b/i,
    /\b\d+x\s+(?:in|within|returns?)\b/i,
    /\b(?:expect|expected|get|earn|make|yield|deliver|fetch|give)\b[^.!?\n]{0,30}\d[\d.,]*\s*%[^.!?\n]{0,30}\b(?:returns?|growth|a year|per year|annually|every year|yearly|p\.a\.?)/i,
  ],
  superlative: [
    // "best" is a superlative that pushes a product ("the best fund", "best option for you"). Ordinary comparison wording such as
    // "the best balance between cost and cover" or "best practices" is not.
    /\bbest\b(?:\s+\w+){0,2}?\s+(?:funds?|stocks?|shares?|schemes?|plans?|policy|policies|investments?|options?|choices?|bets?|returns?|performers?|performing|picks?|products?|deals?|etfs?)\b|\b(?:top[- ]?rated|number\s+one|unbeatable|sure[- ]?shot)\b|#1/i,
    /(सबसे\s*(?:अच्छा|अच्छी|बढ़िया|बेहतर)|बेस्ट)/u,
    /(மிகச்?\s*சிறந்த|பெஸ்ட்)/u,
  ],
};

// A guaranteed-return word is only excused when the sentence is clearly a WARNING about such claims.
// The negator must sit right next to the match (not anywhere nearby), so
// "there is no doubt this gives guaranteed returns" is still blocked.
const NEG_BEFORE_EN =
  /\b(?:no|not|never|nobody|nothing|cannot|can't|can not|isn't|aren't|won't|without|beware|unrealistic|impossible|avoid)\b(?:\W+\w+){0,2}\W*$/i;
const FRAME_BEFORE_EN =
  /\b(?:claims? of|claiming|no such thing as|anyone (?:promising|offering|claiming)|someone (?:promising|offering|claiming)|red flag|warning sign|watch out for|beware of)\b(?:\W+\w+){0,2}\W*$/i;
const NEG_AFTER_EN = /^\W*(?:\w+\W+){0,2}?(?:(?:is|are|do|does|can|could) not|isn't|aren't|can't|cannot|(?:is|are) (?:never|impossible|unrealistic))\b/i;
const NEG_HI = /(नहीं|कभी|कोई\s*भी|बचें|सावधान|दावा|झूठ|चेतावनी)/u;
const NEG_TA = /(இல்லை|வேண்டாம்|எச்சரிக்கை|தவிர்|ஜாக்கிரதை)/u;

function isWarningContext(text: string, start: number, end: number): boolean {
  const before = text.slice(Math.max(0, start - 60), start);
  const after = text.slice(end, end + 45);
  if (NEG_BEFORE_EN.test(before) || FRAME_BEFORE_EN.test(before) || NEG_AFTER_EN.test(after)) return true;
  const near = text.slice(Math.max(0, start - 20), start) + text.slice(end, end + 15);
  return NEG_HI.test(near) || NEG_TA.test(near);
}

// First- and second-person promises are never excused, even next to a warning word.
const PROMISES = [
  /\b(?:i|we)\s+(?:promise|guarantee|assure)\b/i,
  /\b(?:promise|guarantee|assure)s?\s+(?:you|your)\b/i,
  /\bas\s+promised\b/i,
  /\byou(?:'ll|\s+will)\s+(?:definitely|surely|certainly|always)\s+(?:earn|get|make|gain|double)/i,
  /\b(?:100\s*%|fully)\s+(?:safe|secure|guaranteed)\b/i,
  /(मैं|हम)\s+(?:वादा|गारंटी)\s+(?:करते|देते|करता|देता)/u,
  /(?:निश्चित|पक्का)\s*(?:मुनाफ़?ा|रिटर्न)\s*(?:मिलेगा|होगा)/u,
  /(?:உறுதியாக|நிச்சயமாக)\s+(?:லாபம்|வருமானம்)/u,
];

function scan(text: string, list: RegExp[], category: GuardrailCategory, allowWarning: boolean, hits: GuardrailHit[]) {
  for (const rx of list) {
    const m = rx.exec(text);
    if (!m) continue;
    if (allowWarning && isWarningContext(text, m.index, m.index + m[0].length)) continue;
    hits.push({ category, match: m[0] });
  }
}

export function checkGuardrails(text: string, mode: GuardrailMode = "personal"): GuardrailHit[] {
  const hits: GuardrailHit[] = [];
  scan(text, [...RX.directiveEn, ...RX.directiveHi, ...RX.directiveTa], "security_directive", false, hits);
  const pick = instrumentPick(text, mode) ?? (mode === "personal" ? NAMED_CAP_FUND.exec(text)?.[0] ?? null : null);
  if (pick) hits.push({ category: "instrument_pick", match: pick });
  scan(text, RX.priceTarget, "price_target", false, hits);
  scan(text, PROMISES, "guaranteed_return", false, hits);
  scan(text, RX.guaranteed, "guaranteed_return", true, hits);
  scan(text, RX.projection, "guaranteed_return", true, hits);
  scan(text, RX.superlative, "superlative", true, hits);
  return hits;
}

export function applyGuardrails(text: string, lang: Lang, mode: GuardrailMode = "personal"): { text: string; hits: GuardrailHit[] } {
  const hits = checkGuardrails(text, mode);
  return hits.length ? { text: SAFE_SENTENCE[lang], hits } : { text, hits };
}

// ---------- Is the user asking for a specific stock / fund / price call? ----------
// Refuse specific securities and price predictions. Questions about asset classes ("gold", "equity"),
// a house, insurance, loans, or "what is a mutual fund?" are answerable planning or education.
const SEC = "stocks?|shares?|mutual funds?|funds?|schemes?|etfs?|ipos?|coins?|crypto|tokens?|nifty|sensex|index funds?";
const EDU_PREFIX = /^\s*(?:what\s+(?:is|are|does)|what's|explain|define|how\s+(?:does|do|is)|meaning of|difference between)\b/i;
const ASK_NAMED = new RegExp(
  `\\b${ANY_COMPANY}\\b[^.?!\\n]{0,40}\\b(?:good buy|buy|sell|hold|worth|target|multibagger|undervalued|overvalued|will (?:go|rise|fall|double)|shares?|stocks?|funds?|ipo|price|attractive|safe bet|invest\\w*|good (?:investment|company|bet|pick))\\b`,
  "i",
);
const ASK_ACTION_NAMED = new RegExp(`\\b(?:buy|sell|hold|invest in|invest|exit|short)\\b[^.?!\\n]{0,25}\\b${ANY_COMPANY}\\b`, "i");
const ASK_WHICH = new RegExp(`\\b(?:which|what|any|best|top|good|suggest|recommend|name|tell me)\\b[^.?!\\n]{0,20}\\b(?:${SEC})\\b`, "i");
const ASK_SPECIFIC = new RegExp(`\\b(?:buy|sell|hold|exit|short|accumulate)\\b[^.?!\\n]{0,20}\\b(?:this|that|these|those|my|the|some|any)\\s+(?:\\w+\\s+)?(?:${SEC})\\b`, "i");
const ASK_VERB_SEC = new RegExp(`\\b(?:buy|sell|exit|short|accumulate)\\b[^.?!\\n]{0,20}\\b(?:${SEC})\\b`, "i");

// A crypto token named in an investing question ("bitcoin or gold?", "should I buy bitcoin") is a specific-token ask.
const ASK_CRYPTO = new RegExp(`\\b(?:${CRYPTO})\\b[^.?!\\n]{0,40}\\b(?:or|vs|versus|better|invest\\w*|good|safe|worth|buy|sell|hold|price|should)\\b|\\b(?:or|vs|versus|better|invest\\w*|buy|sell|hold|should)\\b[^.?!\\n]{0,25}\\b(?:${CRYPTO})\\b`, "i");

// Predictions: where will a market, index, price or rate go, or "is it a good time to buy"?
const PREDICT = [
  /\b(?:nifty|sensex|bank nifty|market|markets|stock market|share market|index|gold|gold price|gold rates?|rupee|dollar)\b[^.?!\n]{0,30}\b(?:will|going to|gonna|can|could|should)\s+(?:\w+\s+){0,2}?(?:hit|reach|cross|touch|go\s+(?:up|down|to)|crash|fall|rise|rally|double|recover)\b/i,
  /\bwill\s+(?:the\s+)?(?:market|markets|nifty|sensex|gold|stock market|share market)\s+(?:\w+\s+){0,2}?(?:crash|fall|rise|go\s+up|go\s+down|recover|hit|reach)\b/i,
  /\b(?:nifty|sensex)\b[^.?!\n]{0,25}\b\d[\d,]{3,}\b/i,
  /\b(?:good|right|best|safe)\s+time\s+to\s+(?:buy|invest|sell|enter|exit)\b/i,
  /\bwhen\s+will\s+(?:the\s+)?(?:market|nifty|sensex|prices?)\b/i,
  /\b(?:market|nifty|sensex)\b[^.?!\n]{0,25}\b(?:girega|badhega|chadhega|kab\s+badhega|kitna\s+jayega)\b/i,
  /(?:बाज़ार|बाजार|निफ्टी|सेंसेक्स)[^।.?!\n]{0,25}(?:गिरेगा|बढ़ेगा|चढ़ेगा|क्रैश)/u,
  /(?:சந்தை|நிஃப்டி|சென்செக்ஸ்)[^.?!\n]{0,25}(?:விழும்|உயரும்|சரியும்|ஏறும்)/u,
];

export type RequestKind = "security" | "prediction";

/** What is the user asking for that we must refuse? null = answerable planning or education. */
export function classifyRequest(q: string): RequestKind | null {
  if (securityRequest(q)) return "security";
  return PREDICT.some((r) => r.test(q)) ? "prediction" : null;
}

export const isStockTipRequest = (q: string): boolean => classifyRequest(q) !== null;

export const PREDICTION_SENTENCE: Record<Lang, string> = {
  en: "I can't predict where markets, prices or rates will go, and nobody can. I can show how a fall would affect your goals and help you plan so a bad year does not derail them.",
  hi: "मैं यह अनुमान नहीं लगा सकता कि बाज़ार, भाव या दरें कहाँ जाएंगी, और कोई नहीं लगा सकता। मैं दिखा सकता हूँ कि गिरावट आपके लक्ष्यों पर कैसे असर डालेगी, और योजना बनाने में मदद कर सकता हूँ ताकि एक बुरा साल उन्हें न बिगाड़े।",
  ta: "சந்தை, விலை அல்லது வட்டி எங்கே போகும் என்று என்னால் கணிக்க முடியாது; யாராலும் முடியாது. வீழ்ச்சி உங்கள் இலக்குகளை எப்படிப் பாதிக்கும் என்பதைக் காட்டவும், ஒரு மோசமான ஆண்டு அவற்றைக் கெடுக்காதவாறு திட்டமிட உதவவும் முடியும்.",
};

function securityRequest(q: string): boolean {
  if (ASK_CRYPTO.test(q)) return true;
  if (ASK_NAMED.test(q) || ASK_ACTION_NAMED.test(q)) return true;
  if (!EDU_PREFIX.test(q) && (ASK_WHICH.test(q) || ASK_SPECIFIC.test(q) || ASK_VERB_SEC.test(q))) return true;
  return [
    /\b(?:target price|price target|multibagger|sure[- ]?shot|hot tip|best (?:stock|fund|scheme)|double my money|paisa double|paise double)\b/i,
    // Romanised Hindi / Tamil (how people actually type)
    /\b(?:share|shares|stock|stocks|fund|funds|coin|crypto|ipo)\b[^.?!\n]{0,25}\b(?:lena|lun|lu|le\s*lun|kharid\w*|khareed\w*|bech\w*|becho|chahiye|badhega|girega|chalega|sahi hai)\b/i,
    /\b(?:kaun\s*sa|kaunsa|konsa|kon\s*sa|konsi|kaun\s*si|kaunsi)\b[^.?!\n]{0,20}\b(?:share|stock|fund|coin|crypto|scheme|ipo)\b/i,
    /\b(?:entha|endha|enna)\b[^.?!\n]{0,20}\b(?:share|stock|fund|coin)\b/i,
    /\b(?:share|stock|fund|coin)\b[^.?!\n]{0,20}\b(?:vanga\w*|vikka\w*)\b/i,
    // Devanagari / Tamil script: a buy/sell question only counts when a security noun is next to it
    /(कौन\s*सा|कौनसा).{0,20}(शेयर|स्टॉक|फंड|कॉइन)/u,
    /(शेयर|स्टॉक|फंड|कॉइन|क्रिप्टो).{0,25}(खरीदूं|खरीदूँ|बेचूं|बेचूँ|खरीदना\s*चाहिए|बेचना\s*चाहिए)/u,
    /(खरीदूं|खरीदूँ|बेचूं|बेचूँ|खरीदना\s*चाहिए|बेचना\s*चाहिए).{0,25}(शेयर|स्टॉक|फंड|कॉइन|क्रिप्टो)/u,
    /(எந்த).{0,20}(பங்கு|ஷேர்|ஃபண்ட்|கிரிப்டோ)/u,
    /(பங்கு|ஷேர்|ஃபண்ட்|கிரிப்டோ|ஸ்டாக்).{0,25}(வாங்கலாமா|விற்கலாமா|வாங்கவா|விற்கவா)/u,
    /(வாங்கலாமா|விற்கலாமா|வாங்கவா|விற்கவா).{0,25}(பங்கு|ஷேர்|ஃபண்ட்|கிரிப்டோ|ஸ்டாக்)/u,
  ].some((r) => r.test(q));
}
