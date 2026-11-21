import { z } from "zod";

// Asset-class level only. There is NO free-text instrument field anywhere in these schemas.
export const ASSET_CLASSES = [
  "liquid_reserve",
  "debt",
  "equity",
  "gold",
  "international_equity",
  "insurance_cover",
  "debt_repayment",
  "other_planning",
] as const;

export const PLAN_TOPICS = [
  "inputs_missing",
  "cash_flow",
  "cash_tight",
  "loan_load",
  "goals_later",
  "emergency_reserve",
  "high_cost_debt",
  "term_cover",
  "health_cover",
  "speculation_guard",
  "goal_short",
  "goal_mid",
  "goal_long",
  "diversify",
  "gold_balance",
] as const;

export const LangSchema = z.enum(["en", "hi", "ta"]);

export const PlanItemSchema = z.strictObject({
  id: z.string().min(1).max(40),
  topic: z.enum(PLAN_TOPICS),
  assetClass: z.enum(ASSET_CLASSES),
  goalRef: z.string().max(20).optional(),
  title: z.string().min(1).max(160),
  rationale: z.string().min(1).max(900),
  risks: z.string().min(1).max(600),
  rangeNote: z.string().max(300).optional(),
  evidenceRefs: z.array(z.string().max(60)).max(12),
});

export const PlanPackSchema = z.strictObject({
  lang: LangSchema,
  summary: z.string().min(1).max(600),
  priorities: z.array(z.string()).max(12),
  items: z.array(PlanItemSchema).min(1).max(10),
  checklist: z.array(z.string().max(200)).max(8),
  adviserQuestions: z.array(z.string().max(240)).max(8),
});

export const FINDING_KEYS = ["score", "cash", "ef", "term", "health", "debt", "savings", "goals", "portfolio"] as const;
export const FindingsSchema = z.strictObject({
  findings: z.strictObject({
    score: z.string().max(400).optional(),
    cash: z.string().max(400).optional(),
    ef: z.string().max(400).optional(),
    term: z.string().max(400).optional(),
    health: z.string().max(400).optional(),
    debt: z.string().max(400).optional(),
    savings: z.string().max(400).optional(),
    goals: z.string().max(400).optional(),
    portfolio: z.string().max(400).optional(),
  }),
});

export const FLAG_TYPES = [
  "guaranteed_returns",
  "urgency_pressure",
  "insider_claim",
  "missing_disclosure",
  "unregistered_signal",
  "leverage",
  "pump_pattern",
  "commission_conflict",
  "credential_request",
  "phishing_link",
  "payment_to_individual",
  "unlisted_offering",
  "advance_fee",
  "false_authority",
  "exclusive_selection",
  "impersonation",
  "private_channel",
  "new_payee",
  "implied_certainty",
] as const;

export const SecondOpinionSchema = z.strictObject({
  overall: z.enum(["low", "medium", "high"]),
  summary: z.string().max(300),
  flags: z
    .array(
      z.strictObject({
        type: z.enum(FLAG_TYPES),
        severity: z.enum(["low", "medium", "high"]),
        quote: z.string().max(300),
        explanation: z.string().max(500),
      }),
    )
    .max(10),
  questions: z.array(z.string().max(240)).max(8),
  educationalNote: z.string().max(500),
});

export const CopilotSchema = z.strictObject({
  agenda: z.array(z.string().max(200)).max(6),
  rationaleSummary: z.string().max(700),
  followUps: z.array(z.string().max(200)).max(6),
  meetingNotes: z.string().max(900),
});

export const NudgeSchema = z.strictObject({ text: z.string().min(1).max(300) });
export const AnswerSchema = z.strictObject({
  answer: z.string().min(1).max(900),
  refused: z.boolean(),
  /** Why it was refused: a specific security, or a market / price prediction. */
  kind: z.enum(["security", "prediction"]).optional(),
});

export type PlanItem = z.infer<typeof PlanItemSchema>;
export type PlanPack = z.infer<typeof PlanPackSchema>;
export type AssetClass = (typeof ASSET_CLASSES)[number];
export type PlanTopic = (typeof PLAN_TOPICS)[number];
export type Findings = z.infer<typeof FindingsSchema>;
export type SecondOpinionResult = z.infer<typeof SecondOpinionSchema>;
export type CopilotResult = z.infer<typeof CopilotSchema>;
export type NudgeResult = z.infer<typeof NudgeSchema>;
export type AnswerResult = z.infer<typeof AnswerSchema>;

export type TaskName = "explainFindings" | "draftPlanPack" | "secondOpinion" | "adviserCopilot" | "nudgeCopy" | "answerQuestion";

export const TASK_SCHEMAS = {
  explainFindings: FindingsSchema,
  draftPlanPack: PlanPackSchema,
  secondOpinion: SecondOpinionSchema,
  adviserCopilot: CopilotSchema,
  nudgeCopy: NudgeSchema,
  answerQuestion: AnswerSchema,
} as const;

/** Keys whose string values are identifiers or verbatim user quotes, not AI prose. */
export const NON_PROSE_KEYS = new Set([
  "id",
  "topic",
  "assetClass",
  "goalRef",
  "evidenceRefs",
  "priorities",
  "type",
  "severity",
  "overall",
  "lang",
  "quote",
]);
