export type { PlanItem, PlanPack, SecondOpinionResult, AssetClass, PlanTopic } from "@/lib/ai/schemas";
import type { PlanPack } from "@/lib/ai/schemas";

export type Lang = "en" | "hi" | "ta";
export type Role = "user" | "adviser";
export type PersonaId = "priya" | "ramesh" | "anita" | "fresh";

export type GoalKind = "home" | "education" | "retirement" | "travel" | "wedding" | "other";
export interface Goal {
  id: string;
  kind: GoalKind;
  /** The amount needed, in TODAY's money. The engine also shows it inflation-adjusted at the goal date. */
  targetAmount: number;
  years: number;
  /** Savings already set aside for this goal. Deducted (with growth) before the monthly amount is worked out. */
  savedSoFar?: number;
}
export interface Debt {
  id: string;
  label: string;
  outstanding: number;
  ratePct: number;
  emi: number;
}
export interface InsurancePolicy {
  id: string;
  kind: "term" | "health";
  cover: number;
}
export type HoldingClass = "equity" | "debt" | "gold" | "international_equity" | "other";
export interface Holding {
  id: string;
  /** Generic fictional label, e.g. "Sample Equity Fund A". */
  label: string;
  assetClass: HoldingClass;
  amount: number;
}

/** Income in a good and a bad month (a typical month is `monthlyIncome`). `history` is up to 12 recent months, newest last. */
export interface IncomeMonths {
  good: number;
  bad: number;
  history?: number[];
}

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  cityTier: 1 | 2 | 3;
  language: Lang;
  incomeStable: boolean;
  monthlyIncome: number;
  essentialExpenses: number;
  otherExpenses: number;
  dependents: number;
  familySize: number;
  liquidSavings: number;
  goals: Goal[];
  debts: Debt[];
  insurance: InsurancePolicy[];
  holdings: Holding[];
  risk: { onFall: "sell" | "wait" | "buy"; followsTips: boolean };
  /** Optional: income in a good and a bad month. Without it, "irregular income" uses stated defaults. */
  incomeMonths?: IncomeMonths;
  /** Optional: term cover through an employer. Not entered means UNKNOWN, which the results say. */
  employerTermCover?: number;
  /** Field ids the customer ticked as correct on the "Check your answers" screen. */
  confirmed?: string[];
  isSynthetic: true;
}

// ---- Engine ----
export type Unit = "inr" | "months" | "percent" | "ratio" | "count" | "years" | "score";

export interface CalcResult {
  id: string;
  value: number | Record<string, number>;
  unit: Unit;
  /** Per-key unit overrides when `value` is an object. */
  subUnits?: Record<string, Unit>;
  formula: string;
  inputs: Record<string, number | string | boolean>;
  assumptions: string[];
  /** Ids from src/config/assumptions.ts that this result depends on. */
  assumptionIds: string[];
}

// ---- The priority ladder (see src/lib/engine/ladder.ts) ----
export type LadderStepId = "cash_flow" | "liquidity" | "debt" | "protection" | "goals";
/** blocked = fix this first; attention = needs work but does not hold goals back; ok; later = held back by an earlier step. */
export type LadderStatus = "blocked" | "attention" | "ok" | "later";
export interface LadderStep {
  id: LadderStepId;
  status: LadderStatus;
  /** A short code for WHY (for example "shortfall", "high_cost"). The UI and the plan text turn it into words. */
  reason: string;
  /** Engine keys that show the numbers behind this step. */
  metricKeys: string[];
  assumptionIds: string[];
}
export interface Ladder {
  steps: LadderStep[];
  /** The first step that is blocked, if any. */
  firstBlocker: LadderStepId | null;
  /** The first step that is blocked or needs attention, if any (the "current step"). */
  firstOpen: LadderStepId | null;
  /** True when a step is blocked: goal amounts are then shown only as "later", never as the action. */
  goalsLater: boolean;
}

export type FlagSeverity = "high" | "medium" | "low";
export interface EngineFlag {
  id:
    | "cash_shortfall"
    | "cash_tight"
    | "bad_month_stress"
    | "ef_low"
    | "term_gap"
    | "health_gap"
    | "high_cost_debt"
    | "dti_high"
    | "savings_low"
    | "concentration"
    | "overlap_high"
    | "tip_following"
    | "irregular_income"
    | "panic_sell";
  severity: FlagSeverity;
  metric?: string;
}

export interface EngineResult {
  results: CalcResult[];
  /** Flattened numeric ground truth: key -> number. */
  flat: Record<string, number>;
  /** Unit for every flat key (drives formatting). */
  units: Record<string, Unit>;
  flags: EngineFlag[];
  /** What comes first: cash flow, then the reserve, loans, cover, and only then goal investing. */
  ladder: Ladder;
}

