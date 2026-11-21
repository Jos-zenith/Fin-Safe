// The rule engine behind Second Opinion. Offline and deterministic: it reads the pasted text and lists warning
// signs with the sentence that triggered each. It never says a message is safe: "no warning signs matched"
// only means this set of rules found nothing.
//
// How it decides:
//  1. The text is split into sentences. A sentence that WARNS about scams is not itself a scam sign.
//  2. Each detector looks at normalised text (digits folded, invisible characters removed, look-alike letters,
//     spaced-out letters, Devanagari spelling variants) and at a romanised-Hindi/Tamil folding of it.
//  3. Every hit has a weight: 3 strong, 2 medium, 1 weak. Weak signals alone are ignored, but several weak
//     signals together (total of 2 or more) are reported, so a message can be flagged by accumulation.
//  4. Link addresses are inspected offline (see urls.ts). Nothing is fetched or looked up.
import type { FLAG_TYPES } from "../ai/schemas";
import { foldDigits, normalizeText, R, romanFold, RR, stripInvisible } from "./normalize";
import { inspectLinks, type LinkFinding } from "./urls";

export { foldDigits };
export type FlagType = (typeof FLAG_TYPES)[number];
export type Sev = "low" | "medium" | "high";
export interface Hit {
  type: FlagType;
  severity: Sev;
  quote: string;
  /** 3 strong, 2 medium, 1 weak. */
  weight: number;
  /** The sender only CLAIMS to be registered. */
  claim?: boolean;
}

// ---------- sentences ----------
const ABBREV = new Set(["rs", "no", "dr", "mr", "mrs", "ms", "st", "vs"]);
export interface Sentence {
  /** Original text. Quotes always come from here, so a quote is a verbatim substring of the message. */
  s: string;
  /** Normalised text for matching English, Hindi and Tamil patterns. */
  f: string;
  /** Romanised-Hindi / Tamil folding of `f`. */
  r: string;
  i: number;
}
const sentenceOf = (raw: string, start: number): Sentence | null => {
  const s = raw.trim().slice(0, 280);
  if (!s) return null;
  const f = normalizeText(s);
  return { s, f, r: romanFold(f), i: start };
};

/** Splits at . ! ? and the Hindi danda followed by whitespace (so "bit.ly" and "3.5%" stay whole), and at newlines. */
export function splitSentences(text: string): Sentence[] {
  const clean = stripInvisible(text);
  const out: Sentence[] = [];
  const push = (raw: string, start: number) => {
    const x = sentenceOf(raw, start);
    if (x) out.push(x);
  };
  let start = 0;
  for (let k = 0; k < clean.length; k++) {
    const c = clean[k];
    const end = c === "\n" || (/[.!?।]/.test(c) && (k + 1 === clean.length || /\s/.test(clean[k + 1])));
    if (!end) continue;
    if (c === "." && ABBREV.has((clean.slice(start, k).match(/(\w+)$/)?.[1] ?? "").toLowerCase())) continue;
    // an initialism written with dots in any script ("V.I.P.", "வி.ஐ.பி.") is not the end of a sentence
    if (c === "." && /(?:^|[\s.])\p{L}\p{M}*\.\p{L}\p{M}*$/u.test(clean.slice(start, k))) continue;
    push(clean.slice(start, k + 1), start);
    start = k + 1;
  }
  push(clean.slice(start), start);
  return out;
}

// ---------- helpers ----------
type Test = (x: Sentence) => boolean;
const onF = (...rx: (RegExp | Test)[]): Test => (x) => rx.some((r) => (typeof r === "function" ? r(x) : r.test(x.f)));
const onR = (...words: string[]): Test => {
  const rr = RR(words);
  return (x) => rr.test(x.r);
};
const anyOf = (...t: Test[]): Test => (x) => t.some((f) => f(x));

// ---------- awareness text ----------
// A sentence that WARNS about scams is not a scam, unless it also pitches ("join our group").
const WARNING_EN = onF(
  R("\\b(?:beware|be careful|be cautious|caution|red flags?|warning signs?|(?:investor|scam|fraud|public|security|consumer) (?:alert|warning|notice|awareness)|awareness|phishing|fraudsters?|scammers?|con ?artists?|consult (?:a|an|your)|verify (?:with|on|the)|(?:never|do not|don't|dont|should not|must not) (?:share|click|trust|invest|pay|give|send|fall|reveal|disclose|install)|never ask|will never|not ask you|cannot promise|can't promise|no (?:regulated )?(?:product|adviser|advisor|bank|broker) (?:can|will|would))\\b"),
);
const WARNING_HI = onF(R("सावधान|सतर्क|चेतावनी|जागरूक|ठग|धोखेबाज|धोखे\\s*से\\s*बचें|साझा\\s*न\\s*करें|शेयर\\s*न\\s*करें|सलाह\\s*लें|कभी\\s*नहीं\\s*(?:मांगते|मांगेंगे|पूछते)|नहीं\\s*मांगेंगे|कभी\\s*भी\\s*नहीं"));
const WARNING_TA = onF(R("எச்சரிக்கை|ஜாக்கிரதை|ஏமாற\\s*வேண்டாம்|பகிர\\s*வேண்டாம்|விழிப்புணர்வு|மோசடிக்கார|ஆலோசிக்கவும்|கேட்க\\s*மாட்டோம்|கேட்காது|கேட்க\\s*மாட்டார்|ஒருபோதும்\\s*செலுத்த\\s*வேண்டாம்"));
const WARNING_ROM = onR(
  "savdhan", "sawdhan", "savdhaan", "satark", "chetavani", "dhokha", "jaakirathai", "jakkirathai", "echcharikkai",
  "share na karein", "share na kare", "na karein", "mat karein", "kabhi nahi maangte", "kabhi nahi mangte", "nahi maangenge",
  "nahi mangenge", "kabhi nahi puchte", "share panna vendaam", "share panna vendam", "ketkaadhu", "ketkathu", "ketka maattom", "ketka matom",
  "mosadi", "mosadikkaarar", "officer ban kar", "never share",
);
const POSITIVE_PITCH = onF(
  R("\\b(?:join (?:my|our|us)|dm me|pay (?:now|today|first)|click (?:here|the link)|send me|whatsapp me|call me|limited (?:seats|slots)|register now|subscribe now)\\b|ग्रुप\\s*जॉइन|जॉइन\\s*करें|குழுவில்\\s*சேருங்கள்|சேருங்கள்"),
);
// "Never share your OTP" and "Do not tell anyone your PIN" warn about a credential; they do not ask for it.
const isCredentialWarning = (x: Sentence) => (CRED_ITEM(x) || CRED_ITEM_ROM(x) || REMOTE_ITEM(x)) && PROHIBIT(x);
export const isWarning = (x: Sentence) => (anyOf(WARNING_EN, WARNING_HI, WARNING_TA, WARNING_ROM)(x) || isCredentialWarning(x)) && !POSITIVE_PITCH(x);

