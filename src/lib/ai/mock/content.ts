// Mock-mode text catalogue (EN / HI / TA). Every string uses {{placeholders}} for figures and
// never contains literal numbers, named securities, or buy/sell/hold language.
// "@" inside a placeholder is replaced with the goal id.
import type { GoalKind, Lang, PlanTopic } from "@/types";

export type L3<T> = Record<Lang, T>;

export const KIND_NAME: L3<Record<GoalKind, string>> = {
  en: { home: "home", education: "education", retirement: "retirement", travel: "travel", wedding: "wedding", other: "life" },
  hi: { home: "घर", education: "शिक्षा", retirement: "रिटायरमेंट", travel: "यात्रा", wedding: "शादी", other: "जीवन" },
  ta: { home: "வீட்டு", education: "கல்வி", retirement: "ஓய்வுக்கால", travel: "பயண", wedding: "திருமண", other: "வாழ்க்கை" },
};

interface TopicText {
  title: string;
  rationale: string;
  risks: string;
  rangeNote?: string;
}

export const TOPIC_TEXT: Record<PlanTopic, L3<TopicText>> = {
  inputs_missing: {
    en: {
      title: "Cannot calculate reliably: we need a few answers first",
      rationale:
        "Cannot calculate reliably: your monthly income or your essential spending is missing, so no figure, ranking or goal amount is shown yet. Add them and the plan can be worked out. Goal amounts wait until then.",
      risks: "A figure built on a missing answer can look precise and still be wrong, so none is shown.",
    },
    hi: {
      title: "भरोसे से गणना नहीं हो सकती: पहले कुछ जवाब चाहिए",
      rationale:
        "भरोसे से गणना नहीं हो सकती: आपकी मासिक आमदनी या ज़रूरी खर्च भरा नहीं है, इसलिए अभी कोई आंकड़ा, क्रम या लक्ष्य की राशि नहीं दिखाई जाती। इन्हें भरें, फिर योजना निकल सकेगी। तब तक लक्ष्य की राशि रुकी रहेगी।",
      risks: "छूटे हुए जवाब पर बना आंकड़ा सटीक दिख सकता है पर गलत हो सकता है, इसलिए कोई नहीं दिखाया गया।",
    },
    ta: {
      title: "நம்பகமாகக் கணக்கிட முடியாது: முதலில் சில பதில்கள் தேவை",
      rationale:
        "நம்பகமாகக் கணக்கிட முடியாது: உங்கள் மாத வருமானம் அல்லது அத்தியாவசியச் செலவு இல்லை, எனவே இப்போது எந்த எண்ணும், வரிசையும், இலக்குத் தொகையும் காட்டப்படாது. அவற்றைச் சேர்த்தால் திட்டத்தைக் கணக்கிடலாம். அதுவரை இலக்குத் தொகைகள் காத்திருக்கும்.",
      risks: "விடுபட்ட பதிலின் மீது கட்டிய எண் துல்லியமாகத் தோன்றினாலும் தவறாக இருக்கலாம்; எனவே எதுவும் காட்டப்படவில்லை.",
    },
  },
  cash_flow: {
    en: {
      title: "Fix your monthly cash flow first",
      rationale:
        "Your spending and loan payments are {{cash.shortfall}} a month more than your income of {{cash.income}}. Until the month adds up, goal amounts are held back and shown as later. Consider listing what could come down or end soon, and talk through your options with your reviewer.",
      risks: "Covering a gap with new borrowing can make it grow. Nothing here is an instruction to repay or to stop any particular loan.",
      rangeNote: "Monthly gap: {{cash.shortfall}}",
    },
    hi: {
      title: "पहले अपना मासिक नकदी-प्रवाह ठीक करें",
      rationale:
        "आपके खर्च और कर्ज़ की किस्तें आपकी आमदनी {{cash.income}} से हर महीने {{cash.shortfall}} ज़्यादा हैं। जब तक महीना पूरा नहीं बैठता, लक्ष्य की राशि रोकी जाती है और 'बाद में' दिखती है। देखें कि कौन-सा खर्च घट सकता है या जल्द खत्म हो सकता है, और अपने रिव्यूअर से विकल्पों पर बात करें।",
      risks: "कमी को नए कर्ज़ से भरने पर वह और बढ़ सकती है। यहाँ कुछ भी किसी खास कर्ज़ को चुकाने या रोकने का निर्देश नहीं है।",
      rangeNote: "मासिक कमी: {{cash.shortfall}}",
    },
    ta: {
      title: "முதலில் உங்கள் மாதாந்திரப் பணப்புழக்கத்தைச் சரிசெய்யுங்கள்",
      rationale:
        "உங்கள் செலவுகளும் கடன் தவணைகளும் உங்கள் வருமானமான {{cash.income}} ஐ விட மாதம் {{cash.shortfall}} அதிகம். மாதம் சரியாகப் பொருந்தும் வரை இலக்குத் தொகைகள் நிறுத்தி வைக்கப்பட்டு 'பின்னர்' என்று காட்டப்படும். எந்தச் செலவு குறையலாம் அல்லது விரைவில் முடியலாம் என்று பட்டியலிடுங்கள்; வாய்ப்புகளைப் பற்றி மதிப்பாய்வாளருடன் பேசுங்கள்.",
      risks: "இடைவெளியைப் புதிய கடனால் நிரப்பினால் அது இன்னும் பெரிதாகலாம். குறிப்பிட்ட கடனைச் செலுத்தவோ நிறுத்தவோ இங்கு எந்த அறிவுறுத்தலும் இல்லை.",
      rangeNote: "மாதாந்திர இடைவெளி: {{cash.shortfall}}",
    },
  },
  cash_tight: {
    en: {
      title: "Make your monthly cash flow roomier first",
      rationale:
        "Only {{cash.surplus}} is left each month after spending and loan payments, which is {{cash.surplusPct}} of your income. That is very thin, so goal amounts are held back and shown as later. Consider where a little more room could come from, and discuss it with your reviewer.",
      risks: "A thin month leaves no room for a surprise bill. Small changes to spending or loan payments can matter more than any investment choice.",
      rangeNote: "Left each month: {{cash.surplus}}",
    },
    hi: {
      title: "पहले अपना मासिक नकदी-प्रवाह थोड़ा खुला करें",
      rationale:
        "खर्च और कर्ज़ की किस्तों के बाद हर महीने सिर्फ़ {{cash.surplus}} बचता है, जो आमदनी का {{cash.surplusPct}} है। यह बहुत कम है, इसलिए लक्ष्य की राशि रोकी जाती है और 'बाद में' दिखती है। सोचें कि थोड़ी और गुंजाइश कहाँ से आ सकती है, और रिव्यूअर से चर्चा करें।",
      risks: "बहुत तंग महीने में अचानक आए बिल के लिए जगह नहीं रहती। खर्च या किस्तों में छोटे बदलाव किसी भी निवेश-चुनाव से ज़्यादा मायने रख सकते हैं।",
      rangeNote: "हर महीने बचता है: {{cash.surplus}}",
    },
    ta: {
      title: "முதலில் மாதாந்திரப் பணப்புழக்கத்தில் கொஞ்சம் இடம் உருவாக்குங்கள்",
      rationale:
        "செலவுகள், கடன் தவணைகளுக்குப் பிறகு மாதம் {{cash.surplus}} மட்டுமே மிஞ்சுகிறது; இது வருமானத்தில் {{cash.surplusPct}}. இது மிகக் குறைவு, எனவே இலக்குத் தொகைகள் நிறுத்தி வைக்கப்பட்டு 'பின்னர்' என்று காட்டப்படும். இன்னும் கொஞ்சம் இடம் எங்கிருந்து வரலாம் என்று யோசித்து, மதிப்பாய்வாளருடன் பேசுங்கள்.",
      risks: "மிகக் குறுகிய மாதத்தில் திடீர்ப் பில்லுக்கு இடமில்லை. செலவு அல்லது தவணைகளில் சிறிய மாற்றங்கள் எந்த முதலீட்டுத் தேர்வையும் விட முக்கியமாகலாம்.",
      rangeNote: "மாதம் மிஞ்சுவது: {{cash.surplus}}",
    },
  },
  loan_load: {
    en: {
      title: "Look at the weight of your loan payments",
      rationale:
        "Loan payments take {{debt.dti}} of your income, above the heavy-load mark of {{debt.dtiMark}}. Goal amounts are held back and shown as later. Consider which payments could come down or end soon, and talk it through with your reviewer.",
      risks: "Changing a loan can have costs and tax effects. This is a planning order for discussion, not an instruction to repay any loan.",
      rangeNote: "Loan payments: {{debt.dti}} of income",
    },
    hi: {
      title: "अपनी कर्ज़ की किस्तों का बोझ देखें",
      rationale:
        "कर्ज़ की किस्तें आपकी आमदनी का {{debt.dti}} लेती हैं, जो भारी बोझ की सीमा {{debt.dtiMark}} से ऊपर है। लक्ष्य की राशि रोकी जाती है और 'बाद में' दिखती है। देखें कि कौन-सी किस्तें घट सकती हैं या जल्द खत्म हो सकती हैं, और रिव्यूअर के साथ बात करें।",
      risks: "कर्ज़ बदलने पर लागत और टैक्स का असर हो सकता है। यह चर्चा के लिए योजना का क्रम है, किसी कर्ज़ को चुकाने का निर्देश नहीं।",
      rangeNote: "कर्ज़ की किस्तें: आमदनी का {{debt.dti}}",
    },
    ta: {
      title: "உங்கள் கடன் தவணைகளின் சுமையைப் பாருங்கள்",
      rationale:
        "கடன் தவணைகள் உங்கள் வருமானத்தில் {{debt.dti}} எடுக்கின்றன; இது கனமான சுமை எல்லையான {{debt.dtiMark}} ஐ விட அதிகம். இலக்குத் தொகைகள் நிறுத்தி வைக்கப்பட்டு 'பின்னர்' என்று காட்டப்படும். எந்தத் தவணைகள் குறையலாம் அல்லது விரைவில் முடியலாம் என்று பார்த்து, மதிப்பாய்வாளருடன் பேசுங்கள்.",
      risks: "கடனை மாற்றினால் செலவு மற்றும் வரி விளைவுகள் இருக்கலாம். இது விவாதத்துக்கான திட்ட வரிசை, எந்தக் கடனையும் செலுத்துவதற்கான அறிவுறுத்தல் அல்ல.",
      rangeNote: "கடன் தவணைகள்: வருமானத்தில் {{debt.dti}}",
    },
  },
  goals_later: {
    en: {
      title: "Your {kind} goal comes after the steps above",
      rationale:
        "The steps above come first, so no monthly amount is shown for this goal yet. In today's money the goal is {{profile.goal.@.targetAmount}}, {{profile.goal.@.years}} years away. Once the steps above are on track, a monthly range will be worked out.",
      risks: "Waiting has a cost for long goals, and a reviewer can talk through the trade-off with you.",
      rangeNote: "Later: held back until the first step is on track",
    },
    hi: {
      title: "आपका {kind} लक्ष्य ऊपर के कदमों के बाद आता है",
      rationale:
        "ऊपर के कदम पहले आते हैं, इसलिए इस लक्ष्य के लिए अभी कोई मासिक राशि नहीं दिखाई गई है। आज के पैसे में लक्ष्य {{profile.goal.@.targetAmount}} का है और {{profile.goal.@.years}} साल दूर है। ऊपर के कदम ठीक होने पर मासिक दायरा निकाला जाएगा।",
      risks: "लंबे लक्ष्यों के लिए इंतज़ार की भी कीमत होती है; रिव्यूअर इस पर आपके साथ बात कर सकता है।",
      rangeNote: "बाद में: पहला कदम ठीक होने तक रुका हुआ",
    },
    ta: {
      title: "உங்கள் {kind} இலக்கு மேலுள்ள படிகளுக்குப் பிறகு வருகிறது",
      rationale:
        "மேலுள்ள படிகள் முதலில் வருவதால், இந்த இலக்குக்கு இப்போது மாதாந்திரத் தொகை காட்டப்படவில்லை. இன்றைய பணத்தில் இலக்கு {{profile.goal.@.targetAmount}}, {{profile.goal.@.years}} ஆண்டுகள் தொலைவில் உள்ளது. மேலுள்ள படிகள் சரியானதும் மாதாந்திர வரம்பு கணக்கிடப்படும்.",
      risks: "நீண்ட இலக்குகளுக்குக் காத்திருப்புக்கும் விலை உண்டு; மதிப்பாய்வாளர் இதைப் பற்றி உங்களுடன் பேசலாம்.",
      rangeNote: "பின்னர்: முதல் படி சரியாகும் வரை நிறுத்தி வைக்கப்பட்டுள்ளது",
    },
  },
  emergency_reserve: {
    en: {
      title: "Build your emergency reserve",
      rationale:
        "You have {{ef.months}} months of essential costs saved. A common target for your income pattern is {{ef.target}} months. Consider building a reserve in liquid, low-risk instruments to close the gap of {{ef.gap}}.",
      risks: "Liquid options earn modest returns. Keeping this money apart from investments helps you avoid a rush for cash.",
      rangeNote: "Gap to target: {{ef.gap}}",
    },
    hi: {
      title: "अपना आपातकालीन फंड बनाएं",
      rationale:
        "आपके पास ज़रूरी खर्च के {{ef.months}} महीने की बचत है। आपकी आमदनी के हिसाब से सामान्य लक्ष्य {{ef.target}} महीने है। {{ef.gap}} की कमी पूरी करने के लिए तरल, कम जोखिम वाले विकल्पों में रिज़र्व बनाने पर विचार करें।",
      risks: "तरल विकल्पों पर रिटर्न कम होता है। इस पैसे को निवेश से अलग रखने से अचानक नकदी की हड़बड़ी नहीं होती।",
      rangeNote: "लक्ष्य तक कमी: {{ef.gap}}",
    },
    ta: {
      title: "உங்கள் அவசர நிதியை உருவாக்குங்கள்",
      rationale:
        "அத்தியாவசிய செலவுகளுக்கான {{ef.months}} மாதங்களுக்கு சேமிப்பு உங்களிடம் உள்ளது. உங்கள் வருமான முறைக்கு பொதுவான இலக்கு {{ef.target}} மாதங்கள். {{ef.gap}} இடைவெளியை நிரப்ப, எளிதில் எடுக்கக்கூடிய, குறைந்த ஆபத்துள்ள வழிகளில் இருப்பை உருவாக்குவதைப் பரிசீலிக்கலாம்.",
      risks: "எளிதில் எடுக்கக்கூடிய வழிகளில் வருமானம் குறைவு. இந்தப் பணத்தை முதலீடுகளிலிருந்து தனியாக வைத்தால் திடீர் பண நெருக்கடி வராது.",
      rangeNote: "இலக்குக்கான இடைவெளி: {{ef.gap}}",
    },
  },
  high_cost_debt: {
    en: {
      title: "Pay down costly loans first",
      rationale:
        "Your highest loan rate is {{debt.highCost.rate}}, above the {{debt.highCost.threshold}} mark. Loans like this can cost more than safe options earn. Consider a repayment plan for them before adding new investments.",
      risks: "Repaying early can reduce your cash on hand. Keep your emergency reserve intact while you repay.",
      rangeNote: "Monthly loan payments are {{debt.dti}} of your income",
    },
    hi: {
      title: "पहले महंगे कर्ज़ चुकाएं",
      rationale:
        "आपके कर्ज़ की सबसे ऊँची दर {{debt.highCost.rate}} है, जो {{debt.highCost.threshold}} की सीमा से ऊपर है। ऐसे कर्ज़ की लागत सुरक्षित विकल्पों की कमाई से ज़्यादा हो सकती है। नए निवेश से पहले इनके लिए चुकौती योजना पर विचार करें।",
      risks: "जल्दी चुकाने से हाथ में नकदी घट सकती है। चुकाते समय अपना आपातकालीन फंड बनाए रखें।",
      rangeNote: "मासिक किस्तें आपकी आमदनी का {{debt.dti}} हैं",
    },
    ta: {
      title: "முதலில் அதிக வட்டிக் கடன்களைக் குறைக்கவும்",
      rationale:
        "உங்கள் கடனின் அதிகபட்ச வட்டி {{debt.highCost.rate}}, இது {{debt.highCost.threshold}} என்ற எல்லையை விட அதிகம். இத்தகைய கடன்களுக்கான செலவு பாதுகாப்பான வழிகளின் வருமானத்தை விட அதிகமாக இருக்கலாம். புதிய முதலீடுகளுக்கு முன் இவற்றுக்கான திருப்பிச் செலுத்தும் திட்டத்தைப் பரிசீலிக்கலாம்.",
      risks: "முன்கூட்டியே செலுத்தினால் கையிருப்பு குறையலாம். செலுத்தும்போது உங்கள் அவசர நிதியைப் பாதுகாத்து வையுங்கள்.",
      rangeNote: "மாதாந்திர கடன் தவணைகள் உங்கள் வருமானத்தில் {{debt.dti}}",
    },
  },
  term_cover: {
    en: {
      title: "Check your life cover",
      rationale:
        "People depend on your income. Different views give a starting point for discussion: about {{ins.term.byIncome}} from your income, and about {{ins.term.byNeeds}} from your loans plus some years of your family's essential costs. The larger, {{ins.term.needed}}, is used. You have {{ins.term.cover}}, so the gap is {{ins.term.gap}}.",
      risks: "Needs change as life changes. Cover through an employer is not counted unless you enter it. Compare features, waiting periods and exclusions with your reviewer; this demo names no insurer.",
      rangeNote: "For discussion: cover near {{ins.term.needed}}",
    },
    hi: {
      title: "अपना जीवन बीमा कवर जांचें",
      rationale:
        "आपकी आमदनी पर परिवार निर्भर है। अलग-अलग नज़रिए चर्चा के लिए शुरुआती बिंदु देते हैं: आपकी आमदनी से लगभग {{ins.term.byIncome}}, और आपके कर्ज़ तथा परिवार के कुछ सालों के ज़रूरी खर्च से लगभग {{ins.term.byNeeds}}। इनमें जो बड़ा है, {{ins.term.needed}}, वही लिया गया है। आपके पास {{ins.term.cover}} है, यानी कमी {{ins.term.gap}} है।",
      risks: "ज़रूरतें जीवन के साथ बदलती हैं। नियोक्ता के ज़रिए मिला कवर तब तक नहीं गिना जाता जब तक आप उसे न भरें। फीचर, प्रतीक्षा अवधि और अपवाद रिव्यूअर के साथ देखें; यह डेमो किसी बीमा कंपनी का नाम नहीं लेता।",
      rangeNote: "चर्चा के लिए: कवर लगभग {{ins.term.needed}}",
    },
    ta: {
      title: "உங்கள் ஆயுள் காப்பீட்டைச் சரிபார்க்கவும்",
      rationale:
        "உங்கள் வருமானத்தையே குடும்பம் நம்பியுள்ளது. வெவ்வேறு பார்வைகள் விவாதத்துக்கான தொடக்கப் புள்ளியைத் தருகின்றன: உங்கள் வருமானத்திலிருந்து சுமார் {{ins.term.byIncome}}, உங்கள் கடன்களும் குடும்பத்தின் சில ஆண்டு அத்தியாவசியச் செலவுகளும் சேர்ந்து சுமார் {{ins.term.byNeeds}}. இதில் பெரியதான {{ins.term.needed}} எடுத்துக்கொள்ளப்பட்டது. உங்களிடம் {{ins.term.cover}} உள்ளது, எனவே இடைவெளி {{ins.term.gap}}.",
      risks: "வாழ்க்கை மாறும்போது தேவைகளும் மாறும். முதலாளி மூலம் கிடைக்கும் காப்பீட்டை நீங்கள் உள்ளிடாவிட்டால் அது கணக்கில் சேராது. அம்சங்கள், காத்திருப்புக் காலம், விலக்குகளை மதிப்பாய்வாளருடன் ஒப்பிடுங்கள்; இந்த டெமோ எந்த நிறுவனத்தின் பெயரையும் குறிப்பிடாது.",
      rangeNote: "விவாதத்துக்கு: காப்பீடு சுமார் {{ins.term.needed}}",
    },
  },
  health_cover: {
    en: {
      title: "Check your health cover",
      rationale:
        "A family of your size in your city may look at cover near {{ins.health.needed}}. You have {{ins.health.cover}}, so the gap is {{ins.health.gap}}.",
      risks: "Hospital costs differ by city and treatment. Most policies have waiting periods and exclusions.",
      rangeNote: "For discussion: cover near {{ins.health.needed}}",
    },
    hi: {
      title: "अपना स्वास्थ्य बीमा कवर जांचें",
      rationale:
        "आपके शहर में आपके परिवार के आकार के लिए {{ins.health.needed}} के आसपास का कवर देखा जा सकता है। आपके पास {{ins.health.cover}} है, यानी कमी {{ins.health.gap}} है।",
      risks: "अस्पताल का खर्च शहर और इलाज के हिसाब से बदलता है। ज़्यादातर पॉलिसियों में प्रतीक्षा अवधि और अपवाद होते हैं।",
      rangeNote: "चर्चा के लिए: कवर लगभग {{ins.health.needed}}",
    },
    ta: {
      title: "உங்கள் மருத்துவக் காப்பீட்டைச் சரிபார்க்கவும்",
      rationale:
        "உங்கள் நகரத்தில் உங்கள் குடும்ப அளவுக்கு {{ins.health.needed}} அருகிலான காப்பீட்டைப் பார்க்கலாம். உங்களிடம் {{ins.health.cover}} உள்ளது, எனவே இடைவெளி {{ins.health.gap}}.",
      risks: "மருத்துவமனைச் செலவு நகரம் மற்றும் சிகிச்சைக்கேற்ப மாறும். பெரும்பாலான பாலிசிகளில் காத்திருப்புக் காலமும் விலக்குகளும் உண்டு.",
      rangeNote: "விவாதத்துக்கு: காப்பீடு சுமார் {{ins.health.needed}}",
    },
  },
  speculation_guard: {
    en: {
      title: "Keep tip-based buying in check",
      rationale:
        "You told us you follow tips from social media. Consider setting a small, fixed limit for speculative money, and fund your goals first.",
      risks: "Tips often hide who gains from your trade. Losses on speculation can delay your goals.",
    },
    hi: {
      title: "टिप पर आधारित ख़रीदारी पर लगाम रखें",
      rationale:
        "आपने बताया कि आप सोशल मीडिया की टिप्स देखते हैं। सट्टे वाले पैसे के लिए छोटी, तय सीमा रखने पर विचार करें और पहले अपने लक्ष्यों के लिए बचत करें।",
      risks: "टिप्स में अक्सर छिपा होता है कि आपके सौदे से किसे फ़ायदा है। सट्टे का नुकसान आपके लक्ष्यों को टाल सकता है।",
    },
    ta: {
      title: "டிப்ஸ் அடிப்படையிலான முதலீட்டைக் கட்டுப்படுத்துங்கள்",
      rationale:
        "சமூக ஊடக டிப்ஸைப் பின்பற்றுவதாகச் சொன்னீர்கள். ஊகத்துக்கான பணத்துக்கு சிறிய, நிலையான வரம்பு வைப்பதைப் பரிசீலிக்கலாம்; முதலில் உங்கள் இலக்குகளுக்கு நிதி ஒதுக்குங்கள்.",
      risks: "டிப்ஸ்களில் உங்கள் வர்த்தகத்தால் யாருக்கு லாபம் என்பது மறைந்திருக்கும். ஊகத்தில் ஏற்படும் இழப்பு உங்கள் இலக்குகளைத் தாமதப்படுத்தும்.",
    },
  },
  goal_short: {
    en: {
      title: "Plan for your {kind} goal",
      rationale:
        "This goal is {{profile.goal.@.years}} years away, which is fairly near. Lower-risk, debt-oriented options may suit it. Depending on returns, the monthly amount may range from {{goal.@.sip.high}} to {{goal.@.sip.low}}. In today's money the goal is {{profile.goal.@.targetAmount}}; by the goal date it may cost about {{goal.@.future.base}}.",
      risks: "Returns are not promised. Short goals can be hurt by sudden falls, so safety matters more than growth.",
      rangeNote: "Range for discussion: {{goal.@.sip.high}} to {{goal.@.sip.low}} a month. Taxes are not included.",
    },
    hi: {
      title: "अपने {kind} लक्ष्य की योजना",
      rationale:
        "यह लक्ष्य {{profile.goal.@.years}} साल दूर है, यानी काफ़ी नज़दीक। कम जोखिम वाले, ऋण-आधारित विकल्प इसके लिए उपयुक्त हो सकते हैं। रिटर्न के हिसाब से मासिक राशि {{goal.@.sip.high}} से {{goal.@.sip.low}} तक हो सकती है। आज के पैसे में लक्ष्य {{profile.goal.@.targetAmount}} है; लक्ष्य की तारीख तक इसकी लागत लगभग {{goal.@.future.base}} हो सकती है।",
      risks: "रिटर्न का कोई वादा नहीं है। छोटे लक्ष्य अचानक गिरावट से प्रभावित हो सकते हैं, इसलिए यहाँ सुरक्षा बढ़त से ज़्यादा मायने रखती है।",
      rangeNote: "चर्चा के लिए दायरा: हर महीने {{goal.@.sip.high}} से {{goal.@.sip.low}}। टैक्स शामिल नहीं है।",
    },
    ta: {
      title: "உங்கள் {kind} இலக்குக்கான திட்டம்",
      rationale:
        "இந்த இலக்கு {{profile.goal.@.years}} ஆண்டுகள் தொலைவில் உள்ளது, அதாவது மிக அருகில். குறைந்த ஆபத்துள்ள, கடன்சார்ந்த வழிகள் பொருந்தலாம். வருமானத்தைப் பொறுத்து மாதாந்திரத் தொகை {{goal.@.sip.high}} முதல் {{goal.@.sip.low}} வரை இருக்கலாம். இன்றைய பணத்தில் இலக்கு {{profile.goal.@.targetAmount}}; இலக்குத் தேதியில் இதற்கு சுமார் {{goal.@.future.base}} செலவாகலாம்.",
      risks: "வருமானத்துக்கு உறுதி இல்லை. குறுகிய இலக்குகள் திடீர் வீழ்ச்சியால் பாதிக்கப்படலாம், எனவே இங்கு வளர்ச்சியை விட பாதுகாப்பே முக்கியம்.",
      rangeNote: "விவாதத்துக்கான வரம்பு: மாதம் {{goal.@.sip.high}} முதல் {{goal.@.sip.low}} வரை. வரி சேர்க்கப்படவில்லை.",
    },
  },
  goal_mid: {
    en: {
      title: "Plan for your {kind} goal",
      rationale:
        "This goal is {{profile.goal.@.years}} years away. A balanced mix of equity-oriented and debt options may suit this horizon. Depending on returns, the monthly amount may range from {{goal.@.sip.high}} to {{goal.@.sip.low}}. In today's money the goal is {{profile.goal.@.targetAmount}}; by the goal date it may cost about {{goal.@.future.base}}.",
      risks: "Values can dip for a while in volatile markets. Returns are not promised.",
      rangeNote: "Range for discussion: {{goal.@.sip.high}} to {{goal.@.sip.low}} a month. Taxes are not included.",
    },
    hi: {
      title: "अपने {kind} लक्ष्य की योजना",
      rationale:
        "यह लक्ष्य {{profile.goal.@.years}} साल दूर है। इस अवधि के लिए इक्विटी-उन्मुख और ऋण विकल्पों का संतुलित मिश्रण उपयुक्त हो सकता है। रिटर्न के हिसाब से मासिक राशि {{goal.@.sip.high}} से {{goal.@.sip.low}} तक हो सकती है। आज के पैसे में लक्ष्य {{profile.goal.@.targetAmount}} है; लक्ष्य की तारीख तक इसकी लागत लगभग {{goal.@.future.base}} हो सकती है।",
      risks: "बाज़ार के उतार-चढ़ाव में कुछ समय के लिए मूल्य घट सकता है। रिटर्न का कोई वादा नहीं है।",
      rangeNote: "चर्चा के लिए दायरा: हर महीने {{goal.@.sip.high}} से {{goal.@.sip.low}}। टैक्स शामिल नहीं है।",
    },
    ta: {
      title: "உங்கள் {kind} இலக்குக்கான திட்டம்",
      rationale:
        "இந்த இலக்கு {{profile.goal.@.years}} ஆண்டுகள் தொலைவில் உள்ளது. இந்தக் காலத்துக்கு பங்கு-சார்ந்த மற்றும் கடன் வழிகளின் சமநிலைக் கலவை பொருந்தலாம். வருமானத்தைப் பொறுத்து மாதாந்திரத் தொகை {{goal.@.sip.high}} முதல் {{goal.@.sip.low}} வரை இருக்கலாம். இன்றைய பணத்தில் இலக்கு {{profile.goal.@.targetAmount}}; இலக்குத் தேதியில் இதற்கு சுமார் {{goal.@.future.base}} செலவாகலாம்.",
      risks: "சந்தை ஏற்ற இறக்கத்தில் மதிப்பு சிறிது காலம் குறையலாம். வருமானத்துக்கு உறுதி இல்லை.",
      rangeNote: "விவாதத்துக்கான வரம்பு: மாதம் {{goal.@.sip.high}} முதல் {{goal.@.sip.low}} வரை. வரி சேர்க்கப்படவில்லை.",
    },
  },
  goal_long: {
    en: {
      title: "Plan for your {kind} goal",
      rationale:
        "This goal is {{profile.goal.@.years}} years away. An equity-oriented allocation may suit a goal this far out. Depending on returns, the monthly amount may range from {{goal.@.sip.high}} to {{goal.@.sip.low}}. In today's money the goal is {{profile.goal.@.targetAmount}}; by the goal date it may cost about {{goal.@.future.base}}.",
      risks: "Equity can see large falls along the way. Returns are not promised; the range is for discussion only.",
      rangeNote: "Range for discussion: {{goal.@.sip.high}} to {{goal.@.sip.low}} a month. Taxes are not included.",
    },
    hi: {
      title: "अपने {kind} लक्ष्य की योजना",
      rationale:
        "यह लक्ष्य {{profile.goal.@.years}} साल दूर है। इतने लंबे समय के लिए इक्विटी-उन्मुख आवंटन उपयुक्त हो सकता है। रिटर्न के हिसाब से मासिक राशि {{goal.@.sip.high}} से {{goal.@.sip.low}} तक हो सकती है। आज के पैसे में लक्ष्य {{profile.goal.@.targetAmount}} है; लक्ष्य की तारीख तक इसकी लागत लगभग {{goal.@.future.base}} हो सकती है।",
      risks: "इक्विटी में बीच-बीच में बड़ी गिरावट आ सकती है। रिटर्न का कोई वादा नहीं है; यह दायरा सिर्फ़ चर्चा के लिए है।",
      rangeNote: "चर्चा के लिए दायरा: हर महीने {{goal.@.sip.high}} से {{goal.@.sip.low}}। टैक्स शामिल नहीं है।",
    },
    ta: {
      title: "உங்கள் {kind} இலக்குக்கான திட்டம்",
      rationale:
        "இந்த இலக்கு {{profile.goal.@.years}} ஆண்டுகள் தொலைவில் உள்ளது; இவ்வளவு நீண்ட காலத்துக்கு பங்கு-சார்ந்த ஒதுக்கீடு பொருந்தலாம். வருமானத்தைப் பொறுத்து மாதாந்திரத் தொகை {{goal.@.sip.high}} முதல் {{goal.@.sip.low}} வரை இருக்கலாம். இன்றைய பணத்தில் இலக்கு {{profile.goal.@.targetAmount}}; இலக்குத் தேதியில் இதற்கு சுமார் {{goal.@.future.base}} செலவாகலாம்.",
      risks: "பங்குச் சந்தையில் இடையிடையே பெரிய வீழ்ச்சி வரலாம். வருமானத்துக்கு உறுதி இல்லை; வரம்பு விவாதத்துக்கு மட்டுமே.",
      rangeNote: "விவாதத்துக்கான வரம்பு: மாதம் {{goal.@.sip.high}} முதல் {{goal.@.sip.low}} வரை. வரி சேர்க்கப்படவில்லை.",
    },
  },
  diversify: {
    en: {
      title: "Spread your portfolio wider",
      rationale:
        "About {{conc.topSector}} of your portfolio sits in your largest sector. A wider spread across asset classes may reduce the effect of any single weak area.",
      risks: "Overlapping funds can feel like variety but often move together. Changing holdings can bring tax and cost effects.",
    },
    hi: {
      title: "पोर्टफोलियो को ज़्यादा फैलाएं",
      rationale:
        "आपके पोर्टफोलियो का लगभग {{conc.topSector}} हिस्सा सबसे बड़े क्षेत्र में है। अलग-अलग एसेट क्लास में फैलाव किसी कमज़ोर क्षेत्र का असर घटा सकता है।",
      risks: "मेल खाते फंड विविधता जैसे लगते हैं, पर अक्सर साथ-साथ चलते हैं। होल्डिंग बदलने पर टैक्स और लागत का असर हो सकता है।",
    },
    ta: {
      title: "உங்கள் போர்ட்ஃபோலியோவை விரிவாக்குங்கள்",
      rationale:
        "உங்கள் போர்ட்ஃபோலியோவில் சுமார் {{conc.topSector}} மிகப்பெரிய துறையில் உள்ளது. வெவ்வேறு சொத்து வகைகளில் பரவலாக்கினால் பலவீனமான பிரிவின் தாக்கம் குறையலாம்.",
      risks: "ஒத்துப்போகும் ஃபண்டுகள் பன்முகத்தன்மை போலத் தோன்றினாலும் பெரும்பாலும் சேர்ந்தே நகரும். முதலீடுகளை மாற்றினால் வரி மற்றும் செலவு விளைவுகள் இருக்கலாம்.",
    },
  },
  gold_balance: {
    en: {
      title: "Consider a small gold share",
      rationale:
        "Your portfolio holds no gold. A small share, often discussed in a range of {{alloc.gold.low}} to {{alloc.gold.high}}, can add variety. This is for discussion only.",
      risks: "Gold prices can stay low for long periods, and gold earns no income.",
      rangeNote: "Range for discussion: {{alloc.gold.low}} to {{alloc.gold.high}}",
    },
    hi: {
      title: "थोड़ा सोना रखने पर विचार करें",
      rationale:
        "आपके पोर्टफोलियो में सोना नहीं है। {{alloc.gold.low}} से {{alloc.gold.high}} के दायरे का छोटा हिस्सा विविधता ला सकता है; यह सिर्फ़ चर्चा के लिए है।",
      risks: "सोने की कीमतें लंबे समय तक कम रह सकती हैं और सोने से आय नहीं होती।",
      rangeNote: "चर्चा के लिए दायरा: {{alloc.gold.low}} से {{alloc.gold.high}}",
    },
    ta: {
      title: "சிறிதளவு தங்கத்தைப் பரிசீலிக்கவும்",
      rationale:
        "உங்கள் போர்ட்ஃபோலியோவில் தங்கம் இல்லை. {{alloc.gold.low}} முதல் {{alloc.gold.high}} வரையிலான சிறிய பங்கு வகைமையைச் சேர்க்கலாம்; இது விவாதத்துக்கு மட்டுமே.",
      risks: "தங்க விலை நீண்ட காலம் குறைவாகவே இருக்கலாம்; தங்கம் வருமானம் தராது.",
      rangeNote: "விவாதத்துக்கான வரம்பு: {{alloc.gold.low}} முதல் {{alloc.gold.high}} வரை",
    },
  },
};

