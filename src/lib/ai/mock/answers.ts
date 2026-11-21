// Answers to the "Ask a question" box in mock mode. Each is tied to the user's own engine numbers or to
// plain education; none names a security or predicts a market. {{placeholders}} are engine values.
import type { Lang } from "@/types";

export type AnswerKey =
  | "ef" | "insurance" | "debt" | "goal" | "savings" | "score_intro" | "prepay_high" | "prepay_ok" | "term" | "gold"
  | "equity_debt" | "house" | "sip" | "mutual_fund" | "direct_regular" | "diversify" | "inflation" | "fallback";

export const ANSWER_TEXT: Record<Lang, Record<AnswerKey, string>> = {
  en: {
    ef: "Your emergency reserve covers {{ef.months}} months against a target of {{ef.target}}. The plan lists options to close the gap of {{ef.gap}}.",
    insurance: "Your health cover gap is {{ins.health.gap}} and your life cover gap is {{ins.term.gap}}. A reviewer can talk through these in this demo.",
    debt: "Loan payments take {{debt.dti}} of your income. The plan shows how a reviewer may look at repayment.",
    goal: "Goal amounts are shown as a range, because returns are not promised. Open the plan to see each range.",
    savings: "You save about {{save.rate}} of your income, which is {{save.monthly}} a month. How much to save depends on your goals; open your plan to see a monthly range for each goal.",
    score_intro: "Your score is {{health.score}}. The area with the most room right now: ",
    prepay_high:
      "Your highest loan rate is {{debt.highCost.rate}}, above the {{debt.highCost.threshold}} mark, so repaying costly loans is usually looked at first. Keep your emergency reserve intact while you do. A reviewer can compare the options with you.",
    prepay_ok:
      "None of your loans is above the costly mark, and payments take {{debt.dti}} of your income. Many people build the emergency reserve before prepaying a low-cost loan. A reviewer can talk through the trade-off.",
    term: "Term insurance pays a lump sum to your family if you pass away during the term. It has no savings part, so it is usually cheaper than other life covers. How much cover to look at depends on your income and who depends on it. Your life cover gap is {{ins.term.gap}}.",
    gold: "Gold is an asset class, not something to pick. A small share, often discussed in a range of {{alloc.gold.low}} to {{alloc.gold.high}}, can add variety. It earns no income and its price can stay low for long periods. A reviewer can discuss it against your goals.",
    equity_debt:
      "Equity-oriented options may grow more over long periods but can fall sharply along the way. Debt-oriented options are steadier but may grow less. Which mix suits you depends on each goal's time frame, and your plan shows this goal by goal. Returns are never promised.",
    house:
      "That is a big life choice, so I will not decide it for you. You can add a home as a goal, and the plan then shows a monthly range for it. Look at the loan cost, your emergency reserve and any other loans first; a reviewer can talk it through in this demo.",
    sip: "A SIP means investing a fixed amount on a fixed date each month. It spreads your buying over time. Values still move up and down, so start from your goal and time frame.",
    mutual_fund:
      "A mutual fund pools money from many people and invests it across many holdings. Costs, risk and goals differ by scheme, so compare them with a reviewer. See Learn for how regular and direct plans differ.",
    direct_regular:
      "A regular plan has a distributor's commission built into its yearly cost; a direct plan does not. Over many years that cost difference adds up. Open Learn to see an example with the figures worked out.",
    diversify: "Spreading money across asset classes and areas reduces the effect of any single weak spot. Overlapping funds can look like variety but often move together.",
    inflation:
      "Inflation means prices rise over time, so the same money buys less later. Far-off goals may cost more by then. The goal amounts here are not adjusted for inflation, so discuss that with your reviewer.",
    fallback:
      "I am not sure I understood. I can explain your score, emergency fund, insurance, loans, savings and goals, and basics like SIP or mutual funds. I can't pick stocks or predict markets.",
  },
  hi: {
    ef: "आपका आपातकालीन फंड {{ef.months}} महीने का है, जबकि लक्ष्य {{ef.target}} महीने है। योजना में {{ef.gap}} की कमी पूरी करने के विकल्प हैं।",
    insurance: "आपके स्वास्थ्य कवर की कमी {{ins.health.gap}} है और जीवन बीमा की कमी {{ins.term.gap}} है। इस डेमो में रिव्यूअर इन पर बात कर सकता है।",
    debt: "कर्ज़ की किस्तें आपकी आमदनी का {{debt.dti}} लेती हैं। योजना दिखाती है कि रिव्यूअर चुकौती को कैसे देख सकता है।",
    goal: "लक्ष्य की राशि दायरे में दिखती है, क्योंकि रिटर्न का वादा नहीं होता। हर दायरा देखने के लिए योजना खोलें।",
    savings: "आप आमदनी का लगभग {{save.rate}} बचाते हैं, यानी हर महीने {{save.monthly}}। कितनी बचत करनी है, यह आपके लक्ष्यों पर निर्भर है; हर लक्ष्य की मासिक सीमा देखने के लिए अपनी योजना खोलें।",
    score_intro: "आपका स्कोर {{health.score}} है। अभी सबसे ज़्यादा गुंजाइश इस क्षेत्र में है: ",
    prepay_high:
      "आपके कर्ज़ की सबसे ऊँची दर {{debt.highCost.rate}} है, जो {{debt.highCost.threshold}} की सीमा से ऊपर है, इसलिए महंगे कर्ज़ चुकाने पर आमतौर पर पहले ध्यान दिया जाता है। ऐसा करते समय आपातकालीन फंड बनाए रखें। रिव्यूअर विकल्पों की तुलना आपके साथ कर सकता है।",
    prepay_ok:
      "आपका कोई कर्ज़ महंगी सीमा से ऊपर नहीं है, और किस्तें आपकी आमदनी का {{debt.dti}} लेती हैं। कम लागत वाला कर्ज़ जल्दी चुकाने से पहले कई लोग आपातकालीन फंड बनाते हैं। रिव्यूअर इस समझौते पर बात कर सकता है।",
    term: "टर्म बीमा में पॉलिसी अवधि के दौरान आपके न रहने पर परिवार को तय राशि मिलती है। इसमें बचत का हिस्सा नहीं होता, इसलिए यह आमतौर पर दूसरे जीवन बीमा से सस्ता होता है। कितना कवर देखें, यह आपकी आमदनी और आप पर निर्भर लोगों पर टिका है। आपके जीवन कवर की कमी {{ins.term.gap}} है।",
    gold: "सोना एसेट क्लास है, चुनने की चीज़ नहीं। {{alloc.gold.low}} से {{alloc.gold.high}} के दायरे का छोटा हिस्सा विविधता ला सकता है। इससे आय नहीं होती और भाव लंबे समय तक कम रह सकते हैं। रिव्यूअर इसे आपके लक्ष्यों के साथ देख सकता है।",
    equity_debt:
      "इक्विटी-उन्मुख विकल्प लंबी अवधि में ज़्यादा बढ़ सकते हैं, पर रास्ते में तेज़ गिरावट आ सकती है। ऋण-उन्मुख विकल्प ज़्यादा स्थिर हैं, पर कम बढ़ सकते हैं। कौन सा मिश्रण आपके लिए ठीक है, यह हर लक्ष्य की समय-सीमा पर निर्भर है, और आपकी योजना यह लक्ष्य-दर-लक्ष्य दिखाती है। रिटर्न का कोई वादा नहीं है।",
    house:
      "यह जीवन का बड़ा फ़ैसला है, इसलिए मैं आपके लिए इसे तय नहीं करूँगा। आप घर को लक्ष्य के रूप में जोड़ सकते हैं, फिर योजना उसकी मासिक सीमा दिखाती है। पहले कर्ज़ की लागत, आपातकालीन फंड और बाकी कर्ज़ देखें; इस डेमो में रिव्यूअर इस पर बात कर सकता है।",
    sip: "SIP यानी हर महीने तय तारीख को तय रकम निवेश करना। इससे आपकी खरीद समय में बंट जाती है। मूल्य फिर भी ऊपर-नीचे होते हैं, इसलिए अपने लक्ष्य और समय-सीमा से शुरू करें।",
    mutual_fund:
      "म्यूचुअल फंड कई लोगों का पैसा जमा करके उसे कई होल्डिंग्स में लगाता है। लागत, जोखिम और लक्ष्य स्कीम के हिसाब से बदलते हैं, इसलिए रिव्यूअर के साथ तुलना करें। रेगुलर और डायरेक्ट प्लान का अंतर 'सीखें' में देखें।",
    direct_regular:
      "रेगुलर प्लान की सालाना लागत में वितरक का कमीशन जुड़ा होता है; डायरेक्ट में नहीं। कई सालों में यह लागत का अंतर बढ़ता जाता है। आंकड़ों के साथ उदाहरण 'सीखें' में खोलकर देखें।",
    diversify: "अलग-अलग एसेट क्लास और क्षेत्रों में पैसा फैलाने से किसी कमज़ोर जगह का असर घटता है। मेल खाते फंड विविधता जैसे लगते हैं पर अक्सर साथ चलते हैं।",
    inflation:
      "महंगाई का मतलब है कि समय के साथ दाम बढ़ते हैं, इसलिए उतने ही पैसे से बाद में कम चीज़ें मिलती हैं। दूर के लक्ष्यों की लागत तब तक बढ़ सकती है। यहाँ लक्ष्य राशियाँ महंगाई के हिसाब से नहीं बदली गई हैं, इसलिए रिव्यूअर से इस पर बात करें।",
    fallback:
      "मैं ठीक से समझ नहीं पाया। मैं आपका स्कोर, आपातकालीन फंड, बीमा, कर्ज़, बचत और लक्ष्य समझा सकता हूँ, और SIP या म्यूचुअल फंड जैसी बुनियादी बातें भी। मैं शेयर नहीं चुन सकता और बाज़ार का अनुमान नहीं लगा सकता।",
  },
  ta: {
    ef: "உங்கள் அவசர நிதி {{ef.months}} மாதங்களுக்கு; இலக்கு {{ef.target}} மாதங்கள். {{ef.gap}} இடைவெளியை நிரப்பும் வழிகள் திட்டத்தில் உள்ளன.",
    insurance: "உங்கள் மருத்துவக் காப்பீட்டு இடைவெளி {{ins.health.gap}}, ஆயுள் காப்பீட்டு இடைவெளி {{ins.term.gap}}. இந்த டெமோவில் மதிப்பாய்வாளர் இவற்றைப் பேசலாம்.",
    debt: "கடன் தவணைகள் உங்கள் வருமானத்தில் {{debt.dti}} எடுக்கின்றன. திருப்பிச் செலுத்துதலை மதிப்பாய்வாளர் எப்படிப் பார்க்கலாம் என்பதைத் திட்டம் காட்டும்.",
    goal: "வருமானத்துக்கு உறுதி இல்லாததால் இலக்குத் தொகைகள் வரம்பாகக் காட்டப்படுகின்றன. ஒவ்வொரு வரம்பையும் பார்க்கத் திட்டத்தைத் திறக்கவும்.",
    savings: "நீங்கள் வருமானத்தில் சுமார் {{save.rate}} சேமிக்கிறீர்கள், அதாவது மாதம் {{save.monthly}}. எவ்வளவு சேமிக்க வேண்டும் என்பது உங்கள் இலக்குகளைப் பொறுத்தது; ஒவ்வொரு இலக்குக்கும் மாதாந்திர வரம்பைக் காண உங்கள் திட்டத்தைத் திறக்கவும்.",
    score_intro: "உங்கள் ஸ்கோர் {{health.score}}. இப்போது அதிக முன்னேற்ற இடம் உள்ள பகுதி: ",
    prepay_high:
      "உங்கள் கடனின் அதிகபட்ச வட்டி {{debt.highCost.rate}}, இது {{debt.highCost.threshold}} எல்லையை விட அதிகம்; எனவே அதிகச் செலவுள்ள கடன்களைத் திருப்பிச் செலுத்துவது பொதுவாக முதலில் பார்க்கப்படும். அப்போது உங்கள் அவசர நிதியைப் பாதுகாத்து வையுங்கள். மதிப்பாய்வாளர் வழிகளை உங்களுடன் ஒப்பிடலாம்.",
    prepay_ok:
      "உங்கள் கடன்கள் எதுவும் அதிகச் செலவு எல்லையைத் தாண்டவில்லை; தவணைகள் உங்கள் வருமானத்தில் {{debt.dti}} எடுக்கின்றன. குறைந்த வட்டிக் கடனை முன்கூட்டியே செலுத்தும் முன் பலர் அவசர நிதியை உருவாக்குவார்கள். மதிப்பாய்வாளர் இந்தச் சமரசத்தைப் பேசலாம்.",
    term: "டெர்ம் காப்பீடு, பாலிசி காலத்தில் நீங்கள் இல்லாமல் போனால் உங்கள் குடும்பத்துக்கு நிலையான தொகையை வழங்கும். இதில் சேமிப்புப் பகுதி இல்லை, எனவே மற்ற ஆயுள் காப்பீடுகளை விடப் பொதுவாக மலிவு. எவ்வளவு காப்பீடு பார்க்கலாம் என்பது உங்கள் வருமானத்தையும் உங்களை நம்பியிருப்பவர்களையும் பொறுத்தது. உங்கள் ஆயுள் காப்பீட்டு இடைவெளி {{ins.term.gap}}.",
    gold: "தங்கம் ஒரு சொத்து வகை, தேர்ந்தெடுக்க வேண்டிய பொருள் அல்ல. {{alloc.gold.low}} முதல் {{alloc.gold.high}} வரையிலான சிறிய பங்கு வகைமையைச் சேர்க்கலாம். இது வருமானம் தராது; விலை நீண்ட காலம் குறைவாக இருக்கலாம். உங்கள் இலக்குகளுடன் மதிப்பாய்வாளர் இதைப் பார்க்கலாம்.",
    equity_debt:
      "பங்கு-சார்ந்த வழிகள் நீண்ட காலத்தில் அதிகமாக வளரலாம், ஆனால் இடையில் கூர்மையாகச் சரியலாம். கடன்-சார்ந்த வழிகள் நிலையானவை, ஆனால் குறைவாக வளரலாம். எந்தக் கலவை பொருந்தும் என்பது ஒவ்வொரு இலக்கின் கால அளவைப் பொறுத்தது; உங்கள் திட்டம் இதை இலக்கு வாரியாகக் காட்டும். வருமானத்துக்கு உறுதி இல்லை.",
    house:
      "இது வாழ்க்கையின் பெரிய முடிவு, எனவே நான் உங்களுக்காக இதை முடிவு செய்ய மாட்டேன். வீட்டை ஒரு இலக்காகச் சேர்க்கலாம்; திட்டம் அதற்கான மாதாந்திர வரம்பைக் காட்டும். முதலில் கடன் செலவு, அவசர நிதி, மற்ற கடன்களைப் பாருங்கள்; இந்த டெமோவில் மதிப்பாய்வாளர் இதைப் பேசலாம்.",
    sip: "SIP என்றால் ஒவ்வொரு மாதமும் குறிப்பிட்ட தேதியில் குறிப்பிட்ட தொகையை முதலீடு செய்வது. இது உங்கள் வாங்குதலைக் காலத்தில் பரப்பும். மதிப்பு இன்னும் ஏறி இறங்கும், எனவே இலக்கு மற்றும் காலத்திலிருந்து தொடங்குங்கள்.",
    mutual_fund:
      "மியூச்சுவல் ஃபண்ட் பலரின் பணத்தைத் திரட்டி பல முதலீடுகளில் போடும். செலவு, ஆபத்து, இலக்கு திட்டத்துக்குத் திட்டம் மாறும்; எனவே மதிப்பாய்வாளருடன் ஒப்பிடுங்கள். ரெகுலர், டைரக்ட் திட்டங்களின் வேறுபாட்டை 'கற்க' பகுதியில் பாருங்கள்.",
    direct_regular:
      "ரெகுலர் திட்டத்தின் ஆண்டுச் செலவில் விநியோகஸ்தர் கமிஷன் அடங்கியிருக்கும்; டைரக்டில் இல்லை. பல ஆண்டுகளில் இந்தச் செலவு வேறுபாடு சேர்ந்து பெரிதாகும். கணக்கிட்ட எண்களுடன் ஓர் எடுத்துக்காட்டை 'கற்க' பகுதியில் பாருங்கள்.",
    diversify: "வெவ்வேறு சொத்து வகைகளிலும் துறைகளிலும் பணத்தைப் பரப்பினால் எந்தப் பலவீனமான இடத்தின் தாக்கமும் குறையும். ஒத்துப்போகும் ஃபண்டுகள் பன்முகத்தன்மை போலத் தோன்றினாலும் பெரும்பாலும் சேர்ந்தே நகரும்.",
    inflation:
      "பணவீக்கம் என்றால் காலப்போக்கில் விலைகள் உயர்வது; அதனால் அதே பணத்தில் பின்னர் குறைவாகவே வாங்க முடியும். தொலைவிலுள்ள இலக்குகளுக்கு அப்போது செலவு கூடலாம். இங்குள்ள இலக்குத் தொகைகள் பணவீக்கத்துக்கு ஏற்ப மாற்றப்படவில்லை; எனவே மதிப்பாய்வாளருடன் இதைப் பேசுங்கள்.",
    fallback:
      "எனக்கு நன்றாகப் புரியவில்லை. உங்கள் ஸ்கோர், அவசர நிதி, காப்பீடு, கடன்கள், சேமிப்பு, இலக்குகள் மற்றும் SIP, மியூச்சுவல் ஃபண்ட் போன்ற அடிப்படைகளை விளக்க முடியும். பங்குகளைத் தேர்ந்தெடுக்கவோ சந்தையைக் கணிக்கவோ என்னால் முடியாது.",
  },
};