// ---------- credential items ----------
const CRED_ITEM = onF(
  R("\\b(?:otp|one[- ]time password|cvv|cvc|upi pin|atm pin|mpin|pin number|(?:your|apna|aapka|ungal)\\s+pin\\b|net ?banking (?:id|password|login)|password|passcode|card number|card details|expiry date|aadhaar (?:number|otp|photo)|pan (?:card|number|photo)|9[- ]digit code|login (?:id|details))\\b"),
  R("ओटीपी|पासवर्ड|पिन|सीवीवी|कार्ड\\s*नंबर|कार्ड\\s*विवरण|एक्सपायरी|आधार\\s*(?:नंबर|ओटीपी)|9\\s*अंकों\\s*का\\s*कोड"),
  R("ஓடிபி|கடவுச்சொல்|பின்\\s*எண்|பின்(?![\\p{L}\\p{M}])|கார்டு\\s*எண்|காலாவதி\\s*தேதி|9\\s*இலக்க"),
);
const CRED_ITEM_ROM = onR("pin bhejo", "card number", "card no", "expiry", "password");
const CRED_ASK = onF(
  R("\\b(?:share|send|tell|give|forward|enter|provide|submit|read out|reply with|type|fill|need|needs|require|requires|want|wants|required)\\b"),
  R("बताएं|बताइए|बताओ|बताना|भेजें|भेजिए|भेजो|भेज\\s*दें|शेयर\\s*करें|साझा\\s*करें|दीजिए|दें|दो(?![\\p{L}\\p{M}])|डालें|डालिए|डालो|भरें|चाहिए|चाहिये|जरूरत"),
  R("பகிருங்கள்|பகிர்|சொல்லுங்கள்|அனுப்புங்கள்|அனுப்பு|கொடுங்கள்|தாருங்கள்|உள்ளிடுங்கள்|உள்ளிடு|போடுங்கள்|தேவை"),
);
const CRED_ASK_ROM = onR(
  "batao", "bata do", "bhejo", "bhej do", "dijiye", "daalo", "dalo", "chahiye", "chahie", "de do", "dena", "share karo", "share kijiye",
  "sollunga", "anuppunga", "kudunga", "podunga", "venum", "venumnu", "thaarunga", "tharunga", "share pannunga", "ulleedu",
);
// "We will never ask for your PIN" is a warning, not a request.
const PROHIBIT = onF(
  R("\\b(?:never|do not|don't|dont|should not|must not|won't|will not|cannot|can't)\\s+(?:\\w+\\s+){0,3}?(?:share|tell|give|send|reveal|disclose|provide|enter|ask|request|need)\\b|\\bnever\\b"),
  R("(?<![\\p{L}\\p{M}])(?:न|मत|कभी\\s*नहीं|नहीं)\\s*(?:बताएं|बताइए|बताओ|बताना|भेजें|भेजिए|दें|दीजिए|साझा|शेयर|मांगते|मांगेंगे)|साझा\\s*न\\s*करें|शेयर\\s*न\\s*करें|कभी\\s*नहीं"),
  R("பகிர\\s*வேண்டாம்|சொல்ல\\s*வேண்டாம்|கொடுக்க\\s*வேண்டாம்|கேட்க\\s*மாட்டோம்|கேட்க\\s*மாட்டார்|கேட்காது|ஒருபோதும்"),
  (x) => onR("na karein", "na kare", "na batayein", "mat batao", "mat bhejo", "nahi maangte", "nahi maangenge", "share panna vendaam", "share panna vendam", "ketkaadhu", "ketka maattom", "ketka matom", "kabhi nahi")(x),
);
const REMOTE_ITEM = onF(
  R("\\b(?:anydesk|any desk|teamviewer|team viewer|quicksupport|rustdesk|airdroid|screen ?shar\\w*|share (?:your )?screen|remote (?:access|support|control)|support app)\\b"),
  R("स्क्रीन\\s*शेयर|सपोर्ट\\s*ऐप|एनीडेस्क|रिमोट\\s*एक्सेस"),
  R("திரையை(?:ப்)?\\s*பகிர|ஆதரவு(?:ச்)?\\s*செயலி|ஸ்கிரீன்\\s*ஷேர்|ரிமோட்"),
);
const REMOTE_ROM = onR("screen share", "screen ah share", "support app", "remote access");

