// Questions and answers for the Help page. English only for now (the page says so). Every answer states only what the
// product does today; the numbers come from the configuration.
import { CONSTANTS } from "@/config/constants";
import { RETENTION_HOURS } from "@/config/workflow";

export type FaqCat = "ai" | "data" | "second" | "language" | "demo" | "fees";
export interface Faq {
  id: string;
  cat: FaqCat;
  q: string;
  a: string;
  /** An optional link from the answer. */
  link?: { href: string; label: string };
}

export const FAQ: Faq[] = [
  { id: "draft", cat: "ai", q: "What is a draft plan, and can I rely on it?", a: "A draft plan is prepared by software from your answers and is clearly marked as not final. Please do not act on it. It becomes “reviewed” only after a person checks and approves it.", link: { href: "/about", label: "Read how review works" } },
  { id: "reviewer", cat: "ai", q: "Who is the reviewer?", a: "In this demo the reviewer is Dr. Meera Iyer, a synthetic adviser persona with no registration. In a real service the reviewer would be a registered professional whose registration you could verify yourself." },
  { id: "numbers", cat: "ai", q: "Does AI write the numbers?", a: "No. Fixed formulas calculate every number. AI only writes the words around them, and every number in its text is checked against those calculations before you see it." },
  { id: "disagree", cat: "ai", q: "What happens if the reviewer disagrees with the draft?", a: "The reviewer can edit, remove or add a note to any item, or return the case to you with a question. Their reasons are kept in the record." },
  { id: "changes", cat: "ai", q: "Can I see what the reviewer changed?", a: "Yes. The reviewed plan marks edited and removed items, and the audit timeline lets you compare the AI draft with the reviewed version." },
  { id: "unverified", cat: "ai", q: "Why does a plan say “unverified assumption”?", a: "Figures such as expected returns and inflation are assumptions. Until a qualified person reviews an assumption it is marked unverified, and anything built on it says so.", link: { href: "/assumptions", label: "See every assumption" } },
  { id: "where", cat: "data", q: "Where is my data stored?", a: `In this browser tab for the session, and on this demo's server for up to ${RETENTION_HOURS} hours without activity. You can delete it at any time from Settings.` },
  { id: "real", cat: "data", q: "Can I use my real details?", a: "Please do not. This is a demo with synthetic data. Do not enter real names, account numbers or ID numbers." },
  { id: "sent", cat: "data", q: "What is sent to an AI model?", a: "Only the fields a task needs. Free text is cleaned on your device first (phone numbers, emails and long numbers are removed), but names cannot be removed reliably, so please do not type them." },
  { id: "kept", cat: "data", q: "How long is it kept?", a: `Demo data in the browser is erased after ${CONSTANTS.idleMinutes} idle minutes unless you choose to remember it for ${CONSTANTS.rememberHours} hours. On the server it is erased after ${RETENTION_HOURS} hours without activity.` },
  { id: "delete", cat: "data", q: "How do I delete my data?", a: "Open Settings and choose Clear local data, or use Clear demo data in the menu. You will be asked to confirm first.", link: { href: "/settings", label: "Open Settings" } },
  { id: "account", cat: "second", q: "Do I need an account to check a message?", a: "No. Second Opinion works without an account and without a health check.", link: { href: "/second-opinion", label: "Check a message" } },
  { id: "safe", cat: "second", q: "Can it tell me that a message is safe?", a: "No. It never says a message is safe. “No known warning signs” only means this check found none, and a scam can avoid every pattern it knows." },
  { id: "checks", cat: "second", q: "What does it actually check?", a: "The words of the message and the text of any link, against fixed rules. It does not open links, look up registries, read images or identify the sender." },
  { id: "langs", cat: "language", q: "Which languages are available?", a: "English, Hindi and Tamil. Hindi and Tamil text are pending native-speaker review." },
  { id: "english", cat: "language", q: "Why are some pages only in English?", a: "The buttons and main screens are translated. Long pages such as Compliance and this Help page are in English for now, and say so." },
  { id: "advice", cat: "demo", q: "Is this real advice?", a: "No. It is a demonstration with synthetic data. Approvals are simulated and are not regulated investment advice." },
  { id: "adviserRole", cat: "demo", q: "Why can I switch to an Adviser role?", a: "To show how review works. It signs you in as the demo adviser with no password. This is demo authentication, not secure authentication." },
  { id: "synthetic", cat: "demo", q: "What does “synthetic” mean?", a: "Made up. The people, balances, holdings and messages are not real." },
  { id: "cost", cat: "fees", q: "What does it cost?", a: "The fee on the How we earn page is a placeholder. No money moves in this demo.", link: { href: "/transparency", label: "How we earn" } },
  { id: "commission", cat: "fees", q: "Do you earn commissions?", a: "No. This demo takes no product commissions and no referral income, and sells nothing." },
];
