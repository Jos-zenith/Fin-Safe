import type { Adviser } from "@/types";

// Synthetic persona. There is deliberately NO registration-number field.
export const ADVISER: Adviser = {
  id: "meera",
  name: "Dr. Meera Iyer",
  isSynthetic: true,
  title: "Synthetic adviser (demo)",
  languages: ["en", "hi", "ta"],
};

// Exact wording required by the PRD (section 3.3).
export const DEMO_WORKFLOW_SENTENCE =
  "Demo workflow. Approvals here simulate a review process and are not regulated investment advice.";
export const REVIEWED_SENTENCE =
  "Reviewed in a demo workflow by a synthetic adviser persona. Not real investment advice.";
export const ADVISER_CARD_SENTENCE =
  "Synthetic adviser - demo persona; not a real SEBI-registered adviser.";
export const NO_REGISTRATION = "No registration (demo persona)";
export const ACK_SENTENCE = "I understand this is a demo workflow and not real advice.";