// ---------- investment-pitch signals ----------
const NOT_A_PROMISE = R("\\b(?:no|not a|cannot|can'?t|never|isn'?t|is not)\\s+(?:be\\s+)?guarantee[sd]?\\b|\\bnot\\s+guaranteed\\b|(?:गारंटी|உத்தரவாதம்)\\s*(?:नहीं|कभी\\s*नहीं|இல்லை|கிடையாது|அளிக்க\\s*முடியாது)");
const GUARANTEED: Test = anyOf(
  onF(
    R("\\b(?:guarantee[sd]?|assured|certain|sure|fixed|steady|promised)\\s+(?:\\w+\\s+){0,2}?(?:returns?|profits?|gains?|growth|income|yield|payouts?|results?|earnings?)\\b"),
    R("\\b(?:returns?|profits?|gains?|results?|payouts?)\\s+(?:are |is |will be )?(?:guaranteed|assured|fixed|certain)\\b"),
    R("\\bguaranteed\\s+(?:\\d|₹|rs)"),
    R("\\b(?:sure[- ]?shot|risk[- ]?free(?!\\s+(?:rate|assets?))|no[- ]risk|zero risk|100\\s*%\\s*(?:safe|secure|protected)|double your (?:money|savings|investment)|(?:sure|certain|assured) profit)\\b"),
    R("\\bcapital\\s+(?:is\\s+)?(?:100\\s*%\\s*)?(?:protected|safe|secure|guaranteed)\\b"),
    R("\\b(?:never|doesn'?t|does not|won'?t)\\s+(?:fails?|lose|loses)\\b|\\bno\\s+loss(?:es)?\\b|\\bwithout\\s+(?:a\\s+single\\s+|any\\s+)?loss\\b"),
    R("\\d+(?:\\.\\d+)?\\s*%\\s*(?:every|per|a|each)?\\s*(?:day|week|month|daily|weekly|monthly)\\b"),
    R("\\b(?:earn|make|get)\\s+(?:rs\\.?|inr|₹)?\\s*[\\d,]+\\s*(?:daily|per day|a day|every day|weekly|a week|per week)\\b"),
    R("\\bdouble\\s+(?:it|them|your\\s+\\w+)\\s+(?:within|in)\\s+\\d+\\s+(?:days?|weeks?|months?)\\b"),
    // romanised rates and earnings: "har hafte 4%", "roz 2%", "maatham 25%", "dhinam 2%", "roz 3,000 kamao"
    R("\\b(?:har\\s+(?:hafte|hafta|mahine|mahina|din)|roz(?:ana)?|dhinam(?:um)?|dinam(?:um)?|vaaram|varam|maatham|maadham|matham)\\s+(?:me\\s+)?\\d+(?:\\.\\d+)?\\s*%"),
    R("\\b\\d+(?:\\.\\d+)?\\s*%\\s*(?:har\\s+(?:hafte|hafta|mahine|mahina|din)|roz(?:ana)?|dhinam|monthly|weekly)\\b"),
    R("\\b(?:roz(?:ana)?|dhinam(?:um)?|dinam(?:um)?)\\s+(?:rs\\.?\\s*)?[\\d,]+\\s*(?:rupaye|rupees|rs|rubai|rupai)?\\s*(?:kamao|kama\\w*|samba\\w*|sampa\\w*|earn)\\b"),
    // Hindi
    R("गारंटी(?:ड|शुदा)?|पक्का\\s*(?:मुनाफा|रिटर्न|कमाई)|पक्की\\s*कमाई|नतीजे\\s*पक्के|तय\\s*रिटर्न|निश्चित\\s*(?:रिटर्न|मुनाफा|लाभ)|दोगुना|दुगुना|दोगुनी|जोखिम\\s*(?:मुक्त|रहित|नहीं)|बिना\\s*(?:एक\\s*भी\\s*)?(?:जोखिम|रिस्क|घाटे)|रिस्क\\s*(?:फ्री|नहीं)|100\\s*%\\s*सुरक्षित|पूंजी\\s*(?:100\\s*%\\s*)?सुरक्षित|नुकसान\\s*का\\s*सवाल|कभी\\s*फेल\\s*नहीं|लिखित\\s*भरोसा"),
    R("(?:हर\\s*(?:महीने|हफ्ते|दिन|सप्ताह)|रोज|रोजाना|प्रतिदिन|प्रति\\s*(?:माह|सप्ताह|दिन)|मासिक|साप्ताहिक)\\s*(?:में\\s*)?\\d+(?:\\.\\d+)?\\s*%|\\d+(?:\\.\\d+)?\\s*%\\s*(?:हर\\s*(?:महीने|हफ्ते|दिन)|प्रति\\s*(?:माह|सप्ताह|दिन)|मासिक|साप्ताहिक|महीना|रोज)"),
    R("रोज(?:ाना)?\\s*[\\d,]+\\s*(?:रुपये|रुपए|₹)?\\s*कमा"),
    // Tamil
    R("உத்தரவாத|உறுதியான\\s*(?:லாபம்|வருமானம்)|நிச்சய|நிலையான\\s*வருமானம்|ஆபத்தே\\s*இல்லை|ஆபத்தில்லை|ஆபத்து\\s*இல்லை|நஷ்டமே\\s*இல்லை|நஷ்டம்\\s*இல்லை|இழப்பே\\s*இல்லை|இரட்டிப்பு|தோற்காது|100\\s*%\\s*பாதுகாப்பு|எழுத்துப்பூர்வ\\s*உறுதி|ரிஸ்க்\\s*(?:இல்லை|இல்லாத)"),
    R("(?:மாதம்|மாதத்துக்கு|மாதத்திற்கு|ஒவ்வொரு\\s*மாதமும்|மாதாமாதம்|வாரம்|வாரத்துக்கு|தினமும்|தினம்)\\s*\\d+(?:\\.\\d+)?\\s*%|\\d+(?:\\.\\d+)?\\s*%\\s*(?:மாதம்|மாதத்துக்கு|மாதத்திற்கு|ஒவ்வொரு\\s*மாதமும்|வாரம்|தினமும்)"),
    R("தினமும்\\s*[\\d,]+\\s*(?:ரூபாய்|₹)?\\s*சம்பாத"),
  ),
  onR(
    "pakka munafa", "pakki kamai", "pakka profit", "pakka return", "result pakka", "pakka", "fix return", "fixed return", "surakshit",
    "nuksan ka sawal", "kabhi fail nahi", "bina loss", "bharosa milega", "bachat double", "semippu double", "paisa double", "paise double", "money double",
    "double ho", "double hojayega", "double aagum", "double return", "urudhi", "uruthi", "nashtam illa", "nashtam pechu illai", "risk illa", "paadhukaappu",
    "padhukappu", "eppavum fail", "kooda illama", "loss naal kooda illama", "loss illa",
  ),
);
const INSIDER: Test = anyOf(
  onF(
    R("\\b(?:insider|inside (?:info|information|news)|information from (?:a |the )?director|source (?:at|inside|in) (?:the )?(?:exchange|company)|secret (?:tip|info|news)|leaked|confirmed (?:tip|bulk deal)|bulk deal|don'?t tell (?:anyone|anybody)|tell no one|keep (?:it|this) (?:a )?secret|not for everyone|quietly (?:accumulate|buy)|andar ki khabar|pakki khabar)\\b"),
    R("अंदर\\s*की\\s*खबर|इनसाइडर|गुप्त\\s*टिप|लीक|सूत्र|गुप्त\\s*रखें|चुपचाप\\s*(?:जमा|खरीद)|किसी\\s*को\\s*(?:मत|न)\\s*बता|बल्क\\s*डील|यह\\s*टिप\\s*सबके\\s*लिए\\s*नहीं"),
    R("உள்ளிருந்து\\s*தகவல்|உள்ளே\\s*தகவல்|உள்ளிருக்கும்\\s*தகவல்|இன்சைடர்|ரகசிய|ரகசியமாக|யாரிடமும்\\s*சொல்லாதீர்கள்|கசிந்து|வட்டாரம்|மொத்த\\s*ஒப்பந்தம்|அமைதியாக\\s*(?:சேர்த்து|வாங்க)|எல்லோருக்கும்\\s*அல்ல"),
  ),
  onR(
    "andar ki khabar", "leak hua", "leak", "chupchap", "secret rakho", "kisi ko mat batana", "kisi ko mat batao", "sabke liye nahi", "bulk deal",
    "ulla thagaval", "leak aagiduchu", "rahasiya", "rahasiyama", "yaaridamum sollaadheenga", "amaidhiya serthukkonga", "ellorukkum illa", "ulla thagaval kidaichirukku",
  ),
);
const NO_DISCLOSURE: Test = anyOf(
  onF(
    R("\\b(?:no other charges|no hidden charges|no need to read|don'?t read|small print|fine print|processing fee later|pay first|no questions|take care of (?:all|everything)|nothing extra)\\b"),
    R("कोई\\s*और\\s*चार्ज\\s*नहीं|छिपे\\s*चार्ज|पढ़ने\\s*की\\s*जरूरत\\s*नहीं|बारीक\\s*अक्षर\\s*न\\s*पढ़ें|बारीक\\s*अक्षर"),
    R("வேறு\\s*கட்டணம்\\s*இல்லை|படிக்க\\s*வேண்டாம்|மறைமுக\\s*கட்டணம்|சிறிய\\s*எழுத்து"),
  ),
  onR("koi aur charge nahi", "fine print mat padho", "vera charge illa", "sinna ezhuthukkal padikka vendaam"),
);
const SIGNAL_GROUP: Test = anyOf(
  onF(
    R("\\b(?:vip (?:group|channel)|premium (?:stock )?(?:group|channel)|join (?:my|our) (?:group|channel)|paid (?:group|channel|members?)|dm me|dm the|comment ['\"]?yes|my own method|no registration|market (?:ideas|tips|calls)|stock (?:tips|calls)|intraday tips|tips group|telegram (?:group|channel)|whatsapp (?:group|channel)|group join karo|lifetime access|next call)\\b"),
    R("\\b\\d{2}\\s*%\\s*(?:accuracy|success rate)\\b"),
    R("टेलीग्राम\\s*ग्रुप|वीआईपी\\s*ग्रुप|vip\\s*चैनल|प्रीमियम\\s*स्टॉक\\s*ग्रुप|स्टॉक\\s*ग्रुप|व्हाट्सएप\\s*ग्रुप|डीएम\\s*करें|टिप्स\\s*ग्रुप|पेड\\s*मेंबर|आजीवन\\s*एक्सेस|अगली\\s*कॉल|\\d{2}\\s*%\\s*सटीकता"),
    R("டெலிகிராம்\\s*குழு|வாட்ஸ்அப்\\s*குழு|வாட்ஸ்அப்\\s*குரூப்|டெலிகிராம்\\s*குரூப்|பங்குக்\\s*குழு|டிப்ஸ்\\s*குழு|vip\\s*சேனல்|அடுத்த\\s*அழைப்பு|வாழ்நாள்\\s*அணுகல்|\\d{2}\\s*%\\s*துல்லியம்"),
    // an unsolicited "buy THIS stock" call is a tip from an unverified source, in every language
    R("\\b(?:buy|sell|hold)\\s+(?:this|these|the following)\\s+(?:stock|share|scrip|coin|token)s?\\b"),
    R("(?:यह|इस)\\s*(?:शेयर|स्टॉक)\\s*(?:खरीद|खरीदें|खरीदिए|लें|ले\\s*लो)|शेयर\\s*टिप"),
    R("(?:இந்த)\\s*(?:பங்கை|பங்கு|ஷேர்|ஸ்டாக்)\\s*(?:வாங்க|வாங்குங்கள்|வாங்கவும்|வாங்கலாம்)|டிப்ஸ்|ஸ்டாக்\\s*டிப்"),
  ),
  onR(
    "yeh share kharido", "yeh share lo", "ye share lo", "is share ko", "share tips", "vip channel", "premium stock group", "paid members", "agli call",
    "indha stock vaanga", "intha stock vaanga", "indha share vaanga", "next call", "adutha call", "lifetime access",
  ),
);
const LEVERAGE: Test = anyOf(
  onF(
    R("\\b(?:leverage|margin (?:trading|funding)|borrow(?:ed)? (?:money |from us )?(?:to invest|instantly|immediately)|loan to invest|intraday with|futures|control (?:rs\\.?\\s*)?[\\d,]+)\\b"),
    R("लीवरेज|उधार\\s*ले|फ्यूचर्स"),
    R("கடன்\\s*வாங்கி\\s*முதலீடு|லீவரேஜ்|ஃபியூச்சர்ஸ்|கடன்\\s*வாங்க"),
  ),
  onR("udhaar lo", "udhar lo", "kadan vaanga", "kadan vangi"),
);
const PUMP: Test = anyOf(
  onF(
    R("\\b(?:penny stock|operator|pump|multibagger|\\d+x in \\d+ (?:days|weeks)|volume spike|upper circuit|(?:gave|gives|delivered)\\s+\\d+x|\\d+x\\s+on\\s+the\\s+last|target double)\\b"),
    R("पेनी\\s*स्टॉक|ऑपरेटर|मल्टीबैगर|पंप|अपर\\s*सर्किट|टारगेट\\s*डबल|\\d+\\s*गुना\\s*दिया"),
    R("பென்னி\\s*ஸ்டாக்|ஆபரேட்டர்|மல்டிபேக்கர்|அப்பர்\\s*சர்க்யூட்|இலக்கு\\s*இரட்டிப்பு|\\d+\\s*மடங்கு\\s*தந்தது"),
  ),
  onR("upper circuit", "operator", "target double", "volume spike", "5x diya", "5x kuduthuchu"),
);
const COMMISSION: Test = onF(
  R("\\b(?:don'?t go for direct|direct plans? (?:have|give|has) no|(?:take|choose|go for|switch to|buy|move to) (?:the )?regular plans?|cancel your direct plans?|regular plans? (?:through|via|with) me|commission|trail fee|we earn from)\\b"),
  R("रेगुलर\\s*प्लान\\s*(?:लें|लो)|कमीशन|डायरेक्ट\\s*प्लान\\s*बंद"),
  R("ரெகுலர்\\s*(?:பிளான்|திட்ட)|கமிஷன்|டைரக்ட்\\s*திட்டங்களை\\s*நிறுத்தி"),
);
const COMMISSION_NOT = R("\\b(?:commission[- ]free|no commission|zero commission|without (?:any )?commission|lower (?:yearly )?cost|expense ratio)\\b");
const COMMISSION_ROM = onR("direct plans band", "regular plan lo", "regular plan ku", "regular plan ku maarunga", "direct plans ah niruthitu", "mere through regular", "en moolam regular");

