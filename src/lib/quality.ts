// Input quality: what is missing, what looks implausible, and how much to trust each number.
//
// Pure and deterministic. A confidence label is derived from two things only:
//   1. input completeness: a missing KEY input means the number "cannot be calculated reliably" (confidence low);
//      a default, a missing optional answer or an implausible answer lowers it to medium;
//   2. unverified assumptions: while any assumption behind the metric is still unreviewed, it can never be "high".
// Nothing here judges the person. It says where a figure may be wrong and why.
import { av, unverifiedIn, type Reviews } from "@/config/assumptions";
import { findResult } from "@/lib/engine";
import type { EngineResult, UserProfile } from "@/types";

export type Confidence = "low" | "medium" | "high";

/** The things a person told us (or did not). Each maps to one intake question. */
export const FIELDS = ["monthlyIncome", "essentialExpenses", "otherExpenses", "liquidSavings", "debts", "dependents", "goals", "goalSaved", "incomeStable", "incomeMonths", "city", "term", "health", "employerTermCover", "holdings"] as const;
export type FieldId = (typeof FIELDS)[number];

/** Fields that have a default when the person has not answered the optional question. */
export const OPTIONAL_FIELD_STEP: Partial<Record<FieldId, string>> = {
  otherExpenses: "other",
  incomeStable: "income",
  incomeMonths: "incomeMonths",
  city: "city",
  term: "term",
  health: "health",
  employerTermCover: "employer",
  goalSaved: "goalSaved",
  holdings: "holdings",
};

export type MetricId = "cash" | "ef" | "term" | "health" | "debt" | "savings" | "goal" | "portfolio";
export type IssueCode =
  | "income_missing"
  | "essentials_missing"
  | "no_insurance"
  | "income_below_essentials"
  | "emi_above_income"
  | "family_mismatch"
  | "goal_in_past"
  | "round_values"
  | "employer_unknown"
  | "defaults_used";
export interface Issue {
  code: IssueCode;
  kind: "missing" | "implausible" | "default";
  fields: FieldId[];
}

export interface MetricQuality {
  level: Confidence;
  /** A key input is missing: say "Cannot calculate reliably" instead of showing a number. */
  cannot: boolean;
  /** Key inputs that are missing (the reason for `cannot`). */
  missing: FieldId[];
  /** Optional answers not given, so a stated default was used. */
  defaults: FieldId[];
  /** Answers behind this metric that look off. */
  implausible: FieldId[];
  /** Assumption ids behind this metric that nobody has reviewed. */
  unverified: string[];
}

export interface Quality {
  issues: Issue[];
  metrics: Record<MetricId, MetricQuality>;
  /** True when any key input is missing. */
  incomplete: boolean;
}

const SPEC: Record<MetricId, { required: FieldId[]; optional: FieldId[]; key: string }> = {
  cash: { required: ["monthlyIncome", "essentialExpenses"], optional: ["otherExpenses"], key: "cash" },
  ef: { required: ["essentialExpenses"], optional: ["incomeStable", "incomeMonths"], key: "ef.target" },
  term: { required: ["monthlyIncome"], optional: ["term", "employerTermCover"], key: "ins.term" },
  health: { required: [], optional: ["health", "city"], key: "ins.health" },
  debt: { required: ["monthlyIncome"], optional: [], key: "debt.dti" },
  savings: { required: ["monthlyIncome", "essentialExpenses"], optional: ["otherExpenses"], key: "save" },
  goal: { required: ["monthlyIncome", "essentialExpenses"], optional: ["goalSaved"], key: "goal" },
  portfolio: { required: [], optional: ["holdings"], key: "conc" },
};

/** Which metrics an implausible-answer issue puts in doubt. */
const TOUCHES: Partial<Record<IssueCode, MetricId[]>> = {
  income_below_essentials: ["cash", "savings", "goal", "ef"],
  emi_above_income: ["cash", "debt", "savings", "goal"],
  family_mismatch: ["term", "health"],
  goal_in_past: ["goal"],
  round_values: ["cash", "ef", "savings"],
  no_insurance: ["term", "health"],
};

/** An amount that is a 1 or a 5 followed only by zeros, at or above the registry's minimum: 50,000, 1,00,000, 10,00,000. */
const looksRound = (n: number) => n >= av("quality.round_min_inr") && /^[15]0+$/.test(String(Math.round(n)));

/**
 * `answered` is the set of optional intake steps the person has answered (browser state). Without it (for example on
 * the adviser's side) defaults cannot be told from answers, so no "default" issue is reported.
 */
