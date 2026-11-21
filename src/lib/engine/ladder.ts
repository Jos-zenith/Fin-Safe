// The priority ladder. Deterministic, no LLM. It answers "what comes first?" so that a plan never leads with a goal
// amount for someone whose month does not add up, who has almost no reserve, who is carrying costly or heavy loans,
// or whose dependents are barely covered.
//
//   1. Cash flow   income - essentials - other spending - EMIs. Negative or near zero blocks everything below.
//   2. Liquidity   months of essential costs saved, against the target for steady or irregular income.
//   3. Loans       high-cost debt, and the share of income that loan payments take.
//   4. Protection  term cover (income multiple AND debts) when people depend on the income; health cover.
//   5. Goals       reached only when steps 1 to 4 are not blocked. Until then goal amounts are shown as "later".
//
// Every threshold is read from the assumption registry (src/config/assumptions.ts). The ladder is a planning ORDER
// for discussion with a reviewer. It never says to buy, sell or prepay a named product.
import { av } from "@/config/assumptions";
import type { Ladder, LadderStep, LadderStepId, UserProfile } from "@/types";

export const LADDER_ORDER: readonly LadderStepId[] = ["cash_flow", "liquidity", "debt", "protection", "goals"];

/** Used where an engine result is built by hand (for example the evidence sheet of the goal explorer). */
export const NO_LADDER: Ladder = { steps: [], firstBlocker: null, firstOpen: null, goalsLater: false };

const step = (id: LadderStepId, status: LadderStep["status"], reason: string, metricKeys: string[], assumptionIds: string[]): LadderStep => ({ id, status, reason, metricKeys, assumptionIds });

export function buildLadder(p: UserProfile, flat: Record<string, number>): Ladder {
  // 1. cash flow
  const cash =
    p.monthlyIncome <= 0
      ? step("cash_flow", "blocked", "no_income", ["cash.income"], [])
      : flat["cash.surplus"] < 0
        ? step("cash_flow", "blocked", "shortfall", ["cash.surplus", "cash.shortfall", "cash.income", "cash.emi"], ["cashflow.near_zero_pct"])
        : flat["cash.surplusPct"] < av("cashflow.near_zero_pct")
          ? step("cash_flow", "blocked", "near_zero", ["cash.surplus", "cash.surplusPct", "cash.income", "cash.emi"], ["cashflow.near_zero_pct"])
          : step("cash_flow", "ok", "ok", ["cash.surplus", "cash.income"], ["cashflow.near_zero_pct"]);

  // 2. liquidity
  const efIds = ["ef.months.stable", "ef.months.irregular", "ladder.liquidity_severe_months"];
  const liquidity =
    p.essentialExpenses <= 0
      ? step("liquidity", "blocked", "no_essentials", ["ef.months"], efIds)
      : flat["ef.months"] < av("ladder.liquidity_severe_months")
        ? step("liquidity", "blocked", "severe", ["ef.months", "ef.target", "ef.gap"], efIds)
        : flat["ef.months"] < flat["ef.target"]
          ? step("liquidity", "attention", "below_target", ["ef.months", "ef.target", "ef.gap"], efIds)
          : step("liquidity", "ok", "ok", ["ef.months", "ef.target"], efIds);

  // 3. loans: costly debt, or loan payments above the heavy-load mark
  const debtIds = ["debt.highcost_threshold", "debt.dti_high"];
  const debt =
    flat["debt.highCost.count"] > 0
      ? step("debt", "blocked", "high_cost", ["debt.highCost.rate", "debt.highCost.threshold", "debt.dti"], debtIds)
      : flat["debt.dti"] > av("debt.dti_high")
        ? step("debt", "blocked", "heavy", ["debt.dti"], debtIds)
        : step("debt", "ok", p.debts.length ? "ok" : "none", ["debt.dti"], debtIds);

  // 4. protection: people who depend on the income and cover below the severe mark block; other gaps need attention
  const insIds = ["insurance.severe_ratio", "insurance.term.multiple_base", "insurance.health.base.tier1"];
  const termSevere = p.dependents > 0 && flat["ins.term.cover"] < flat["ins.term.needed"] * av("insurance.severe_ratio");
  const protection = termSevere
    ? step("protection", "blocked", "term_gap", ["ins.term.cover", "ins.term.needed", "ins.term.gap"], insIds)
    : flat["ins.term.gap"] > 0 || flat["ins.health.gap"] > 0
      ? step("protection", "attention", "gaps", ["ins.term.gap", "ins.health.gap"], insIds)
      : step("protection", "ok", "ok", ["ins.term.cover", "ins.health.cover"], insIds);

  const before = [cash, liquidity, debt, protection];
  const blocked = before.some((s) => s.status === "blocked");
  // 5. goals: held back while any earlier step is blocked
  const goals = blocked
    ? step("goals", "later", p.goals.length ? "later" : "none", [], [])
    : step("goals", "ok", p.goals.length ? "ready" : "none", p.goals.map((g) => `goal.${g.id}.sip`), []);

  const steps = [...before, goals];
  return {
    steps,
    firstBlocker: before.find((s) => s.status === "blocked")?.id ?? null,
    firstOpen: before.find((s) => s.status !== "ok")?.id ?? null,
    goalsLater: blocked,
  };
}