// ---------- urgency ----------
const URGENCY_STRONG = onF(
  R("\\b(?:last chance|hurry|today only|limited (?:seats|slots|spots|period|time)|(?:only\\s+)?(?:a\\s+)?(?:\\d+|few|two|three|five)\\s+(?:seats?|slots?|spots?|places?)\\s+(?:left|remaining)|seats?\\s+left|act now|offer (?:ends|closes|expires)|closes tonight|(?:pay|join|invest|sign|buy|subscribe|book|register|send|transfer|deposit)\\s+(?:today|now|tonight|immediately)|join before|buy before|don'?t miss|(?:final|last)\\s+day|lock your (?:seat|position|spot)|secure your (?:position|seat|spot)|midnight|jaldi karo|aaj hi|aakhri mauka|turant)\\b"),
  R("आखिरी\\s*(?:मौका|दिन)|जल्दी\\s*(?:करें|कीजिए|करो)|जल्दबाजी|सीमित\\s*(?:सीटें|सीट|स्लॉट)|सिर्फ\\s*आज|आज\\s*ही|आज\\s*रात|अभी\\s*(?:जुड़ें|निवेश|पैसे)|तुरंत\\s*(?:निवेश|पैसे|भुगतान|जुड़ें|उधार)|ऑफर\\s*खत्म|मौका\\s*न\\s*गंवाएं|देर\\s*न\\s*करें|आधी\\s*रात|सिर्फ\\s*\\d+\\s*(?:सीट|स्लॉट|जगह)|जगह\\s*पक्की|आज\\s*आखिरी"),
  R("கடைசி\\s*(?:வாய்ப்பு|நாள்)|இன்றே|இன்று\\s*(?:மட்டும்|கடைசி)|இன்றிரவு|இப்போதே|உடனே|உடனடியாக|அவசரம்|விரைந்து|விரைவாக\\s*(?:முதலீடு|பணம்|சேருங்கள்)|சில\\s*இடங்கள்|\\d+\\s*இடங்கள்\\s*மட்டும்|வரையறுக்கப்பட்ட\\s*இடங்கள்|தவறவிடாதீர்கள்|நள்ளிரவு|இடத்தைப்\\s*பிடிக்க"),
  R("\\b(?:udane|udanae|innaiku\\s+(?:thaan\\s+)?(?:mattum|kadaisi)|inniki\\s+mattum|kadaisi\\s+(?:vaaippu|naal)|ippave|indrae|indre|seekiram|sikkiram|nadu\\s+iravu|indru\\s+iravu|\\d+\\s+idam\\s+mattum|sirf\\s+\\d+\\s+seat|\\d+\\s+seat\\s+bachi|aaj\\s+raat|aadhi\\s+raat|offer\\s+khatam)\\b"),
);
const URGENCY_WEAK = onF(R("\\b(?:immediately|right now|within \\d+ (?:hours?|minutes?)|(?:in|within) the next \\d+ (?:hours?|minutes?)|by tonight)\\b"), R("अगले\\s*\\d+\\s*(?:मिनट|घंटे)"), R("(?:அடுத்த\\s*\\d+\\s*நிமிட|\\d+\\s*நிமிடத்தில்)"), R("\\b(?:agle|adutha)\\s+\\d+\\s*(?:minute|nimidam|ghante)"));
const SOLICIT = anyOf(
  onF(R("\\b(?:join|pay|send|transfer|deposit|click|download|subscribe|register|apply|invest|buy|call|dm|whatsapp|contact|book|sign|enter|reply|forward)\\b"), R("भेज|जमा|जुड़|निवेश|खरीद|जवाब|लिखकर"), R("அனுப்பு|செலுத்து|சேரு|முதலீடு|வாங்கு|பதிலளி")),
  onR("bhejo", "jama karo", "reply karo", "reply pannunga", "anuppunga", "seluthunga", "kharido", "vaanga"),
);

// ---------- link, payee, unlisted ----------
const LURE = onF(
  R("\\b(?:kyc|account|bank|demat|refund|reward|bonus|cashback|blocked|suspend\\w*|expire\\w*|verify|verification|update|prize|lottery|claim|penalty|deactivat\\w*|freez\\w*|dividend|login|log in)\\b"),
  R("केवाईसी|खाता|खाते|रिफंड|बोनस|डिविडेंड|लॉगिन|सत्यापन|अपडेट|निलंबित"),
  R("கணக்கு|கே\\s*ஒய்\\s*சி|போனஸ்|டிவிடெண்ட்|உள்நுழை|சரிபார்ப்பு|புதுப்பி|இடைநிறுத்த|பணத்தைத்\\s*திரும்ப"),
  (x) => onR("kyc", "account", "bonus", "dividend", "login", "update", "refund", "verification", "suspend")(x),
);
const THREAT = onF(R("\\b(?:blocked|suspend\\w*|expire[sd]?|freez\\w*|deactivat\\w*|penalty|within \\d+ (?:hours?|minutes?)|immediately)\\b"), R("बंद\\s*होने|निलंबित|ब्लॉक"), R("முடக்க|இடைநிறுத்த"), (x) => onR("suspend", "band hone", "mudakkapadum")(x));
const CLICK_WORDS = onF(R("\\b(?:click (?:here|the link|on the link|below)|link (?:below|par|pe)|download (?:the |our )?app)\\b"), R("यहाँ\\s*क्लिक|यहां\\s*क्लिक|लिंक\\s*पर"), R("இங்கே\\s*(?:கிளிக்|தட்டு)|இணைப்பை"), (x) => onR("yahan click", "inga click", "click karo", "click pannunga")(x));

// ---------- account-threat phishing without an investment pitch (KYC, PAN, lottery, utility cut-off) ----------
const ACCT_TOPIC = onF(
  R("\\b(?:kyc|pan|aadhaar|aadhar|bank account|account|sim|debit card|credit card|net ?banking|wallet|upi id)\\b"),
  R("केवाईसी|खाता|खाते|पैन|आधार"),
  R("கணக்கு|கே\\s*ஒய்\\s*சி|பான்|ஆதார்"),
  onR("kyc", "khata", "account", "pan card"),
);
const ACCT_THREAT = anyOf(
  THREAT,
  onF(R("\\b(?:expired?|lapse[sd]?|invalid|not linked|incomplete|terminated|closed|restricted)\\b"), R("समाप्त|एक्सपायर|बंद|ब्लॉक"), R("காலாவதி|முடக்க|மூடப்"), R("பூட்டப்")),
  onR("expire ho", "band ho jayega", "band ho jaayega", "block ho", "band kar diya", "suspend"),
);
const ACCT_ACTION = onF(
  R("\\b(?:update|verify|re-?verify|complete|confirm|click|call|share|submit|log ?in|link)\\b"),
  R("अपडेट|सत्यापित|लिंक|क्लिक|कॉल|पूरा|वेरिफाई"),
  R("புதுப்பி|சரிபார்|இணைப்பு|கிளிக்|அழை"),
  onR("update karein", "update kar", "verify karo", "link par", "click karo", "update pannunga", "link la"),
);
const PRIZE = onF(
  R("\\b(?:you (?:have )?won|winner|lottery|lucky draw|prize|jackpot|congratulations)\\b"),
  R("लॉटरी|इनाम|जीत"),
  R("லாட்டரி|பரிசு|வென்"),
  onR("lottery", "inaam", "jeet", "parisu"),
);
const PRIZE_FEE = onF(
  R("\\b(?:pay|send|deposit|transfer)\\b[^.!?\\n]{0,40}\\b(?:fees?|charges?|tax|deposit|amount)\\b|\\b(?:processing|registration|claim|delivery|customs|gst|handling)\\s+(?:fees?|charges?)\\b"),
  R("शुल्क|फीस|चार्ज"),
  R("கட்டணம்|செலுத்து"),
  onR("fee", "charge", "shulk", "kattanam"),
);
const UTILITY_CUT = onF(
  R("\\b(?:electricity|power|gas|water|mobile|sim|connection|number)\\b[^.!?\\n]{0,40}\\b(?:disconnect\\w*|cut|blocked|deactivat\\w*|terminated)\\b"),
  R("बिजली[^।.!?\\n]{0,30}(?:कट|बंद)"),
  R("மின்சாரம்[^.!?\\n]{0,30}(?:துண்டிக்க|நிறுத்த)"),
);
const CALL_OR_PAY = onF(R("\\b(?:call|contact|pay|update|whatsapp)\\b"), R("कॉल|संपर्क|भुगतान|अपडेट"), R("அழை|தொடர்பு|செலுத்து|புதுப்பி"));