export const PLAN_STATIC: L3<{ summary: string; summaryBlocked: string; checklist: string[]; adviserQuestions: string[] }> = {
  en: {
    summaryBlocked:
      "This is a first draft built from your answers. It is AI-prepared and not final. The step that needs work first is shown first, and goal amounts are held back as later. A reviewer checks it in this demo.",
    summary:
      "This is a first draft built from your answers. It is AI-prepared and not final. A reviewer checks it in this demo before you see a reviewed version.",
    checklist: ["Confirm your answers are correct", "Talk through the priorities with the reviewer", "Decide what feels comfortable for you"],
    adviserQuestions: ["Is the income pattern captured correctly?", "Are big expenses coming up soon?", "Is the family situation up to date?"],
  },
  hi: {
    summaryBlocked:
      "यह आपके जवाबों से बना शुरुआती मसौदा है। इसे AI ने तैयार किया है और यह अंतिम नहीं है। जिस कदम पर पहले काम चाहिए वह सबसे ऊपर है, और लक्ष्य की राशि 'बाद में' के लिए रोकी गई है। इस डेमो में रिव्यूअर इसे जांचता है।",
    summary:
      "यह आपके जवाबों से बना शुरुआती मसौदा है। इसे AI ने तैयार किया है और यह अंतिम नहीं है। इस डेमो में रिव्यूअर इसे जांचता है, उसके बाद आपको समीक्षित संस्करण दिखता है।",
    checklist: ["जांचें कि आपके जवाब सही हैं", "रिव्यूअर के साथ प्राथमिकताओं पर बात करें", "तय करें कि आपके लिए क्या सहज है"],
    adviserQuestions: ["क्या आमदनी का स्वरूप सही दर्ज है?", "क्या जल्द ही बड़े खर्च आने वाले हैं?", "क्या परिवार की स्थिति अद्यतन है?"],
  },
  ta: {
    summaryBlocked:
      "இது உங்கள் பதில்களிலிருந்து உருவான முதல் வரைவு. இதை AI தயாரித்தது, இது இறுதியானது அல்ல. முதலில் கவனிக்க வேண்டிய படி முதலில் காட்டப்பட்டுள்ளது; இலக்குத் தொகைகள் 'பின்னர்' என்று நிறுத்தி வைக்கப்பட்டுள்ளன. இந்த டெமோவில் மதிப்பாய்வாளர் இதைச் சரிபார்க்கிறார்.",
    summary:
      "இது உங்கள் பதில்களிலிருந்து உருவான முதல் வரைவு. இதை AI தயாரித்தது, இது இறுதியானது அல்ல. இந்த டெமோவில் மதிப்பாய்வாளர் இதைச் சரிபார்த்த பிறகே மதிப்பாய்வு செய்யப்பட்ட பதிப்பு தெரியும்.",
    checklist: ["உங்கள் பதில்கள் சரியா என்று உறுதிசெய்யுங்கள்", "முன்னுரிமைகளை மதிப்பாய்வாளருடன் பேசுங்கள்", "உங்களுக்கு வசதியானதை முடிவு செய்யுங்கள்"],
    adviserQuestions: ["வருமான முறை சரியாகப் பதிவாகியுள்ளதா?", "விரைவில் பெரிய செலவுகள் வருமா?", "குடும்ப நிலை புதுப்பிக்கப்பட்டதா?"],
  },
};