export function assessProfile(p: UserProfile, e: EngineResult, opts: { answered?: ReadonlySet<string>; reviews?: Reviews } = {}): Quality {
  const issues: Issue[] = [];
  const emi = p.debts.reduce((a, d) => a + d.emi, 0);

  if (p.monthlyIncome <= 0) issues.push({ code: "income_missing", kind: "missing", fields: ["monthlyIncome"] });
  if (p.essentialExpenses <= 0) issues.push({ code: "essentials_missing", kind: "missing", fields: ["essentialExpenses"] });
  if (!p.insurance.length) issues.push({ code: "no_insurance", kind: "missing", fields: ["term", "health"] });
  if (p.monthlyIncome > 0 && p.essentialExpenses > 0 && p.monthlyIncome < p.essentialExpenses) issues.push({ code: "income_below_essentials", kind: "implausible", fields: ["monthlyIncome", "essentialExpenses"] });
  if (p.monthlyIncome > 0 && emi > p.monthlyIncome) issues.push({ code: "emi_above_income", kind: "implausible", fields: ["debts", "monthlyIncome"] });
  if (p.dependents === 0 && p.familySize > 1) issues.push({ code: "family_mismatch", kind: "implausible", fields: ["dependents"] });
  if (p.goals.some((g) => !(g.years > 0))) issues.push({ code: "goal_in_past", kind: "implausible", fields: ["goals"] });
  const round = [p.monthlyIncome, p.essentialExpenses, p.liquidSavings].filter(looksRound);
  if (round.length >= av("quality.round_count")) issues.push({ code: "round_values", kind: "implausible", fields: ["monthlyIncome", "essentialExpenses", "liquidSavings"] });
  // judged from the data itself, so a demo persona that "answered everything" is still told what is only a default
  if (p.dependents > 0 && p.employerTermCover === undefined) issues.push({ code: "employer_unknown", kind: "default", fields: ["employerTermCover"] });

  // optional answers still at their defaults
  const byData: FieldId[] = [];
  if (!p.incomeStable && !p.incomeMonths) byData.push("incomeMonths"); // "irregular" with no good/bad month figures
  if (p.dependents > 0 && p.employerTermCover === undefined) byData.push("employerTermCover");
  const byAnswer: FieldId[] = opts.answered
    ? (Object.entries(OPTIONAL_FIELD_STEP) as [FieldId, string][]).filter(([f, step]) => f !== "employerTermCover" && f !== "incomeMonths" && !opts.answered!.has(step)).map(([f]) => f)
    : [];
  const defaulted: FieldId[] = [...byAnswer, ...byData];
  const listed = defaulted.filter((f) => f !== "employerTermCover"); // the employer line has its own sentence
  if (listed.length) issues.push({ code: "defaults_used", kind: "default", fields: listed });

  const bad = (m: MetricId) => issues.filter((i) => i.kind === "implausible" && TOUCHES[i.code]?.includes(m)).flatMap((i) => i.fields);
  const metrics = {} as Record<MetricId, MetricQuality>;
  for (const [id, spec] of Object.entries(SPEC) as [MetricId, (typeof SPEC)[MetricId]][]) {
    const missing = spec.required.filter((f) => (f === "monthlyIncome" ? p.monthlyIncome <= 0 : f === "essentialExpenses" ? p.essentialExpenses <= 0 : false));
    const defaults = spec.optional.filter((f) => defaulted.includes(f));
    const implausible = [...new Set(bad(id))];
    const noCover = id === "term" || id === "health" ? issues.some((i) => i.code === "no_insurance") : false;
    const result = id === "goal" ? findResult(e, p.goals[0] ? `goal.${p.goals[0].id}.sip` : "ef.target") : findResult(e, spec.key);
    const unverified = unverifiedIn(result?.assumptionIds ?? [], opts.reviews);
    const cannot = missing.length > 0;
    let level: Confidence = cannot ? "low" : defaults.length || implausible.length || noCover ? "medium" : "high";
    if (level === "high" && unverified.length) level = "medium"; // nobody has reviewed the assumptions behind it
    metrics[id] = { level, cannot, missing, defaults, implausible, unverified };
  }
  return { issues, metrics, incomplete: issues.some((i) => i.kind === "missing" && (i.code === "income_missing" || i.code === "essentials_missing")) };
}

/** The field ids a "Check your answers" screen must put in front of the person, in order. */
export const CONFIRM_FIELDS: FieldId[] = ["monthlyIncome", "essentialExpenses", "otherExpenses", "liquidSavings", "debts", "dependents", "goals", "goalSaved", "incomeStable", "incomeMonths", "city", "term", "health", "employerTermCover", "holdings"];

/** Fields the person has not ticked as right. */
export const unconfirmed = (p: UserProfile): FieldId[] => CONFIRM_FIELDS.filter((f) => !(p.confirmed ?? []).includes(f));