const VPA_RAW =/(?<![\w.])[a-z0-9][\w.\-]{1,}@(?!(?:[a-z0-9-]+\.)+[a-z]{2,}\b)[a-z][a-z0-9]{1,15}\b/i;
const VPA_PLACEHOLDER = /\[upi-id(?::personal)?\]/i;
const PERSONAL_PLACEHOLDER = /\[upi-id:personal\]/i;
const PAY_VERB = anyOf(
  onF(R("\\b(?:pay|send|transfer|deposit|remit|upi|gpay|phonepe|paytm)\\b"), R("भेज|जमा|भुगतान|ट्रांसफर|चुका|यूपीआई"), R("அனுப்ப|அனுப்பி|செலுத்த|செலுத்து|போடுங்கள்|யுபிஐ")),
  onR("bhejo", "bhej do", "jama karo", "jama", "payment karo", "seluthunga", "seluthanum", "anuppu", "anuppunga", "anuppi", "bhej"),
);
const ACCOUNT_TARGET = onF(
  R("\\b(?:personal account|a\\/c|account (?:no|number|num)\\.?)\\s*:?\\s*(?:\\d{6,}|\\[number\\])?|\\bmy number\\b|\\bthis number\\b|\\bqr\\b|\\bupi id\\b"),
  R("निजी\\s*खाते|खाता\\s*संख्या|खाता\\s*नंबर"),
  R("தனிப்பட்ட\\s*கணக்கு|கணக்கு\\s*எண்"),
  (x) => onR("personal account", "account number", "account no", "manager ke account")(x),
);
const INVEST_CONTEXT = anyOf(
  onF(R("\\b(?:invest\\w*|scheme|plan|returns?|profit|allotment|ipo|shares?|stake|trading|tips?|registration|register|join|fee|book|booking|processed|deposit)\\b"), R("शेयर|निवेश|मुनाफा|आवंटन|रजिस्ट्रेशन|जुड़|फीस|बुक"), R("பங்கு|முதலீடு|லாபம்|ஒதுக்கீடு|பதிவு|சேர|கட்டணம்|முன்பதிவு")),
  onR("share", "shares", "invest", "munafa", "allotment", "registration", "join", "fee", "laabam", "labam", "jodna", "jud"),
);
const UNLISTED = anyOf(
  onF(
    R("\\b(?:pre[- ]?ipo|unlisted shares?|grey[- ]market|allotment (?:guaranteed|confirmed|sure)|guaranteed allotment|before (?:it )?(?:gets? )?listed|before listing|listing day)\\b"),
    R("प्री\\s*-?\\s*ipo|प्री\\s*आईपीओ|अनलिस्टेड|ग्रे\\s*मार्केट|लिस्टिंग\\s*से\\s*पहले|लिस्टिंग\\s*के\\s*दिन|आवंटन\\s*पक्का"),
    R("ப்ரீ\\s*-?\\s*ipo|முன்\\s*-?\\s*ipo|பட்டியலிடப்படாத|கிரே\\s*மார்க்கெட்|பட்டியலுக்கு\\s*முன்|பட்டியல்\\s*நாளில்|ஒதுக்கீடு\\s*உறுதி"),
  ),
  onR("listing se pehle", "listing ku munnaadi", "listing naal", "listing ke din", "allotment pakka", "allotment urudhi", "unlisted", "grey market", "gray market", "pre ipo"),
);
const OFFER_ACTION = anyOf(
  onF(R("\\b(?:available|offer\\w*|slots?|allot\\w*|buy|invest|pay|transfer|send|book|limited|lots?)\\b"), R("उपलब्ध|ऑफर|आवंटन|भेज|भुगतान|खुला|सीमित|लॉट"), R("கிடைக்கும்|சலுகை|ஒதுக்கீடு|அனுப்பு|செலுத்து|திறந்து|குறைந்த|லாட்")),
  onR("available", "bhejo", "payment karo", "seluthunga", "anuppunga", "kidaikkum", "thirandhirukku", "lots"),
);
const REG_CLAIM = R("\\b(?:sebi[- ]registered|registered (?:with sebi|adviser|advisor)|registration (?:no|number)|sebi reg)\\b|पंजीकरण\\s*(?:नंबर|संख्या)|रजिस्ट्रेशन\\s*नंबर|பதிவு\\s*எண்");

