// Goal explorer maths ("what if I save this much / start a year later?"). Pure and deterministic.
// Every figure the explorer shows comes from here, never from the model. Constants come from the registry.
import type { CalcResult } from "@/types";
import { GOAL_ASSUMPTION_IDS, inflate, monthsIn, scenarioParams, sipFor, type Scenario } from "./index";

interface GoalLike {
  id?: string;
  targetAmount: number;
  years: number;
  savedSoFar?: number;
}

/** Value of a monthly SIP after `years` at a NET yearly return (end-of-month deposits, monthly compounding). */
export function sipValue(monthly: number, years: number, netPct: number, delayYears = 0): number {
  const m = Math.max(0, monthsIn(years) - Math.round(delayYears * 12));
  const r = netPct / 100 / 12;
  return r === 0 ? monthly * m : monthly * ((Math.pow(1 + r, m) - 1) / r);
}

/** Existing savings (grown) plus the new monthly deposits, at `year` years from now. */
export function corpusAt(g: GoalLike, monthly: number, year: number, netPct: number, delayYears = 0): number {
  const n = Math.round(year * 12);
  const m = Math.max(0, n - Math.round(delayYears * 12));
  const r = netPct / 100 / 12;
  const lump = (g.savedSoFar ?? 0) * Math.pow(1 + r, n);
  return lump + (r === 0 ? monthly * m : monthly * ((Math.pow(1 + r, m) - 1) / r));
}

/** Corpus at the end of each year, 0..years, for the chart. */
export function corpusSeries(g: GoalLike, monthly: number, netPct: number, delayYears = 0): number[] {
  return Array.from({ length: Math.round(g.years) + 1 }, (_, y) => corpusAt(g, monthly, y, netPct, delayYears));
}

/** The amount needed at the goal date in the given scenario. */
export const futureTarget = (g: GoalLike, s: Scenario) => inflate(g.targetAmount, g.years, scenarioParams(s).inflationPct);

/**
 * Cost of waiting: starting `delayYears` later means fewer deposit months, so the monthly amount that still
 * reaches the same goal date target is higher. Null when the delay uses up the whole horizon.
 */
export function costOfDelay(g: GoalLike, delayYears: number, scenario: Scenario = "base"): { now: number; later: number; extra: number } | null {
  if (g.years - delayYears < 1) return null;
  const p = scenarioParams(scenario);
  const target = futureTarget(g, scenario);
  const now = sipFor(target, g.years, p.netReturnPct, g.savedSoFar ?? 0);
  const later = sipFor(target, g.years, p.netReturnPct, g.savedSoFar ?? 0, delayYears);
  return { now, later, extra: later - now };
}

/** Round to the nearest step (the slider works in ₹500 steps). */
export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function exploreGoal(g: GoalLike & { id: string }, monthly: number, delayYears = 1): CalcResult {
  const at = (s: Scenario) => corpusAt(g, monthly, g.years, scenarioParams(s).netReturnPct);
  const base = at("base");
  const target = futureTarget(g, "base");
  const delay = costOfDelay(g, delayYears, "base");
  return {
    id: `explore.${g.id}`,
    value: {
      monthly,
      low: at("low"),
      base,
      high: at("high"),
      today: g.targetAmount,
      target,
      baseInTodaysMoney: base / Math.pow(1 + scenarioParams("base").inflationPct / 100, g.years),
      shortfallBase: Math.max(0, target - base),
      delayExtra: delay?.extra ?? 0,
    },
    unit: "inr",
    formula: "outcome = savedSoFar x (1 + r)^n + monthly x ((1 + r)^n - 1) / r, r = (return - fee) / 12, n = years x 12; goal date amount = today's amount x (1 + inflation)^years; waiting removes deposit months",
    inputs: { monthly, years: g.years, target: g.targetAmount, savedSoFar: g.savedSoFar ?? 0, delayYears },
    assumptions: [
      "Demo constants marked TO_VERIFY. Returns and inflation are illustrative scenarios, never a promise.",
      "The amount is in today's money and is raised for inflation to the goal date.",
      "Savings already set aside for this goal are counted, with growth. Returns are after an assumed fee.",
      "Taxes are not included.",
    ],
    assumptionIds: GOAL_ASSUMPTION_IDS,
  };
}