export const FINDING_TEXT: L3<Record<string, string>> = {
  en: {
    cannot: "Cannot calculate reliably: your monthly income and essential spending are needed first. No figure or goal amount is shown until then.",
    cash_short: "After essentials, other spending and loan payments you are {{cash.shortfall}} short each month. Goal amounts are held back until the month adds up.",
    cash_tight: "After essentials, other spending and loan payments only {{cash.surplus}} is left each month, {{cash.surplusPct}} of income. Goal amounts are held back until there is more room.",
    cash_ok: "After essentials, other spending and loan payments {{cash.surplus}} is left each month, {{cash.surplusPct}} of income.",
    goals_later: "Goal amounts come after the first step on your ladder, so none is shown yet.",
    score: "Your health score is {{health.score}}. It is a simple summary of the cards below, not a rating of you.",
    ef_ok: "You have {{ef.months}} months of essential costs saved, which meets the target of {{ef.target}} months.",
    ef_low: "You have {{ef.months}} months of essential costs saved. The target is {{ef.target}} months, a gap of {{ef.gap}}.",
    term_none: "Nobody depends on your income right now, so life cover is a lower priority.",
    term_ok: "Your life cover of {{ins.term.cover}} is at or above the starting point of {{ins.term.needed}}.",
    term_gap: "You have life cover of {{ins.term.cover}} against a starting point of {{ins.term.needed}}, a gap of {{ins.term.gap}}.",
    health_ok: "Your health cover of {{ins.health.cover}} meets the starting point of {{ins.health.needed}}.",
    health_gap: "You have health cover of {{ins.health.cover}} against a starting point of {{ins.health.needed}}, a gap of {{ins.health.gap}}.",
    debt_none: "You reported no loans. That keeps your monthly load light.",
    debt_ok: "Loan payments take {{debt.dti}} of your income, and none of your loans are in the costly range.",
    debt_high: "Loan payments take {{debt.dti}} of your income, and your highest rate is {{debt.highCost.rate}}, above the {{debt.highCost.threshold}} mark.",
    savings: "You save about {{save.rate}} of your income, which is {{save.monthly}} a month.",
    goals: "For your goal, the monthly amount may range from {{goal.@.sip.high}} to {{goal.@.sip.low}} depending on returns and inflation, which are not promised. Taxes are not included.",
    portfolio: "Your largest sector is {{conc.topSector}} of your portfolio, and your funds overlap by up to {{conc.overlap}}.",
    portfolio_sector: "Your largest sector is {{conc.topSector}} of your portfolio.",
  },
  hi: {
    cannot: "भरोसे से गणना नहीं हो सकती: पहले आपकी मासिक आमदनी और ज़रूरी खर्च चाहिए। तब तक कोई आंकड़ा या लक्ष्य की राशि नहीं दिखाई जाती।",
    cash_short: "ज़रूरी खर्च, बाकी खर्च और कर्ज़ की किस्तों के बाद हर महीने {{cash.shortfall}} की कमी रहती है। जब तक महीना पूरा नहीं बैठता, लक्ष्य की राशि रोकी गई है।",
    cash_tight: "ज़रूरी खर्च, बाकी खर्च और कर्ज़ की किस्तों के बाद हर महीने सिर्फ़ {{cash.surplus}} बचता है, यानी आमदनी का {{cash.surplusPct}}। ज़्यादा गुंजाइश बनने तक लक्ष्य की राशि रोकी गई है।",
    cash_ok: "ज़रूरी खर्च, बाकी खर्च और कर्ज़ की किस्तों के बाद हर महीने {{cash.surplus}} बचता है, यानी आमदनी का {{cash.surplusPct}}।",
    goals_later: "लक्ष्य की राशि आपकी सीढ़ी के पहले कदम के बाद आती है, इसलिए अभी कोई राशि नहीं दिखाई गई है।",
    score: "आपका हेल्थ स्कोर {{health.score}} है। यह नीचे के कार्ड्स का सरल सार है, आपकी रेटिंग नहीं।",
    ef_ok: "आपके पास ज़रूरी खर्च के {{ef.months}} महीने की बचत है, जो {{ef.target}} महीने के लक्ष्य को पूरा करती है।",
    ef_low: "आपके पास ज़रूरी खर्च के {{ef.months}} महीने की बचत है। लक्ष्य {{ef.target}} महीने है, यानी {{ef.gap}} की कमी।",
    term_none: "अभी कोई आपकी आमदनी पर निर्भर नहीं है, इसलिए जीवन बीमा कम प्राथमिकता है।",
    term_ok: "आपका जीवन बीमा कवर {{ins.term.cover}} शुरुआती बिंदु {{ins.term.needed}} के बराबर या उससे ऊपर है।",
    term_gap: "आपके पास {{ins.term.cover}} का जीवन बीमा कवर है, जबकि शुरुआती बिंदु {{ins.term.needed}} है; कमी {{ins.term.gap}} है।",
    health_ok: "आपका स्वास्थ्य कवर {{ins.health.cover}} शुरुआती बिंदु {{ins.health.needed}} को पूरा करता है।",
    health_gap: "आपके पास {{ins.health.cover}} का स्वास्थ्य कवर है, जबकि शुरुआती बिंदु {{ins.health.needed}} है; कमी {{ins.health.gap}} है।",
    debt_none: "आपने कोई कर्ज़ नहीं बताया। इससे आपका मासिक बोझ हल्का रहता है।",
    debt_ok: "कर्ज़ की किस्तें आपकी आमदनी का {{debt.dti}} लेती हैं, और आपका कोई कर्ज़ महंगी दर में नहीं है।",
    debt_high: "कर्ज़ की किस्तें आपकी आमदनी का {{debt.dti}} लेती हैं, और आपकी सबसे ऊँची दर {{debt.highCost.rate}} है, जो {{debt.highCost.threshold}} की सीमा से ऊपर है।",
    savings: "आप आमदनी का लगभग {{save.rate}} बचाते हैं, यानी हर महीने {{save.monthly}}।",
    goals: "आपके लक्ष्य के लिए रिटर्न के हिसाब से मासिक राशि {{goal.@.sip.high}} से {{goal.@.sip.low}} तक हो सकती है। रिटर्न का कोई वादा नहीं है। टैक्स शामिल नहीं है।",
    portfolio: "आपके पोर्टफोलियो का सबसे बड़ा क्षेत्र {{conc.topSector}} है, और आपके फंड {{conc.overlap}} तक मेल खाते हैं।",
    portfolio_sector: "आपके पोर्टफोलियो का सबसे बड़ा क्षेत्र {{conc.topSector}} है।",
  },
  ta: {
    cannot: "நம்பகமாகக் கணக்கிட முடியாது: முதலில் உங்கள் மாத வருமானமும் அத்தியாவசியச் செலவும் தேவை. அதுவரை எந்த எண்ணோ இலக்குத் தொகையோ காட்டப்படாது.",
    cash_short: "அத்தியாவசியச் செலவுகள், மற்ற செலவுகள், கடன் தவணைகளுக்குப் பிறகு மாதம் {{cash.shortfall}} பற்றாக்குறை உள்ளது. மாதம் சரியாகப் பொருந்தும் வரை இலக்குத் தொகைகள் நிறுத்தி வைக்கப்பட்டுள்ளன.",
    cash_tight: "அத்தியாவசியச் செலவுகள், மற்ற செலவுகள், கடன் தவணைகளுக்குப் பிறகு மாதம் {{cash.surplus}} மட்டுமே மிஞ்சுகிறது; இது வருமானத்தில் {{cash.surplusPct}}. இடம் அதிகமாகும் வரை இலக்குத் தொகைகள் நிறுத்தி வைக்கப்பட்டுள்ளன.",
    cash_ok: "அத்தியாவசியச் செலவுகள், மற்ற செலவுகள், கடன் தவணைகளுக்குப் பிறகு மாதம் {{cash.surplus}} மிஞ்சுகிறது; இது வருமானத்தில் {{cash.surplusPct}}.",
    goals_later: "இலக்குத் தொகைகள் உங்கள் படிக்கட்டின் முதல் படிக்குப் பிறகு வருகின்றன, எனவே இப்போது எதுவும் காட்டப்படவில்லை.",
    score: "உங்கள் ஹெல்த் ஸ்கோர் {{health.score}}. இது கீழுள்ள கார்டுகளின் எளிய சுருக்கம், உங்கள் மதிப்பீடு அல்ல.",
    ef_ok: "அத்தியாவசிய செலவுகளுக்கான {{ef.months}} மாதங்களுக்கு சேமிப்பு உள்ளது; இது {{ef.target}} மாத இலக்கை எட்டுகிறது.",
    ef_low: "அத்தியாவசிய செலவுகளுக்கான {{ef.months}} மாதங்களுக்கு சேமிப்பு உள்ளது. இலக்கு {{ef.target}} மாதங்கள், இடைவெளி {{ef.gap}}.",
    term_none: "தற்போது யாரும் உங்கள் வருமானத்தை நம்பி இல்லை, எனவே ஆயுள் காப்பீடு குறைந்த முன்னுரிமை.",
    term_ok: "உங்கள் ஆயுள் காப்பீடு {{ins.term.cover}}, தொடக்கப் புள்ளி {{ins.term.needed}} அளவுக்கோ அதற்கு மேலோ உள்ளது.",
    term_gap: "உங்களிடம் {{ins.term.cover}} ஆயுள் காப்பீடு உள்ளது; தொடக்கப் புள்ளி {{ins.term.needed}}, இடைவெளி {{ins.term.gap}}.",
    health_ok: "உங்கள் மருத்துவக் காப்பீடு {{ins.health.cover}}, தொடக்கப் புள்ளி {{ins.health.needed}} அளவை எட்டுகிறது.",
    health_gap: "உங்களிடம் {{ins.health.cover}} மருத்துவக் காப்பீடு உள்ளது; தொடக்கப் புள்ளி {{ins.health.needed}}, இடைவெளி {{ins.health.gap}}.",
    debt_none: "நீங்கள் கடன் எதுவும் குறிப்பிடவில்லை. இது உங்கள் மாதாந்திரச் சுமையை இலகுவாக்குகிறது.",
    debt_ok: "கடன் தவணைகள் உங்கள் வருமானத்தில் {{debt.dti}} எடுக்கின்றன; உங்கள் கடன்கள் எதுவும் அதிக வட்டி வரம்பில் இல்லை.",
    debt_high: "கடன் தவணைகள் உங்கள் வருமானத்தில் {{debt.dti}} எடுக்கின்றன; உங்கள் அதிகபட்ச வட்டி {{debt.highCost.rate}}, இது {{debt.highCost.threshold}} எல்லையை விட அதிகம்.",
    savings: "நீங்கள் வருமானத்தில் சுமார் {{save.rate}} சேமிக்கிறீர்கள், அதாவது மாதம் {{save.monthly}}.",
    goals: "உங்கள் இலக்குக்கு வருமானத்தைப் பொறுத்து மாதாந்திரத் தொகை {{goal.@.sip.high}} முதல் {{goal.@.sip.low}} வரை இருக்கலாம். வருமானத்துக்கு உறுதி இல்லை. வரி சேர்க்கப்படவில்லை.",
    portfolio: "உங்கள் போர்ட்ஃபோலியோவின் மிகப்பெரிய துறை {{conc.topSector}}; உங்கள் ஃபண்டுகள் {{conc.overlap}} வரை ஒத்துப்போகின்றன.",
    portfolio_sector: "உங்கள் போர்ட்ஃபோலியோவின் மிகப்பெரிய துறை {{conc.topSector}}.",
  },
};