// ---- Cases & audit ----
export type CaseStatus = "INTAKE_DONE" | "DRAFT_READY" | "IN_REVIEW" | "CHANGES_REQUESTED" | "APPROVED";
export type Actor = "user" | "ai" | "adviser" | "system";
export type Decision = "pending" | "accepted" | "edited" | "rejected";

export interface ItemReview {
  decision: Decision;
  comment?: string;
  edit?: { rationale: string; lang: Lang };
  /** Milliseconds the adviser had this item open before deciding (capped; never text). */
  dwellMs?: number;
}

/** Where one piece of AI-prepared text came from. */
export type TextSource = "mock" | "provider" | "fixture";
/**
 * Progress of preparing a case's findings and plan. Findings are ready first, then the plan; each is timed on its own.
 * A case is not in the adviser's queue until `state` is "ready".
 */
export interface GenRecord {
  state: "generating" | "ready" | "failed";
  stage: "findings" | "plan" | "done";
  startedAt: string;
  /** How many times preparation has been attempted (a retry adds one). */
  attempts: number;
  /** Plain-language findings, available before the plan (finding key -> text). */
  findings?: Record<string, string>;
  findingsMs?: number;
  findingsSource?: TextSource;
  planMs?: number;
  planSource?: TextSource;
}

export type RiskCategory = "cautious" | "moderate" | "balanced" | "growth";
/** The customer's questionnaire answers, the computed label, and the adviser's confirmation. A label for discussion only. */
export interface RiskRecord {
  answers: Record<string, number>;
  category: RiskCategory;
  scores: { capacity: number; willingness: number; horizon: number; experience: number };
  checks: string[];
  completedAt: string;
  confirmedBy?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  /** True for a seeded demo case: nobody answered these. */
  seeded?: boolean;
}
/** The customer's recorded demo consent. NOT an e-signature: nothing legally binding is created. */
export interface ConsentRecord {
  at: string;
  version: string;
  language: Lang;
  /** The disclosures the customer was shown (fee, conflicts, what the demo is, no e-signature, data). */
  shown: string[];
  seeded?: boolean;
}

export interface Adviser {
  id: string;
  name: string;
  isSynthetic: true;
  title: string;
  languages: Lang[];
}

export interface CopilotOut {
  /** Where the text came from (filled in by the server). */
  source?: "mock" | "provider" | "fixture";
  agenda: string[];
  rationaleSummary: string;
  followUps: string[];
  meetingNotes: string;
}

export interface Case {
  id: string;
  personaId: PersonaId;
  profile: UserProfile;
  status: CaseStatus;
  urgent: boolean;
  /** Frozen AI draft. Adviser changes live in `reviews`. */
  plan: PlanPack;
  reviews: Record<string, ItemReview>;
  checklist: Record<string, boolean>;
  adviserQuestion?: string;
  userReply?: string;
  copilot?: CopilotOut;
  /** Where the draft text came from: a template (mock mode), the live model, or a safe fallback. */
  planSource?: "mock" | "provider" | "fixture";
  /** The version of the AI draft this case is on (a new version is frozen when the plan is regenerated). */
  planVersion?: number;
  /** Who is waiting on whom (filled in by the server). */
  waitingSince?: string;
  slaDueAt?: string;
  waitingMinutes?: number;
  overdue?: boolean;
  /** The adviser who has claimed this case, if any. */
  claimedBy?: { id: string; name: string } | null;
  /** Engine flags and the queue priority score, for the adviser's queue. */
  flags?: EngineFlag[];
  priority?: number;
  /** The recorded risk profile, the consent, the customer's acceptance of the reviewed plan, and any reported error. */
  gen?: GenRecord | null;
  risk?: RiskRecord | null;
  consent?: ConsentRecord | null;
  acceptedAt?: string;
  flagged?: boolean;
  flagNote?: string;
  /** Server version, for optimistic concurrency. */
  version?: number;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
}

/** One audit row as the server returns it (see src/server/store/types.ts AuditRec). */
export interface AuditEntry {
  id: string;
  caseId: string | null;
  userId: string;
  actor: Actor;
  action: string;
  before: string | null;
  after: string | null;
  evidenceRefs: string[];
  disclosuresShown: string[];
  timestamp: string;
}

export type NudgeRuleId = "cash_flow" | "ef_low" | "insurance_gap" | "sip_review" | "rebalance";
export interface Nudge {
  ruleId: NudgeRuleId;
  goalId?: string;
  text?: string;
}

export interface AppState {
  v: 1;
  touched: boolean;
  noticeSeen: boolean;
  lang: Lang;
  personaId: PersonaId | null;
  profile: UserProfile | null;
  /** Save-and-resume position for the intake stepper. */
  intakeStep: number;
  intakeDone: boolean;
  /** Optional "Improve accuracy" questions already answered. */
  extras?: string[];
  fallSimulated: boolean;
  remember: boolean;
}