// ---------- newer categories ----------
const FAKE_AUTHORITY: Test = anyOf(
  onF(
    R("\\b(?:(?:sebi|rbi|irdai|nse|bse|government|govt|regulator|ministry|npci)[- ](?:approved|certified|authori[sz]ed|backed|guaranteed|endorsed)|(?:approved|certified|authori[sz]ed|backed|endorsed|guaranteed)\\s+by\\s+(?:the\\s+)?(?:sebi|rbi|irdai|regulator|government|govt)|government[- ]backed|regulator[- ](?:approved|authori[sz]ed))\\b"),
    R("\\b(?:sebi|rbi|irdai)\\s+(?:approved|certified|authori[sz]ed)\\b"),
    R("(?:sebi|rbi|सेबी|आरबीआई)\\s*(?:से\\s*)?(?:स्वीकृत|प्रमाणित|अधिकृत|मान्यता\\s*प्राप्त)|सरकार[- ]?(?:समर्थित|समर्थन)|नियामक\\s*ने\\s*अधिकृत"),
    R("(?:sebi|rbi|செபி|ஆர்பிஐ)\\s*(?:அங்கீகரித்த|சான்றளித்த|அனுமதித்த)|அரசு\\s*ஆதரவு|ஒழுங்குமுறை\\s*அமைப்பு\\s*(?:அங்கீகரித்த|அங்கீகரித்தது)"),
  ),
  onR("sebi approved", "rbi certified", "rbi approved", "sarkar backed", "sarkar-backed", "government backed", "arasu backed", "regulator ne authorise", "regulator authorise", "sebi se swikrit", "sebi se approved"),
);
// "You were selected for a private allocation": a chosen-for verb next to an investment-offer noun.
const SEL_NOUN = "private|confidential|exclusive|wealth|allocation|allotment|scheme|investment|portfolio|batch|programme|program";
const SELECTED_STRONG: Test = anyOf(
  onF(
    R(`\\b(?:selected|chosen|shortlisted|nominated|invited|picked)\\b[^.!?\\n]{0,60}\\b(?:${SEL_NOUN}|offer)\\b`),
    // romanised Hindi / Tamil: "chuna gaya", "shortlist hua", "therndhedukkappattullirgal", "shortlist aagirukku", in either order
    R(`\\b(?:${SEL_NOUN})\\b[^.!?\\n]{0,70}\\b(?:chuna\\s+gaya|shortlist\\s+(?:hua|kiya\\s+gaya|aagi\\w*)|therndhedukk\\w*|select\\w*\\s+(?:hua|aagi\\w*))\\b`),
    R(`\\b(?:chuna\\s+gaya|shortlist\\s+(?:hua|kiya\\s+gaya|aagi\\w*)|therndhedukk\\w*)\\b[^.!?\\n]{0,70}\\b(?:${SEL_NOUN})\\b`),
    R("(?:चुना\\s*गया|चुने\\s*गए|शॉर्टलिस्ट|चयनित)[^।.!?\\n]{0,60}(?:प्राइवेट|गोपनीय|वेल्थ|एलोकेशन|आवंटन|योजना|निवेश)|(?:प्राइवेट|गोपनीय|वेल्थ|एलोकेशन|आवंटन)[^।.!?\\n]{0,60}(?:चुना\\s*गया|शॉर्टलिस्ट)"),
    R("(?:தேர்ந்தெடுக்கப்பட்ட|தேர்வு\\s*செய்யப்பட்ட|பட்டியலிடப்பட்ட)[^.!?\\n]{0,60}(?:தனியார்|ரகசிய|செல்வ|ஒதுக்கீடு|திட்ட|முதலீடு)|(?:தனியார்|ரகசிய|செல்வ|ஒதுக்கீட்டு)[^.!?\\n]{0,60}(?:தேர்ந்தெடுக்கப்பட்ட|பட்டியலிடப்பட்ட)"),
  ),
);
const SELECTED_WEAK: Test = anyOf(
  onF(
    R("\\b(?:by invitation|invitation only|invite[- ]only|invitation (?:par|mattum)|authori[sz]ed representative|relationship manager[^.!?\\n]{0,40}\\b(?:onboard|guide|call|contact|personally|jod\\w*|serp\\w*))\\b"),
    R("अधिकृत\\s*प्रतिनिधि|आमंत्रण\\s*पर|रिलेशनशिप\\s*मैनेजर"),
    R("அங்கீகரிக்கப்பட்ட\\s*பிரதிநிதி|அழைப்பின்\\s*பேரில்|உறவு\\s*மேலாளர்|பிரதிநிதி\\s*சரிபார்ப்பு"),
  ),
);
const FEE_WORD = anyOf(
  onF(
    R("\\b(?:clearance|release|tax|facilitation|withdrawal|activation|unlock|verification)\\s+(?:fee|fees|charge|charges|deposit|payment|amount)\\b"),
    R("\\b(?:fee|deposit|charge|payment)\\b[^.!?\\n]{0,40}\\b(?:release|withdraw|unlock|clear)\\w*\\b|\\bpay\\b[^.!?\\n]{0,40}\\b(?:to release|to withdraw|to unlock|first)\\b"),
    R("क्लियरेंस\\s*शुल्क|टैक्स\\s*क्लियरेंस|सुविधा\\s*शुल्क|रिलीज़?\\s*शुल्क|प्रोसेसिंग\\s*शुल्क|शुल्क\\s*देना|रिलीज़?\\s*कराने|निकालने\\s*के\\s*लिए\\s*पहले"),
    // Tamil is heavily inflected (கட்டணம், கட்டணத்துக்கு), so match the stem கட்டண
    R("அனுமதிக்?\\s*கட்டண|வரி\\s*அனுமதி|வசதிக்?\\s*கட்டண|விடுவிக்க\\s*[\\d,]*\\s*(?:ரூபாய்)?\\s*[^.!?\\n]{0,20}கட்டண|விடுவித்த\\s*பின்|எடுக்க\\s*முதலில்|நிதியை\\s*விடுவிக்க"),
  ),
  onR("clearance fee", "tax clearance", "facilitation fee", "release fee", "release panna", "release karwane", "release ke baad", "release aanadhum", "suvidha shulk", "vasathi kattanam"),
);
const RELEASE_CONTEXT = anyOf(
  onF(R("\\b(?:profits?|gains?|funds?|withdraw\\w*|release|returns?|onboard|refund\\w*|allot\\w*|join)\\b"), R("मुनाफा|लाभ|फंड|निकासी|निकालने|रिलीज|जोड़ेगा|जुड़ने"), R("லாபம்|லாபத்தை|நிதி|எடுக்க|விடுவி|சேர்ப்பார்")),
  onR("profit", "munafa", "laabam", "laabathai", "fund", "release", "withdrawal", "nikalne", "jodega", "serppaar"),
);

