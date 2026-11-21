// The demo risk profile: a short structured questionnaire (capacity and willingness to bear loss, horizon, experience)
// and a computed category. It is a LABEL FOR DISCUSSION. It is not a suitability finding, not a rating of the person,
// and not regulated risk profiling (docs/PRODUCTION_GAP.md says what a real process needs).
//
// Principle: the category follows the LOWER of what the person can afford to lose and what they are willing to bear,
// and a short horizon or no experience can only pull it down, never up.
import { av } from "@/config/assumptions";
import type { EngineResult, RiskCategory, UserProfile } from "@/types";

export const RISK_QUESTIONS = [
  { id: "cushion", group: "capacity" },
  { id: "fall", group: "willingness" },
  { id: "swing", group: "willingness" },
  { id: "horizon", group: "horizon" },
  { id: "years", group: "experience" },
  { id: "past", group: "experience" },
] as const;
export type RiskQuestionId = (typeof RISK_QUESTIONS)[number]["id"];
/** Each answer is the index of the chosen option (0 to 3). */
export type RiskAnswers = Partial<Record<RiskQuestionId, number>>;
export const RISK_OPTIONS = 4;
export const RISK_CATEGORIES: readonly RiskCategory[] = ["cautious", "moderate", "balanced", "growth"];

export const riskComplete = (a: RiskAnswers | null | undefined): a is Required<RiskAnswers> =>
  !!a && RISK_QUESTIONS.every((q) => Number.isInteger(a[q.id]) && (a[q.id] as number) >= 0 && (a[q.id] as number) < RISK_OPTIONS);

/** What the numbers say about capacity, whatever the person answered: 0 (blocked) to 3 (reserve at target). */
function engineCapacity(e: EngineResult): number {
  if (e.ladder.goalsLater) return 0;
  const months = e.flat["ef.months"] ?? 0;
  if (months >= (e.flat["ef.target"] ?? Infinity)) return 3;
  return months >= av("ef.months.critical") ? 2 : 1;
}

export interface RiskResult {
  scores: { capacity: number; willingness: number; horizon: number; experience: number };
  category: RiskCategory;
  /** Codes for answers that do not fit the person's own numbers or each other (the adviser reads them). */
  checks: string[];
}

/** Needs a complete set of answers; the engine result of the profile supplies the capacity check. */
export function scoreRisk(a: Required<RiskAnswers>, p: UserProfile, e: EngineResult): RiskResult {
  const capacity = Math.min(a.cushion, engineCapacity(e));
  const willingness = Math.floor((a.fall + a.swing) / 2);
  const horizon = a.horizon;
  const experience = Math.floor((a.years + a.past) / 2);

  let level = Math.min(capacity, willingness);
  if (horizon <= 1) level = Math.min(level, horizon); // money needed soon cannot take much loss
  if (experience === 0) level = Math.min(level, 2); // no experience of a fall: never the top category on answers alone
  const category = RISK_CATEGORIES[Math.max(0, Math.min(3, level))];

  const checks: string[] = [];
  if (a.cushion > engineCapacity(e)) checks.push("cushion_vs_numbers");
  if (a.fall >= 2 && a.past === 1) checks.push("fall_vs_history");
  const nearest = p.goals.length ? Math.min(...p.goals.map((g) => g.years)) : null;
  if (nearest !== null && a.horizon >= 2 && nearest <= 3) checks.push("horizon_vs_goals");
  return { scores: { capacity, willingness, horizon, experience }, category, checks };
}
