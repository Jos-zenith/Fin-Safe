import type { Lang } from "@/types";

// Eight Second Opinion samples. Exactly two (neutral_sip, neutral_emergency) are legitimate education.
export interface Sample {
  id: string;
  legit: boolean;
  label: Record<Lang, string>;
  text: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "telegram_pump",
    legit: false,
    label: { en: "Telegram group", hi: "टेलीग्राम ग्रुप", ta: "டெலிகிராம் குழு" },
    text: "VIP Telegram group! Our operator is loading a penny stock tomorrow morning. Join before 8 PM tonight, only a few seats left. 5x in 3 days confirmed. Pay Rs 999 to enter. Don't tell anyone.",
  },
  {
    id: "guaranteed_monthly",
    legit: false,
    label: { en: "3% every month", hi: "हर महीने 3%", ta: "மாதம் 3%" },
    text: "Invest Rs 50,000 and get guaranteed 3% every month. 100% safe, no risk. My clients are very happy. Limited slots, send your details today.",
  },
  {
    id: "insurance_pitch",
    legit: false,
    label: { en: "Insurance pitch", hi: "बीमा पिच", ta: "காப்பீடு விளம்பரம்" },
    text: "Sir, this plan is investment plus insurance. Pay only 25,000 per year, no other charges, I will take care of all paperwork. Offer closes tonight, sign today. No need to read the small print, it is standard.",
  },
  {
    id: "reel_insider",
    legit: false,
    label: { en: "Reel tip", hi: "रील टिप", ta: "ரீல் குறிப்பு" },
    text: "Big news! A source inside the company told me the results will be huge. Insider tip, buy before Friday, not for everyone. Comment YES and I will DM the stock name.",
  },
  {
    id: "regular_plan",
    legit: false,
    label: { en: "Regular plan push", hi: "रेगुलर प्लान", ta: "ரெகுலர் திட்டம்" },
    text: "Don't go for direct plans, they give no service. Take the regular plan through me, I will manage everything and you pay nothing extra.",
  },
  {
    id: "neutral_sip",
    legit: true,
    label: { en: "SIP explained", hi: "SIP समझें", ta: "SIP விளக்கம்" },
    text: "A SIP lets you invest a fixed amount every month. It spreads your purchases over time. Returns can go up and down, so choose your goal and time horizon first, and read the scheme documents.",
  },
  {
    id: "neutral_emergency",
    legit: true,
    label: { en: "Emergency fund", hi: "आपातकालीन निधि", ta: "அவசர நிதி" },
    text: "An emergency fund is money kept aside for sudden needs like job loss or medical bills. Many planners suggest keeping several months of essential expenses in a safe, easy place to withdraw from.",
  },
  {
    id: "borderline_newsletter",
    legit: false,
    label: { en: "Newsletter offer", hi: "न्यूज़लेटर ऑफर", ta: "செய்திமடல் சலுகை" },
    text: "Our newsletter shares market ideas every week. Past performance is not a guarantee. Some subscribers have done well. Subscribe today for a discount, the offer ends this month.",
  },
];
