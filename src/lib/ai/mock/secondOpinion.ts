// Mock Second Opinion: the rule-based scam check (see src/lib/scam/) turned into a schema-valid result with
// scripted, safe explanations in English, Hindi and Tamil. It never says a message is safe: a result with no
// warning signs says "No known warning signs were found in this check. That does not mean the message is safe."
// Rows that once failed live in tests/corpus.test.ts; the measured corpus is tests/fixtures/scam-corpus.json.
import { impliedAnnual, flattenResults } from "@/lib/engine";
import { analyse, detectFlags, foldDigits, monthlyRateIn, overallOf, splitSentences, type Hit } from "@/lib/scam/detect";
import { LOW_RISK_SUMMARY } from "@/lib/scam/wording";
import type { Ground } from "../numeric";
import type { SecondOpinionResult } from "../schemas";
import type { Lang } from "@/types";

export { analyse, detectFlags, foldDigits, monthlyRateIn, overallOf, splitSentences };
export type { Hit };
type FlagType = SecondOpinionResult["flags"][number]["type"];

export function secondOpinionGround(text: string): Ground {
  const r = monthlyRateIn(text);
  return r === null ? { flat: {}, units: {} } : flattenResults([impliedAnnual(r)]);
}

export const SO_TEXT: Record<Lang, Record<FlagType, { explanation: string; question: string }>> = {
  en: {
    guaranteed_returns: {
      explanation: "Market investments move up and down. Nobody can fix profits in advance, so a promised return is a warning sign.",
      question: "Where is this return promise written in official documents?",
    },
    urgency_pressure: {
      explanation: "Pressure to act fast stops you from checking facts. Honest advisers give you time.",
      question: "What happens if I take a few days to decide?",
    },
    insider_claim: {
      explanation: "Trading on inside information is illegal, and claims of secret knowledge are often bait.",
      question: "How does this person know this, and can they show it publicly?",
    },
    missing_disclosure: {
      explanation: "Real offers explain fees, risks and terms in writing. Hiding or skipping them is a red flag.",
      question: "Can you show every fee, risk and condition in writing?",
    },
    unregistered_signal: {
      explanation: "Investment advice should come from a registered adviser. This message gives no registration details you can verify.",
      question: "Can you share registration details so I can verify them on the official registry?",
    },
    leverage: {
      explanation: "Borrowed money magnifies losses as well as gains, and you can lose more than you put in.",
      question: "What happens if I lose more than I invested?",
    },
    pump_pattern: {
      explanation: "Pushing many people into the same small stock at the same time is a known pump-and-dump pattern.",
      question: "Who benefits if many people buy this at the same time?",
    },
    commission_conflict: {
      explanation: "The sender may earn more from some products than from others. Their advice may follow their pay, not your goals.",
      question: "How are you paid if I choose this option?",
    },
    credential_request: {
      explanation: "Real banks, brokers and regulators never ask you to share an OTP, PIN or password, or to install a remote-access app.",
      question: "Why do you need this detail, and can I confirm through the official app or helpline?",
    },
    phishing_link: {
      explanation: "Links in messages that ask you to update KYC, claim money or avoid a block are a common phishing trick. Open the official app or website yourself instead.",
      question: "Can I do this inside the official app, without clicking this link?",
    },
    payment_to_individual: {
      explanation: "Genuine investments are bought through regulated platforms, not by sending money to a personal UPI ID or account.",
      question: "Why am I paying a person and not a registered platform in the company's name?",
    },
    unlisted_offering: {
      explanation: "Pre-IPO and unlisted shares sold through messages are hard to verify and often fraudulent. Allotment cannot be promised.",
      question: "Which registered platform handles this, and where is the allotment documented?",
    },
    advance_fee: {
      explanation: "Being asked to pay a fee, deposit or tax before you can take out your own money is a classic fraud pattern. Real platforms take charges from your balance, not from a new payment.",
      question: "Why must I pay before I can withdraw, and where is this fee written in the official terms?",
    },
    false_authority: {
      explanation: "Regulators do not approve or guarantee individual investment schemes, and a message saying so proves nothing. Claims of approval or government backing are a common way to build false trust.",
      question: "Where can I check this approval on the regulator's own website, without using any link you sent?",
    },
    exclusive_selection: {
      explanation: "Being 'selected' for a private or confidential offer, or told to go through a representative, is a way to make an ordinary pitch feel special. Real advisers do not recruit through unsolicited messages.",
      question: "Why was I chosen, and can I check who you are and who regulates you before I do anything?",
    },
    impersonation: {
      explanation: "Anyone can type 'I am your adviser' or 'your relationship manager'. A real adviser or bank contacts you through details you already hold, and can be checked on an official registry.",
      question: "How can I check who you are through a number or registry that I find myself, not something you give me?",
    },
    private_channel: {
      explanation: "Moving a conversation about money into a private or paid group, or a private chat, takes it away from anyone who could warn you. Real advisers do not need a secret channel.",
      question: "Why does this have to happen in a private group, and who runs it?",
    },
    new_payee: {
      explanation: "A 'new' or 'changed' account, or a personal UPI ID, is how payments get redirected to a fraudster. Genuine firms keep a registered account and tell you any change in writing.",
      question: "Why is the account new or changed, and can I confirm it with the firm using a number from my own records?",
    },
    implied_certainty: {
      explanation: "Promising steady income, no losing months or certain profit without using the word 'guarantee' is still a promise. Market returns cannot be certain.",
      question: "Where in writing is the risk of loss explained, and what happens in a bad month?",
    },
  },
  hi: {
    guaranteed_returns: {
      explanation: "बाज़ार के निवेश ऊपर-नीचे होते हैं। कोई पहले से मुनाफ़ा तय नहीं कर सकता, इसलिए वादा किया गया रिटर्न चेतावनी का संकेत है।",
      question: "यह रिटर्न का वादा आधिकारिक दस्तावेज़ों में कहाँ लिखा है?",
    },
    urgency_pressure: {
      explanation: "जल्दी करने का दबाव आपको तथ्य जांचने से रोकता है। ईमानदार सलाहकार आपको समय देते हैं।",
      question: "अगर मैं फ़ैसले में कुछ दिन लूँ तो क्या होगा?",
    },
    insider_claim: {
      explanation: "अंदरूनी जानकारी पर ट्रेडिंग गैरकानूनी है, और गुप्त जानकारी के दावे अक्सर लालच देने के लिए होते हैं।",
      question: "इस व्यक्ति को यह कैसे पता है, और क्या वे इसे सार्वजनिक रूप से दिखा सकते हैं?",
    },
    missing_disclosure: {
      explanation: "असली ऑफ़र में फीस, जोखिम और शर्तें लिखित में बताई जाती हैं। इन्हें छिपाना या टालना खतरे का संकेत है।",
      question: "क्या आप हर फीस, जोखिम और शर्त लिखित में दिखा सकते हैं?",
    },
    unregistered_signal: {
      explanation: "निवेश सलाह पंजीकृत सलाहकार से आनी चाहिए। इस संदेश में ऐसा कोई पंजीकरण विवरण नहीं है जिसे आप जांच सकें।",
      question: "क्या आप पंजीकरण विवरण दे सकते हैं ताकि मैं आधिकारिक रजिस्ट्री पर जांच सकूँ?",
    },
    leverage: {
      explanation: "उधार का पैसा नुकसान को भी बढ़ाता है, और आप लगाई गई रकम से ज़्यादा खो सकते हैं।",
      question: "अगर मैं लगाई रकम से ज़्यादा खो दूँ तो क्या होगा?",
    },
    pump_pattern: {
      explanation: "बहुत से लोगों को साथ-साथ किसी छोटे शेयर में धकेलना पंप-एंड-डंप का जाना-पहचाना तरीका है।",
      question: "अगर बहुत लोग इसे साथ में खरीदें तो फ़ायदा किसे होता है?",
    },
    commission_conflict: {
      explanation: "भेजने वाले को किसी उत्पाद से दूसरे से ज़्यादा कमाई हो सकती है। उनकी सलाह उनकी कमाई के हिसाब से हो सकती है, आपके लक्ष्य के नहीं।",
      question: "अगर मैं यह विकल्प चुनूँ तो आपको भुगतान कैसे मिलता है?",
    },
    credential_request: {
      explanation: "असली बैंक, ब्रोकर या नियामक आपसे कभी OTP, पिन या पासवर्ड साझा करने को नहीं कहते, और न ही रिमोट-एक्सेस ऐप इंस्टॉल करवाते हैं।",
      question: "आपको यह जानकारी क्यों चाहिए, और क्या मैं आधिकारिक ऐप या हेल्पलाइन से पुष्टि कर सकता हूँ?",
    },
    phishing_link: {
      explanation: "KYC अपडेट, पैसे पाने या ब्लॉक से बचने के नाम पर संदेश में आए लिंक फ़िशिंग की आम चाल हैं। इसके बजाय आधिकारिक ऐप या वेबसाइट खुद खोलें।",
      question: "क्या मैं यह इस लिंक पर क्लिक किए बिना आधिकारिक ऐप में कर सकता हूँ?",
    },
    payment_to_individual: {
      explanation: "असली निवेश विनियमित प्लेटफ़ॉर्म से होते हैं, किसी व्यक्ति के UPI आईडी या खाते में पैसे भेजकर नहीं।",
      question: "मैं कंपनी के नाम वाले पंजीकृत प्लेटफ़ॉर्म की जगह किसी व्यक्ति को भुगतान क्यों करूँ?",
    },
    unlisted_offering: {
      explanation: "संदेशों से बिकने वाले प्री-IPO और अनलिस्टेड शेयरों की पुष्टि करना कठिन होता है और वे अक्सर धोखाधड़ी होते हैं। आवंटन का वादा नहीं किया जा सकता।",
      question: "यह किस पंजीकृत प्लेटफ़ॉर्म से हो रहा है, और आवंटन कहाँ दर्ज है?",
    },
    advance_fee: {
      explanation: "अपना ही पैसा निकालने से पहले शुल्क, जमा या टैक्स मांगना ठगी का पुराना तरीका है। असली प्लेटफ़ॉर्म आपके बैलेंस से शुल्क काटते हैं, नया भुगतान नहीं मांगते।",
      question: "पैसा निकालने से पहले मुझे भुगतान क्यों करना है, और यह शुल्क आधिकारिक शर्तों में कहाँ लिखा है?",
    },
    false_authority: {
      explanation: "नियामक किसी एक निवेश योजना को मंज़ूरी या गारंटी नहीं देते, और संदेश में ऐसा लिखा होना कुछ साबित नहीं करता। मंज़ूरी या सरकारी समर्थन का दावा झूठा भरोसा बनाने का आम तरीका है।",
      question: "मैं यह मंज़ूरी नियामक की अपनी वेबसाइट पर कैसे जांचूँ, आपके भेजे लिंक के बिना?",
    },
    exclusive_selection: {
      explanation: "'चुने जाने' या निजी, गोपनीय ऑफ़र का दावा, या प्रतिनिधि के ज़रिए आगे बढ़ने को कहना, एक आम पिच को ख़ास दिखाने का तरीका है। असली सलाहकार बिना बुलाए संदेशों से लोग नहीं जोड़ते।",
      question: "मुझे क्यों चुना गया, और कुछ भी करने से पहले क्या मैं जांच सकता हूँ कि आप कौन हैं और आपका नियामक कौन है?",
    },
    impersonation: {
      explanation: "'मैं आपका एडवाइज़र हूँ' या 'आपका रिलेशनशिप मैनेजर' कोई भी लिख सकता है। असली एडवाइज़र या बैंक आपके पास पहले से मौजूद जानकारी से संपर्क करता है, और उसे आधिकारिक रजिस्ट्री पर जांचा जा सकता है।",
      question: "मैं आपकी पहचान किसी ऐसे नंबर या रजिस्ट्री से कैसे जांचूं जो मैंने खुद ढूंढा हो, आपका दिया हुआ नहीं?",
    },
    private_channel: {
      explanation: "पैसों की बात को प्राइवेट या पेड ग्रुप या निजी चैट में ले जाने से वह उन लोगों से दूर हो जाती है जो आपको चेताते। असली एडवाइज़र को गुप्त चैनल की ज़रूरत नहीं होती।",
      question: "यह प्राइवेट ग्रुप में ही क्यों होना चाहिए, और इसे कौन चलाता है?",
    },
    new_payee: {
      explanation: "'नया' या 'बदला हुआ' खाता, या निजी UPI ID, वही तरीका है जिससे भुगतान ठग के पास मोड़ा जाता है। असली फर्म एक पंजीकृत खाता रखती है और लिखित में बताती है।",
      question: "खाता नया या बदला हुआ क्यों है, और क्या मैं इसे अपने रिकॉर्ड के नंबर से फर्म से पक्का कर सकता हूँ?",
    },
    implied_certainty: {
      explanation: "'गारंटी' शब्द के बिना भी स्थिर आमदनी, कोई घाटे का महीना नहीं, या पक्के मुनाफे का वादा करना वादा ही है। बाज़ार का रिटर्न पक्का नहीं हो सकता।",
      question: "नुकसान का जोखिम लिखित में कहाँ समझाया गया है, और बुरे महीने में क्या होता है?",
    },
  },
  ta: {
    guaranteed_returns: {
      explanation: "சந்தை முதலீடுகள் ஏறி இறங்கும். லாபத்தை முன்கூட்டியே யாரும் உறுதி செய்ய முடியாது, எனவே வாக்குறுதி அளிக்கப்பட்ட வருமானம் எச்சரிக்கை அறிகுறி.",
      question: "இந்த வருமான வாக்குறுதி அதிகாரப்பூர்வ ஆவணங்களில் எங்கே எழுதப்பட்டுள்ளது?",
    },
    urgency_pressure: {
      explanation: "அவசரப்படுத்தும் அழுத்தம் உண்மைகளைச் சரிபார்ப்பதைத் தடுக்கும். நேர்மையான ஆலோசகர்கள் உங்களுக்கு நேரம் தருவார்கள்.",
      question: "முடிவெடுக்க சில நாட்கள் எடுத்துக்கொண்டால் என்ன ஆகும்?",
    },
    insider_claim: {
      explanation: "உள்ளிருக்கும் தகவலில் வர்த்தகம் செய்வது சட்டவிரோதம்; ரகசியத் தகவல் என்ற கூற்றுகள் பெரும்பாலும் ஆசை காட்டவே.",
      question: "இவருக்கு இது எப்படித் தெரியும், இதைப் பொதுவில் காட்ட முடியுமா?",
    },
    missing_disclosure: {
      explanation: "உண்மையான சலுகைகள் கட்டணம், ஆபத்து, நிபந்தனைகளை எழுத்தில் தெரிவிக்கும். அவற்றை மறைப்பது எச்சரிக்கை அறிகுறி.",
      question: "ஒவ்வொரு கட்டணம், ஆபத்து, நிபந்தனையையும் எழுத்தில் காட்ட முடியுமா?",
    },
    unregistered_signal: {
      explanation: "முதலீட்டு ஆலோசனை பதிவுசெய்யப்பட்ட ஆலோசகரிடமிருந்து வர வேண்டும். இந்தச் செய்தியில் நீங்கள் சரிபார்க்கக்கூடிய பதிவு விவரங்கள் இல்லை.",
      question: "அதிகாரப்பூர்வ பதிவேட்டில் சரிபார்க்க உங்கள் பதிவு விவரங்களைப் பகிர முடியுமா?",
    },
    leverage: {
      explanation: "கடன் வாங்கிய பணம் இழப்பையும் பெருக்கும்; நீங்கள் போட்டதை விட அதிகமாக இழக்கலாம்.",
      question: "நான் போட்டதை விட அதிகம் இழந்தால் என்ன ஆகும்?",
    },
    pump_pattern: {
      explanation: "பலரை ஒரே நேரத்தில் ஒரே சிறிய பங்கில் தள்ளுவது அறியப்பட்ட பம்ப்-அண்ட்-டம்ப் முறை.",
      question: "பலர் ஒரே நேரத்தில் இதை வாங்கினால் யாருக்கு லாபம்?",
    },
    commission_conflict: {
      explanation: "அனுப்புபவருக்கு ஒரு தயாரிப்பில் மற்றதை விட அதிக வருமானம் கிடைக்கலாம். அவர் ஆலோசனை உங்கள் இலக்கை அல்ல, அவர் வருமானத்தைப் பின்பற்றலாம்.",
      question: "இந்த வழியைத் தேர்ந்தெடுத்தால் உங்களுக்கு எப்படிப் பணம் கிடைக்கும்?",
    },
    credential_request: {
      explanation: "உண்மையான வங்கிகள், தரகர்கள், ஒழுங்குமுறை அமைப்புகள் OTP, பின், கடவுச்சொல்லைப் பகிரச் சொல்ல மாட்டார்கள்; தொலைநிலை அணுகல் செயலியை நிறுவவும் சொல்ல மாட்டார்கள்.",
      question: "இந்த விவரம் உங்களுக்கு ஏன் தேவை, அதிகாரப்பூர்வ செயலி அல்லது உதவி எண் வழியாக உறுதிசெய்யலாமா?",
    },
    phishing_link: {
      explanation: "KYC புதுப்பிப்பு, பணம் பெறுதல், முடக்கத்தைத் தவிர்த்தல் என்று செய்தியில் வரும் இணைப்புகள் பொதுவான மோசடி உத்தி. அதற்குப் பதிலாக அதிகாரப்பூர்வ செயலி அல்லது இணையதளத்தை நீங்களே திறங்கள்.",
      question: "இந்த இணைப்பைத் தட்டாமல் அதிகாரப்பூர்வ செயலிக்குள்ளேயே இதைச் செய்ய முடியுமா?",
    },
    payment_to_individual: {
      explanation: "உண்மையான முதலீடுகள் ஒழுங்குபடுத்தப்பட்ட தளங்கள் வழியாகவே வாங்கப்படும்; தனிநபர் UPI ஐடி அல்லது கணக்குக்குப் பணம் அனுப்புவதன் மூலம் அல்ல.",
      question: "நிறுவனப் பெயரிலுள்ள பதிவுபெற்ற தளத்துக்குப் பதிலாக ஒரு தனிநபருக்கு நான் ஏன் செலுத்த வேண்டும்?",
    },
    unlisted_offering: {
      explanation: "செய்திகள் மூலம் விற்கப்படும் முன்-IPO மற்றும் பட்டியலிடப்படாத பங்குகளைச் சரிபார்ப்பது கடினம்; அவை பெரும்பாலும் மோசடி. ஒதுக்கீட்டுக்கு உறுதியளிக்க முடியாது.",
      question: "இது எந்தப் பதிவுபெற்ற தளம் வழியாக நடக்கிறது, ஒதுக்கீடு எங்கே பதிவாகியுள்ளது?",
    },
    advance_fee: {
      explanation: "உங்கள் சொந்தப் பணத்தை எடுக்கும் முன் கட்டணம், வைப்புத் தொகை அல்லது வரி செலுத்தச் சொல்வது பழைய மோசடி முறை. உண்மையான தளங்கள் உங்கள் இருப்பிலிருந்தே கட்டணம் எடுக்கும், புதிய பணம் கேட்காது.",
      question: "பணத்தை எடுக்கும் முன் நான் ஏன் செலுத்த வேண்டும், இந்தக் கட்டணம் அதிகாரப்பூர்வ விதிகளில் எங்கே உள்ளது?",
    },
    false_authority: {
      explanation: "ஒழுங்குமுறை அமைப்புகள் தனிப்பட்ட முதலீட்டுத் திட்டங்களை அங்கீகரிப்பதோ உத்தரவாதம் தருவதோ இல்லை; செய்தியில் அப்படி எழுதியிருப்பது எதையும் நிரூபிக்காது. அங்கீகாரம் அல்லது அரசு ஆதரவு என்ற கூற்று பொய்யான நம்பிக்கையை உருவாக்கும் பொதுவான வழி.",
      question: "நீங்கள் அனுப்பிய இணைப்பைப் பயன்படுத்தாமல், ஒழுங்குமுறை அமைப்பின் சொந்த இணையதளத்தில் இந்த அங்கீகாரத்தை எப்படிச் சரிபார்ப்பது?",
    },
    exclusive_selection: {
      explanation: "'தேர்ந்தெடுக்கப்பட்டீர்கள்' என்று தனியார் அல்லது ரகசியச் சலுகை சொல்வது, அல்லது பிரதிநிதி வழியாகச் செல்லச் சொல்வது, சாதாரண விளம்பரத்தைச் சிறப்பாகக் காட்டும் வழி. உண்மையான ஆலோசகர்கள் கேட்காத செய்திகள் மூலம் ஆட்களைச் சேர்ப்பதில்லை.",
      question: "என்னை ஏன் தேர்ந்தெடுத்தீர்கள், எதையும் செய்யும் முன் நீங்கள் யார், உங்களை ஒழுங்குபடுத்துவது யார் என்று சரிபார்க்கலாமா?",
    },
    impersonation: {
      explanation: "'நான் உங்கள் ஆலோசகர்' அல்லது 'உங்கள் ரிலேஷன்ஷிப் மேனேஜர்' என்று யார் வேண்டுமானாலும் எழுதலாம். உண்மையான ஆலோசகர் அல்லது வங்கி உங்களிடம் ஏற்கனவே உள்ள விவரங்கள் வழியாகத் தொடர்புகொள்ளும்; அதை அதிகாரப்பூர்வ பதிவேட்டில் சரிபார்க்கலாம்.",
      question: "நீங்கள் தரும் எண் அல்லது பதிவேடு அல்லாமல், நானே கண்டுபிடிக்கும் ஒன்றின் மூலம் உங்களை எப்படிச் சரிபார்ப்பது?",
    },
    private_channel: {
      explanation: "பணம் பற்றிய உரையாடலைத் தனியார் அல்லது கட்டணக் குழுவுக்கோ தனிப்பட்ட அரட்டைக்கோ மாற்றுவது உங்களை எச்சரிக்கக்கூடியவர்களிடமிருந்து அதைத் தூரப்படுத்தும். உண்மையான ஆலோசகருக்கு ரகசிய வழி தேவையில்லை.",
      question: "இது ஏன் தனியார் குழுவில்தான் நடக்க வேண்டும், அதை யார் நடத்துகிறார்கள்?",
    },
    new_payee: {
      explanation: "'புதிய' அல்லது 'மாற்றப்பட்ட' கணக்கு, அல்லது தனிப்பட்ட UPI ஐடி, பணத்தை மோசடிக்காரரிடம் திருப்பிவிடும் வழி. உண்மையான நிறுவனங்கள் ஒரே பதிவுசெய்த கணக்கை வைத்து எழுத்தில் தெரிவிக்கும்.",
      question: "கணக்கு ஏன் புதியது அல்லது மாற்றப்பட்டது, என் சொந்தப் பதிவிலுள்ள எண்ணைக் கொண்டு நிறுவனத்திடம் உறுதிசெய்யலாமா?",
    },
    implied_certainty: {
      explanation: "'உத்தரவாதம்' என்ற சொல்லைப் பயன்படுத்தாமல் நிலையான வருமானம், நஷ்ட மாதமே இல்லை, உறுதியான லாபம் என்று சொல்வதும் ஒரு வாக்குறுதிதான். சந்தை வருமானம் உறுதியாக இருக்க முடியாது.",
      question: "நஷ்ட ஆபத்து எழுத்தில் எங்கே விளக்கப்பட்டுள்ளது, மோசமான மாதத்தில் என்ன நடக்கும்?",
    },
  },
};