// ---------- conversation-level signals ----------
// These are about HOW the message reaches you, not about the investment it pitches. Each is weak on its own, and each is
// ignored unless the message is about money or markets (a family chat that says "join our WhatsApp group" is not a sign).
// A lone one of the first three still makes the result "needs verification" rather than "no known indicators".
const MARKET_WORDS = anyOf(
  onF(
    R("\\b(?:stocks?|shares?|trading|traders?|signals?|profits?|returns?|invest\\w*|ipo|mutual funds?|crypto|forex|intraday|portfolio|demat|sebi|gains?|income|earnings?)\\b"),
    R("शेयर|निवेश|मुनाफा|ट्रेडिंग|सिग्नल|क्रिप्टो|पोर्टफोलियो|आमदनी|रिटर्न"),
    R("பங்கு|முதலீட|லாப|வர்த்தக|சிக்னல்|கிரிப்டோ|போர்ட்ஃபோலியோ|வருமான"),
  ),
  onR("share", "stock", "trading", "munafa", "laabam", "labam", "invest", "profit"),
);
// An unknown sender who says they are YOUR adviser, relationship manager or bank officer. Anyone can type this.
const IMPERSONATE: Test = anyOf(
  onF(
    R("\\b(?:i am|i'?m|this is|am)\\s+(?:now\\s+)?(?:your|the)\\s+(?:new\\s+|dedicated\\s+|personal\\s+|assigned\\s+|senior\\s+)*(?:adviser|advisor|relationship manager|wealth manager|portfolio manager|investment manager|account manager|financial planner|mentor|rm)\\b"),
    R("\\b(?:your|ur)\\s+(?:new\\s+|dedicated\\s+|personal\\s+|assigned\\s+)+(?:relationship manager|wealth manager|adviser|advisor|portfolio manager|financial planner)\\b"),
    R("\\b(?:calling|writing|messaging|contacting)\\s+(?:you\\s+)?(?:on behalf of|from)\\s+(?:your|the)\\s+(?:bank|broker|adviser|advisor|fund house|wealth team|research desk)\\b"),
    R("मैं\\s*आपका\\s*(?:नया\\s*|निजी\\s*)?(?:रिलेशनशिप\\s*मैनेजर|वेल्थ\\s*मैनेजर|एडवाइज़र|एडवाइजर|सलाहकार|पोर्टफोलियो\\s*मैनेजर)"),
    R("நான்\\s*(?:இனி\\s*)?உங்கள்\\s*(?:கணக்கின்\\s*)?(?:புதிய\\s*)?(?:உறவு\\s*மேலாளர்|செல்வ\\s*மேலாளர்|ஆலோசகர்|ரிலேஷன்ஷிப்\\s*மேனேஜர்|வெல்த்\\s*மேனேஜர்|வெல்த்\\s*பார்ட்னர்)"),
  ),
  onF(R("\\b(?:main|mai|mein|naan|nan)\\s+(?:aapka|aapke|apka|ungal)\\s+(?:naya\\s+|nayi\\s+|pudhu\\s+|puthiya\\s+|dedicated\\s+)?(?:relationship manager|wealth manager|wealth partner|advisor|adviser|rm|portfolio manager|financial planner)\\b")),
);
// An invitation to a private / VIP / paid group, or to carry on in a private chat, about markets.
const PRIVATE_CHANNEL: Test = anyOf(
  onF(
    R("\\b(?:join|added?|add you|invite[sd]?|enter|get you into)\\s+(?:you\\s+)?(?:to\\s+|into\\s+)?(?:my|our|the|a|this)\\s+(?:\\w+\\s+){0,2}?(?:private|vip|premium|exclusive|secret|paid|elite|closed|special)\\s+(?:\\w+\\s+){0,2}?(?:group|channel|community|circle|club|chat)\\b"),
    R("\\b(?:private|vip|premium|exclusive|secret|elite|closed)\\s+(?:telegram|whatsapp|signal|discord)?\\s*(?:group|channel|community|circle|club)\\b"),
    R("\\b(?:move|switch|continue|shift|talk|chat|message|dm|text|reach)\\s+(?:to|on|with me on|me on|me at)\\s+(?:telegram|whatsapp|signal|instagram|discord|dm|private(?:ly)?)\\b"),
    R("\\b(?:telegram|whatsapp)\\s+(?:me|us)\\b"),
    R("प्राइवेट\\s*(?:ग्रुप|चैनल)|वीआईपी\\s*(?:ग्रुप|चैनल)|प्रीमियम\\s*ग्रुप|टेलीग्राम\\s*(?:पर|ग्रुप|चैनल)|व्हाट्सएप\\s*ग्रुप\\s*में\\s*जोड़"),
    R("தனியார்\\s*(?:\\S+\\s+){0,3}?(?:குழு|சேனல்)|வி\\.?\\s*ஐ\\.?\\s*பி\\.?\\s*(?:குழு|சேனல்)|பிரீமியம்\\s*குழு|டெலிகிராம்\\s*(?:குழு|சேனல்|இல்|ல்)|வாட்ஸ்அப்\\s*குழுவில்\\s*சேர்"),
  ),
  onR("private group", "vip group", "premium group", "telegram pe", "telegram par", "telegram la", "telegram group", "private channel", "vip channel", "group me add", "group la serkkiren", "group la serthuduren"),
);
// "Pay to our NEW account", "the account changed", "send it to my personal UPI". Only a payment verb makes it count.
const NEW_PAYEE: Test = anyOf(
  onF(
    R("\\b(?:new|newly\\s+(?:created|opened)|changed|updated|different|another|alternate|alternative|temporary|fresh)\\s+(?:\\w+\\s+){0,2}?(?:account|upi(?:\\s+id)?|vpa|bank details|qr(?:\\s+code)?|payment\\s+(?:link|details|number))\\b"),
    R("\\b(?:account|upi|bank details|payment details)\\s+(?:has|have|got)\\s+(?:been\\s+)?(?:changed|updated|shifted|moved)\\b"),
    R("\\b(?:my|his|her|our\\s+(?:agent|manager|executive|rm)'?s?)\\s+(?:personal|private)\\s+(?:account|upi|number|phone number|gpay|paytm|phonepe)\\b"),
    R("नया\\s*(?:खाता|अकाउंट|यूपीआई|क्यूआर)|खाता\\s*बदल|नए\\s*(?:खाते|अकाउंट)|निजी\\s*(?:खाते|यूपीआई)|पर्सनल\\s*(?:अकाउंट|खाते|नंबर)"),
    R("புதிய\\s*(?:கணக்|யுபிஐ|கியூஆர்)|கணக்கு\\s*மாறிவிட்டது|தனிப்பட்ட\\s*(?:கணக்|யுபிஐ|எண்)|பர்சனல்\\s*(?:அக்கவுண்ட்|நம்பர்)"),
  ),
  onF(R("\\b(?:naya|naye|nayi|new|puthiya|pudhu|puthu|pudhiya)\\s+(?:\\w+\\s+)?(?:account|upi|qr)\\b"), R("\\b(?:personal|private)\\s+(?:account|upi)\\b|\\baccount\\s+(?:badal|maara)")),
);
// A promise of certainty WITHOUT the word "guarantee": consistent income, never a losing month, "you will surely earn".
// Written in a separate branch from GUARANTEED on purpose: scammers learn which words get flagged.
const IMPLIED_CERTAINTY: Test = anyOf(
  onF(
    R("\\b(?:consistent|steady|regular|stable|predictable|reliable|dependable|dependably)\\s+(?:\\w+\\s+){0,1}?(?:monthly\\s+|daily\\s+|weekly\\s+)?(?:income|returns?|profits?|payouts?|gains?|earnings?)\\b"),
    R("\\b(?:never|haven'?t|hasn'?t|has not|have not|not once)\\s+(?:had|seen|made|booked|ended)\\s+(?:a\\s+|any\\s+|in\\s+)?(?:loss|losing|negative|red)\\b"),
    R("\\b(?:you will|you'?ll|you can)\\s+(?:definitely|surely|certainly|easily|comfortably|simply)\\s+(?:earn|make|get|see|receive|double)\\b"),
    R("\\b(?:everyone|all (?:our )?members|all clients)\\s+(?:makes?|made|earns?|earned|gets?|got)\\s+(?:profits?|money|returns?)\\b"),
    R("\\b(?:\\d+(?:\\.\\d+)?\\s*%|\\d+x|double|triple)\\s+(?:your\\s+)?(?:money\\s+)?(?:return|returns|profit|growth|in)\\s+(?:in\\s+|within\\s+)?\\d+\\s+(?:days?|weeks?|months?)\\b"),
    R("निश्चित\\s*(?:रूप\\s*से)?\\s*(?:कमाएंगे|कमाओगे|मुनाफा)|हर\\s*महीने\\s*(?:पक्का|तय)\\s*(?:मुनाफा|आमदनी)|कभी\\s*घाटा\\s*नहीं\\s*(?:हुआ|देखा)|स्थिर\\s*आमदनी"),
    R("நிச்சயம்\\s*(?:சம்பாதிப்பீர்கள்|லாபம்)|ஒவ்வொரு\\s*மாதமும்\\s*(?:நிலையான|உறுதியான)\\s*(?:வருமானம்|லாபம்)|ஒருபோதும்\\s*நஷ்டம்\\s*(?:ஆனதில்லை|வந்ததில்லை)|நிலையான\\s*வருமானம்"),
  ),
  onR("pakka munafa", "fix munafa", "kabhi loss nahi", "never loss", "urudhiyana laabam", "nichayam laabam", "nitchayam"),
);

const BARE_GROUP_NAME = /(?:whatsapp|telegram)\s+(?:group|channel)|टेलीग्राम\s*ग्रुप|व्हाट्सएप\s*ग्रुप|டெலிகிராம்\s*(?:குழு|குரூப்)|வாட்ஸ்அப்\s*(?:குழு|குரூப்)/giu;
/** True when the ONLY reason a sentence looks like a signal group is a bare group name ("the office WhatsApp group"). */
const onlyBareGroupName: Test = (x) => SIGNAL_GROUP(x) && !SIGNAL_GROUP({ ...x, f: x.f.replace(BARE_GROUP_NAME, " "), r: x.r.replace(BARE_GROUP_NAME, " ") });

// ---------- detection ----------
export interface Detected {
  hits: Hit[];
  links: LinkFinding[];
  /** Sum of weights before weak-only results are dropped. */
  points: number;
}

const SEV_OF = (w: number): Sev => (w >= 3 ? "high" : w === 2 ? "medium" : "low");
const WEIGHT_OF = (s: Sev) => (s === "high" ? 3 : s === "medium" ? 2 : 1);