export const NUDGE_TEXT: L3<Record<string, string>> = {
  en: {
    sip_review_later: "Goal amounts wait until the first step on your ladder is on track, so there is no monthly amount to review yet.",
    cash_flow: "Your month does not add up yet: income, spending and loan payments leave a gap. Look at the cash-flow step first; goal amounts come after.",
    ef_low: "Your emergency reserve covers {{ef.months}} months. A small monthly top-up can help you move toward {{ef.target}}.",
    insurance_gap: "Your insurance cover shows a gap worth discussing with a reviewer.",
    sip_review: "Time to review your monthly goal amount. On the base case it is about {{goal.@.sip.base}}.",
    rebalance: "Your largest sector is {{conc.topSector}} of your portfolio. A rebalancing review may help.",
  },
  hi: {
    sip_review_later: "लक्ष्य की राशि तब तक रुकी है जब तक आपकी सीढ़ी का पहला कदम ठीक न हो, इसलिए अभी समीक्षा के लिए कोई मासिक राशि नहीं है।",
    cash_flow: "आपका महीना अभी पूरा नहीं बैठता: आमदनी, खर्च और कर्ज़ की किस्तों के बाद कमी रहती है। पहले नकदी-प्रवाह वाला कदम देखें; लक्ष्य की राशि उसके बाद आती है।",
    ef_low: "आपका आपातकालीन फंड {{ef.months}} महीने का खर्च कवर करता है। हर महीने थोड़ी बचत {{ef.target}} की ओर बढ़ने में मदद कर सकती है।",
    insurance_gap: "आपके बीमा कवर में कमी दिखती है, जिस पर रिव्यूअर से चर्चा करना ठीक रहेगा।",
    sip_review: "अपनी मासिक लक्ष्य राशि की समीक्षा का समय है। सामान्य अनुमान में यह लगभग {{goal.@.sip.base}} है।",
    rebalance: "आपके पोर्टफोलियो का सबसे बड़ा क्षेत्र {{conc.topSector}} है। रीबैलेंसिंग समीक्षा मदद कर सकती है।",
  },
  ta: {
    sip_review_later: "உங்கள் படிக்கட்டின் முதல் படி சரியாகும் வரை இலக்குத் தொகைகள் காத்திருக்கும்; எனவே மதிப்பாய்வு செய்ய மாதாந்திரத் தொகை இப்போது இல்லை.",
    cash_flow: "உங்கள் மாதம் இன்னும் சரியாகப் பொருந்தவில்லை: வருமானம், செலவு, கடன் தவணைகளுக்குப் பிறகு இடைவெளி உள்ளது. முதலில் பணப்புழக்கப் படியைப் பாருங்கள்; இலக்குத் தொகைகள் அதன் பிறகே.",
    ef_low: "உங்கள் அவசர நிதி {{ef.months}} மாதங்களுக்குப் போதும். மாதம் சிறிய தொகை சேர்த்தால் {{ef.target}} நோக்கி நகரலாம்.",
    insurance_gap: "உங்கள் காப்பீட்டில் இடைவெளி தெரிகிறது; மதிப்பாய்வாளருடன் பேசலாம்.",
    sip_review: "உங்கள் மாதாந்திர இலக்குத் தொகையை மதிப்பாய்வு செய்யும் நேரம். அடிப்படை மதிப்பீட்டில் இது சுமார் {{goal.@.sip.base}}.",
    rebalance: "உங்கள் போர்ட்ஃபோலியோவின் மிகப்பெரிய துறை {{conc.topSector}}. மறுசீரமைப்பு மதிப்பாய்வு உதவலாம்.",
  },
};