const STATIC: Record<
  Lang,
  { high: string; medium: string; low: string; note: string; lowQuestions: string[]; rateLine: string; regClaim: string }
> = {
  en: {
    high: "Strong warning signs found. Pause before acting.",
    medium: "Not enough evidence either way. Verify before acting.",
    low: LOW_RISK_SUMMARY.en,
    note: "Check who is behind a message, how they earn, and what is written down. Nobody can remove risk from investing.",
    lowQuestions: ["Who is sending this, and how do they earn?", "What are the risks and fees, in writing?"],
    rateLine: "A gain of {{implied.monthly}} every month adds up to about {{implied.annual}} a year. Real investments cannot promise that.",
    regClaim: "Saying 'registered' in a message proves nothing. Check any registration number yourself on the official registry.",
  },
  hi: {
    high: "मज़बूत चेतावनी संकेत मिले। कदम उठाने से पहले रुकें।",
    medium: "किसी भी तरफ़ पर्याप्त सबूत नहीं। कदम उठाने से पहले जांचें।",
    low: LOW_RISK_SUMMARY.hi,
    note: "देखें कि संदेश के पीछे कौन है, वह कैसे कमाता है, और लिखित में क्या है। निवेश से जोखिम कोई नहीं हटा सकता।",
    lowQuestions: ["यह कौन भेज रहा है, और वह कैसे कमाता है?", "जोखिम और फीस क्या हैं, लिखित में?"],
    rateLine: "हर महीने {{implied.monthly}} का लाभ साल में लगभग {{implied.annual}} बनता है। असली निवेश इसका वादा नहीं कर सकते।",
    regClaim: "संदेश में 'पंजीकृत' लिख देने से कुछ साबित नहीं होता। कोई भी पंजीकरण नंबर आधिकारिक रजिस्ट्री पर खुद जांचें।",
  },
  ta: {
    high: "வலுவான எச்சரிக்கை அறிகுறிகள் உள்ளன. செயல்படும் முன் நிறுத்துங்கள்.",
    medium: "எந்தப் பக்கமும் போதுமான சான்று இல்லை. செயல்படும் முன் சரிபாருங்கள்.",
    low: LOW_RISK_SUMMARY.ta,
    note: "செய்தியின் பின்னால் யார், அவர்கள் எப்படிச் சம்பாதிக்கிறார்கள், எழுத்தில் என்ன உள்ளது என்பதைப் பாருங்கள். முதலீட்டில் ஆபத்தை யாராலும் நீக்க முடியாது.",
    lowQuestions: ["இதை அனுப்புவது யார், அவர்கள் எப்படிச் சம்பாதிக்கிறார்கள்?", "ஆபத்துகளும் கட்டணங்களும் எழுத்தில் என்ன?"],
    rateLine: "மாதம் {{implied.monthly}} லாபம் ஆண்டுக்கு சுமார் {{implied.annual}} ஆகும். உண்மையான முதலீடுகள் இதை உறுதியளிக்க முடியாது.",
    regClaim: "செய்தியில் 'பதிவு பெற்றது' என்று எழுதுவது எதையும் நிரூபிக்காது. எந்தப் பதிவு எண்ணையும் அதிகாரப்பூர்வ பதிவேட்டில் நீங்களே சரிபாருங்கள்.",
  },
};

export function mockSecondOpinion(text: string, lang: Lang): SecondOpinionResult {
  // strongest signs first; the schema allows at most ten
  const found = [...detectFlags(text)].sort((a, b) => b.weight - a.weight).slice(0, 10);
  const S = STATIC[lang];
  const rate = monthlyRateIn(text);
  const flags = found.map((f) => {
    let explanation = SO_TEXT[lang][f.type].explanation;
    if (f.type === "guaranteed_returns" && rate !== null) explanation = `${explanation} ${S.rateLine}`;
    if (f.claim) explanation = S.regClaim;
    return { type: f.type, severity: f.severity, quote: f.quote, explanation };
  });
  const overall = overallOf(flags);  // flags carry their type, so a lone conversational signal is never "no known indicators"
  const questions = flags.length ? [...new Set(flags.map((f) => SO_TEXT[lang][f.type].question))].slice(0, 5) : S.lowQuestions;
  return { overall, summary: S[overall], flags, questions, educationalNote: S.note };
}

/** The scripted one-line summary for an overall level, in a language. */
export const summaryFor = (lang: Lang, overall: "low" | "medium" | "high") => STATIC[lang][overall];