export function analyse(text: string): Detected {
  const all = splitSentences(text);
  const live = all.filter((x) => !isWarning(x));
  const out: Hit[] = [];
  const add = (type: FlagType, weight: number, quote: string, claim = false) => {
    const prior = out.find((h) => h.type === type);
    if (prior) {
      if (weight > prior.weight) {
        prior.weight = weight;
        prior.severity = SEV_OF(weight);
        prior.quote = quote;
      }
      return;
    }
    out.push({ type, severity: SEV_OF(weight), quote, weight, claim });
  };
  const first = (t: Test) => live.find(t);

  // simple pattern detectors
  const g = first((x) => GUARANTEED(x) && !NOT_A_PROMISE.test(x.f));
  if (g) add("guaranteed_returns", 3, g.s);
  const ins = first(INSIDER);
  if (ins) add("insider_claim", 3, ins.s);
  const nd = first(NO_DISCLOSURE);
  if (nd) add("missing_disclosure", 3, nd.s);
  const moneyContext = live.some((x) => MARKET_WORDS(x));
  const lev = first(LEVERAGE);
  if (lev) add("leverage", 3, lev.s);
  const pump = first(PUMP);
  if (pump) add("pump_pattern", 3, pump.s);
  const com = first((x) => (COMMISSION(x) || COMMISSION_ROM(x)) && !COMMISSION_NOT.test(x.f));
  if (com) add("commission_conflict", 2, com.s);

  // urgency: strong phrases alone; weak ones only next to a call to act
  const urgent = first((x) => URGENCY_STRONG(x) || (URGENCY_WEAK(x) && SOLICIT(x)));
  if (urgent) add("urgency_pressure", 2, urgent.s);

  // a bare "WhatsApp group" (an office or family group) is a sign only when the message is also about money or markets,
  // or already shows another warning sign. "Join our paid group, only 5 seats left" still counts.
  const sg = first((x) => SIGNAL_GROUP(x) && (moneyContext || out.length > 0 || !onlyBareGroupName(x)));
  if (sg) add("unregistered_signal", 2, sg.s);

  // credentials: an item (OTP, PIN, CVV...) and a request in the same or the next sentence. A sentence that
  // says "never share your PIN" is a warning, not a request.
  for (let i = 0; i < live.length; i++) {
    const x = live[i];
    if (!(CRED_ITEM(x) || CRED_ITEM_ROM(x)) || PROHIBIT(x)) continue;
    const neighbours = [x, live[i + 1], live[i - 1]].filter((n): n is Sentence => !!n && !PROHIBIT(n));
    if (neighbours.some((n) => CRED_ASK(n) || CRED_ASK_ROM(n))) {
      add("credential_request", 3, x.s);
      break;
    }
  }
  const remote = first((x) => REMOTE_ITEM(x) || REMOTE_ROM(x));
  if (remote) add("credential_request", 3, remote.s);

  // account threat + an action, with or without a visible link: "Your KYC will expire, update on this link to avoid suspension".
  const acctThreat = first((x) => ACCT_TOPIC(x) && ACCT_THREAT(x));
  if (acctThreat && live.some(ACCT_ACTION)) add("credential_request", 3, acctThreat.s);
  // "you won" + a fee to claim it
  if (live.some(PRIZE) && live.some(PRIZE_FEE)) add("advance_fee", 3, (first(PRIZE_FEE) ?? first(PRIZE))?.s ?? text.slice(0, 200));
  // a service "will be cut tonight" + call or pay now
  const cut = first(UTILITY_CUT);
  if (cut && live.some(CALL_OR_PAY)) add("urgency_pressure", 2, cut.s);

  // links
  const links = inspectLinks(text);
  const worst = [...links].sort((a, b) => b.score - a.score)[0];
  const lured = live.some(LURE) || live.some(CLICK_WORDS);
  const threat = live.some(THREAT);
  const linkSentence = (l: LinkFinding) => live.find((x) => x.s.includes(l.raw.replace(/[.,;:!?)\]}>'"।]+$/u, ""))) ?? live[0] ?? all[0];
  if (worst) {
    const q = linkSentence(worst)?.s ?? text.slice(0, 280);
    if (worst.level === "high") add("phishing_link", 3, q);
    else if (worst.level === "medium" && lured) add("phishing_link", threat ? 3 : 2, q);
    else if (worst.level === "medium") add("phishing_link", 1, q);
    else if (worst.level === "low" && lured) add("phishing_link", 1, q);
  } else {
    const click = first(CLICK_WORDS);
    if (click && live.some(LURE)) add("phishing_link", 1, click.s);
  }

  // payment to a person: a pay verb with a UPI handle or personal account in the same sentence
  const payee = first((x) => PAY_VERB(x) && (VPA_RAW.test(x.s) || VPA_PLACEHOLDER.test(x.s) || ACCOUNT_TARGET(x)));
  if (payee) {
    const personal = PERSONAL_PLACEHOLDER.test(payee.s);
    const context = live.some(INVEST_CONTEXT) && live.some((x) => /registration|register|join|fee|allot|book|share|invest|munafa|laabam|பதிவு|சேர|கட்டணம்|ஒதுக்கீடு|பங்கு|रजिस्ट्रेशन|जुड़|फीस|आवंटन|शेयर|निवेश|मुनाफा/iu.test(x.f));
    add("payment_to_individual", context ? 3 : personal ? 1 : 0, payee.s);
  }

  const unl = first(UNLISTED);
  if (unl && live.some(OFFER_ACTION)) add("unlisted_offering", 3, unl.s);

  const fake = first(FAKE_AUTHORITY);
  if (fake) add("false_authority", 2, fake.s);

  // conversation-level signals (only when the message is about money or markets)
  const money = moneyContext;
  if (money) {
    const imp = first(IMPERSONATE);
    if (imp) add("impersonation", live.some(SOLICIT) ? 2 : 1, imp.s);
    const priv = first(PRIVATE_CHANNEL);
    if (priv) add("private_channel", 1, priv.s);
    const np = first((x) => NEW_PAYEE(x) && (PAY_VERB(x) || ACCOUNT_TARGET(x) || VPA_RAW.test(x.s)));
    if (np) add("new_payee", 2, np.s);
  }
  // "implied certainty" counts only when the message also asks you to do something, and has no explicit guarantee
  const ic = first((x) => IMPLIED_CERTAINTY(x) && !NOT_A_PROMISE.test(x.f));
  if (ic && live.some(SOLICIT) && !out.some((h) => h.type === "guaranteed_returns")) add("implied_certainty", 1, ic.s);
  const selStrong = first(SELECTED_STRONG);
  const selWeak = first(SELECTED_WEAK);
  if (selStrong) add("exclusive_selection", 2, selStrong.s);
  else if (selWeak) add("exclusive_selection", 1, selWeak.s);
  const fee = first(FEE_WORD);
  if (fee && live.some(RELEASE_CONTEXT)) add("advance_fee", 3, fee.s);

  // "We are SEBI registered" proves nothing. If the message already looks like a pitch, say so.
  const claim = first((x) => REG_CLAIM.test(x.f));
  if (claim && out.some((h) => h.weight >= 2)) add("unregistered_signal", 2, claim.s, true);

  const hits = out.filter((h) => h.weight > 0);
  const points = hits.reduce((a, h) => a + h.weight, 0);
  // several weak signals together are a signal; a lone weak one is not, EXCEPT how-it-reached-you signals: an unknown
  // sender claiming to be your adviser, a private-group invitation or a new payee make the result "needs verification"
  const conversational = hits.some((h) => NEEDS_VERIFICATION.has(h.type));
  return { hits: points >= 2 || conversational ? hits : [], links, points };
}

/** Types that, even alone, mean "not enough evidence either way: verify before acting" rather than "no known indicators". */
export const NEEDS_VERIFICATION: ReadonlySet<string> = new Set(["impersonation", "private_channel", "new_payee"]);

export function detectFlags(text: string): Hit[] {
  return analyse(text).hits;
}

/** The overall level from the flags: any strong sign is high; otherwise points from medium (2) and weak (1) signs add up. */
export function overallOf(flags: { severity: Sev; type?: string }[]): Sev {
  if (flags.some((f) => f.severity === "high")) return "high";
  const points = flags.reduce((a, f) => a + WEIGHT_OF(f.severity), 0);
  if (points >= 6) return "high";
  if (points >= 2) return "medium";
  // a lone weak how-it-reached-you signal is never "no known indicators": default toward verification
  return flags.some((f) => f.type !== undefined && NEEDS_VERIFICATION.has(f.type)) ? "medium" : "low";
}

/** Monthly rate like "3% every month" -> deterministic engine values for placeholders. */
export function monthlyRateIn(text: string): number | null {
  const t = foldDigits(text);
  const m =
    /(\d+(?:\.\d+)?)\s*%\s*(?:every|per|a|each)?\s*(?:month|monthly)\b/i.exec(t) ??
    /\b(?:monthly|every month|per month)\b[^.\d]{0,20}(\d+(?:\.\d+)?)\s*%/i.exec(t) ??
    /(?:हर\s*महीने|प्रति\s*माह|मासिक)\s*(?:में\s*)?(\d+(?:\.\d+)?)\s*%/u.exec(t) ??
    /(\d+(?:\.\d+)?)\s*%\s*(?:हर\s*महीने|प्रति\s*माह|मासिक)/u.exec(t) ??
    /(?:மாதம்|மாதத்துக்கு|மாதத்திற்கு|ஒவ்வொரு\s*மாதமும்|மாதாமாதம்)\s*(\d+(?:\.\d+)?)\s*%/u.exec(t) ??
    /(\d+(?:\.\d+)?)\s*%\s*(?:மாதம்|மாதத்துக்கு|மாதத்திற்கு|ஒவ்வொரு\s*மாதமும்)/u.exec(t) ??
    /\b(?:har\s+mahine|maatham|matham|maadham)\s*(?:me\s*)?(\d+(?:\.\d+)?)\s*%/i.exec(t) ??
    /(\d+(?:\.\d+)?)\s*%\s*(?:har\s+mahine)\b/i.exec(t);
  return m ? parseFloat(m[1]) : null;
}