export const COPILOT_TEXT: L3<{ agenda: string[]; rationaleSummary: string; rationaleBlocked: string; followUps: string[]; meetingNotes: string }> = {
  en: {
    rationaleBlocked:
      "The draft starts with the first step on the ladder that needs work, and goal amounts are held back as later until it is on track. Check the answers behind it first; where an answer is missing the draft says it cannot calculate reliably.",
    agenda: ["Confirm income pattern and monthly costs", "Walk through the top priorities in the draft", "Agree on next steps and a follow-up date"],
    rationaleSummary:
      "The draft starts with the biggest gaps. Emergency savings stand at {{ef.months}} months against a target of {{ef.target}}. The health cover gap is {{ins.health.gap}}, and the savings rate is {{save.rate}}.",
    followUps: ["Ask for a simple monthly budget", "Collect current policy details", "Review goal amounts and timelines together"],
    meetingNotes:
      "We looked at your emergency savings of {{ef.months}} months and what a reserve could look like. We also went through your goals and the ranges for discussion. Nothing here is final; you decide what feels comfortable.",
  },
  hi: {
    rationaleBlocked:
      "मसौदा सीढ़ी के उस पहले कदम से शुरू होता है जिस पर काम चाहिए, और जब तक वह ठीक नहीं होता लक्ष्य की राशि 'बाद में' के लिए रोकी जाती है। पहले उसके पीछे के जवाब जांचें; जहाँ जवाब छूटा है वहाँ मसौदा कहता है कि भरोसे से गणना नहीं हो सकती।",
    agenda: ["आमदनी का स्वरूप और मासिक खर्च पक्का करें", "मसौदे की मुख्य प्राथमिकताओं पर चलें", "अगले कदम और फॉलो-अप की तारीख तय करें"],
    rationaleSummary:
      "मसौदा सबसे बड़ी कमियों से शुरू होता है। आपातकालीन बचत {{ef.months}} महीने है, जबकि लक्ष्य {{ef.target}} महीने है। स्वास्थ्य कवर की कमी {{ins.health.gap}} है और बचत दर {{save.rate}} है।",
    followUps: ["सरल मासिक बजट मांगें", "मौजूदा पॉलिसी का ब्योरा इकट्ठा करें", "लक्ष्य राशि और समय-सीमा साथ में देखें"],
    meetingNotes:
      "हमने आपकी {{ef.months}} महीने की आपातकालीन बचत और रिज़र्व कैसा हो सकता है, इस पर बात की। हमने आपके लक्ष्य और चर्चा के दायरे भी देखे। यहाँ कुछ भी अंतिम नहीं है; आप तय करते हैं कि क्या सहज है।",
  },
  ta: {
    rationaleBlocked:
      "வரைவு படிக்கட்டில் முதலில் வேலை தேவைப்படும் படியிலிருந்து தொடங்குகிறது; அது சரியாகும் வரை இலக்குத் தொகைகள் 'பின்னர்' என்று நிறுத்தி வைக்கப்படும். முதலில் அதன் பின்னாலுள்ள பதில்களைச் சரிபாருங்கள்; பதில் விடுபட்ட இடத்தில் நம்பகமாகக் கணக்கிட முடியாது என்று வரைவு சொல்லும்.",
    agenda: ["வருமான முறையையும் மாதச் செலவுகளையும் உறுதிசெய்யவும்", "வரைவின் முக்கிய முன்னுரிமைகளைப் பார்க்கவும்", "அடுத்த படிகளையும் பின்தொடர்வு தேதியையும் முடிவு செய்யவும்"],
    rationaleSummary:
      "வரைவு மிகப்பெரிய இடைவெளிகளில் தொடங்குகிறது. அவசரச் சேமிப்பு {{ef.months}} மாதங்கள், இலக்கு {{ef.target}}. மருத்துவக் காப்பீட்டு இடைவெளி {{ins.health.gap}}, சேமிப்பு விகிதம் {{save.rate}}.",
    followUps: ["எளிய மாதாந்திர பட்ஜெட்டைக் கேளுங்கள்", "தற்போதைய பாலிசி விவரங்களைச் சேகரிக்கவும்", "இலக்குத் தொகைகளையும் காலக்கெடுவையும் சேர்ந்து பாருங்கள்"],
    meetingNotes:
      "உங்கள் {{ef.months}} மாத அவசரச் சேமிப்பையும், இருப்பு எப்படி இருக்கலாம் என்பதையும் பார்த்தோம். உங்கள் இலக்குகளையும் விவாத வரம்புகளையும் பார்த்தோம். இங்கு எதுவும் இறுதியானது அல்ல; உங்களுக்கு வசதியானதை நீங்களே முடிவு செய்கிறீர்கள்.",
  },
};
