// The long text of the Compliance page. English only for now (the page says so); the headings and the buttons are
// translated in the dictionaries. Numbers are read from the configuration so the page can never disagree with it.
import { CONSTANTS } from "@/config/constants";
import { RETENTION_HOURS } from "@/config/workflow";

/** Shown as "Last updated". Change it when the text changes. */
export const COMPLIANCE_UPDATED = "2026-11-21";

export const COMPLIANCE_SECTIONS = {
  synthetic:
    "Sample people, balances, holdings and messages are made up. Sample fund names are fictional. Any statistic shown cites a source and an as-of date; those without one are marked “to verify”.",
  privacy: [
    `Stored in this browser tab for the session and cleared after ${CONSTANTS.idleMinutes} idle minutes unless you choose to remember it for ${CONSTANTS.rememberHours} hours.`,
    `Demo data held on the demo server is deleted after ${RETENTION_HOURS} hours without activity, or at once when you press Delete my data.`,
    "Free text sent for analysis has phone numbers, emails and long numbers removed first. Names are not reliably removed, so please do not type them.",
    "Language is the only preference that is kept after the session.",
  ],
  ai: [
    "AI writes words from numbers that fixed formulas compute. It does not calculate or decide.",
    "It can be wrong or miss context. Every plan is marked as a draft until a person reviews it.",
    "It cannot give stock tips or promise returns; such text is blocked.",
    "Each output shows whether it came from a live model or a template.",
  ],
  regulatory:
    "Personal investment advice is a regulated activity. A real service would need an appropriately registered adviser or partner, suitability and risk profiling, client agreements, fee and conflict disclosures, record retention and a data protection review. None of these are claimed here. Confirm requirements with qualified counsel.",
  consent:
    "Before a review is requested you see the demo terms and fee information and acknowledge them. The acknowledgement is recorded in the audit trail. You can delete your demo data at any time. Ticking the box is not an e-signature and creates nothing legally binding.",
  conflicts:
    "This demo takes no product commissions and no referral income, and sells nothing. A real service would have to disclose every conflict and fee before a plan is read. The page How we earn shows the current position, and its figures are placeholders.",
} as const;
