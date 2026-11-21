// Deterministic financial engine. Pure functions, no LLM, no I/O.
// Every function returns { id, value, unit, formula, inputs, assumptions, assumptionIds }.
// Financial constants come ONLY from src/config/assumptions.ts (tests/assumptions.test.ts enforces it).
import { av } from "@/config/assumptions";
import { PRIORITY_WEIGHT } from "@/config/workflow";
import { SAMPLE_FUNDS, UNKNOWN_SECTOR } from "@/data/lookup";
import type { CalcResult, EngineFlag, EngineResult, Holding, Ladder, NudgeRuleId, Unit, UserProfile } from "@/types";
import { buildLadder } from "./ladder";

export { LADDER_ORDER, NO_LADDER, buildLadder } from "./ladder";

const NOTE_DEMO = "Demo constants, marked TO_VERIFY until an adviser reviews them.";

interface CalcOpts {
  notes?: string[];
  sub?: Record<string, Unit>;
  ids?: string[];
}

function calc(id: string, value: number | Record<string, number>, unit: Unit, formula: string, inputs: CalcResult["inputs"], o: CalcOpts = {}): CalcResult {
  return { id, value, unit, formula, inputs, assumptions: o.notes ?? [], subUnits: o.sub, assumptionIds: o.ids ?? [] };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---------- Emergency fund ----------
/**
 * The month figures behind irregular income. Entered or pasted figures win; with only "irregular income" ticked the
 * stated defaults are used (and labelled as defaults); a steady income has no spread.
 */
export function resolveIncome(p: UserProfile): { typical: number; good: number; bad: number; source: "history" | "entered" | "default" | "steady" } {
  const typical = p.monthlyIncome;
  const h = p.incomeMonths?.history?.filter((x) => Number.isFinite(x) && x >= 0) ?? [];
  if (h.length) return { typical, good: Math.max(...h), bad: Math.min(...h), source: "history" };
  if (p.incomeMonths) return { typical, good: p.incomeMonths.good, bad: p.incomeMonths.bad, source: "entered" };
  if (!p.incomeStable) return { typical, good: (typical * (100 + av("income.good_uplift_pct"))) / 100, bad: (typical * (100 - av("income.bad_drop_pct"))) / 100, source: "default" };
  return { typical, good: typical, bad: typical, source: "steady" };
}

/** Income stress: what a bad month costs, the smallest reserve that bridges a run of them, and how long savings last. */
export function incomeStress(p: UserProfile): CalcResult {
  const r = resolveIncome(p);
  const emi = sum(p.debts.map((d) => d.emi));
  // essentials and EMIs must be paid; other spending is the part that can be cut in a bad month
  const drain = Math.max(0, p.essentialExpenses + emi - r.bad);
  const runMonths = av("income.bad_run_months");
  return calc(
    "inc",
    {
      typical: r.typical,
      good: r.good,
      bad: r.bad,
      spreadPct: r.typical > 0 ? ((r.good - r.bad) / r.typical) * 100 : 0,
      badDrain: drain,
      runMonths,
      minReserve: drain * runMonths,
      survivableMonths: drain > 0 ? p.liquidSavings / drain : 0,
      entered: r.source === "entered" || r.source === "history" ? 1 : 0,
    },
    "inr",
    "badDrain = max(0, essential spending + EMIs - bad-month income); minimum reserve = badDrain x months of bad run; survivable months = savings / badDrain",
    { typicalIncome: r.typical, goodIncome: r.good, badIncome: r.bad, essential: p.essentialExpenses, totalEmi: emi, source: r.source },
    {
      sub: { spreadPct: "percent", runMonths: "months", survivableMonths: "months", entered: "count" },
      ids: ["income.good_uplift_pct", "income.bad_drop_pct", "income.bad_run_months"],
      notes: [
        NOTE_DEMO,
        r.source === "default" ? "Good and bad month figures were NOT entered: these are stated defaults, not your numbers." : r.source === "steady" ? "Income is treated as steady: no good or bad month figures were entered." : "Built from the good, typical and bad month figures you entered.",
        "In a bad month only essential spending and EMIs are counted as must-pay; other spending is assumed to be cut.",
      ],
    },
  );
}

export function emergencyFundTarget(p: UserProfile): CalcResult {
  // With good/bad month figures the target comes from the bad month (but never below the steady-income months);
  // otherwise it is the plain steady or irregular months.
  if (p.incomeMonths && p.essentialExpenses > 0) {
    const minReserve = (incomeStress(p).value as Record<string, number>).minReserve;
    const months = Math.max(av("ef.months.stable"), minReserve / p.essentialExpenses);
    return calc(
      "ef.target",
      months,
      "months",
      "the larger of the steady-income months and (bad-month drain x bad-run months) / essential spending",
      { source: "your good and bad month figures", essentialMonthlyExpenses: p.essentialExpenses },
      { notes: [NOTE_DEMO, "Worked out from the bad month you entered, not a fixed number of months."], ids: ["ef.months.stable", "income.bad_run_months"] },
    );
  }
  const id = p.incomeStable ? "ef.months.stable" : "ef.months.irregular";
  return calc("ef.target", av(id), "months", "stable income uses the steady-income months; irregular income uses the irregular-income months (a default: no good or bad month figures were entered)", { incomeStable: p.incomeStable }, { notes: [NOTE_DEMO], ids: [id] });
}

export function emergencyFundMonths(p: UserProfile): CalcResult {
  const months = p.essentialExpenses > 0 ? p.liquidSavings / p.essentialExpenses : 0;
  return calc(
    "ef.months",
    months,
    "months",
    "liquidSavings / essentialMonthlyExpenses",
    { liquidSavings: p.liquidSavings, essentialMonthlyExpenses: p.essentialExpenses },
    { ids: ["ef.months.critical"] },
  );
}

export function emergencyFundGap(p: UserProfile): CalcResult {
  const t = emergencyFundTarget(p);
  const target = t.value as number;
  const gap = Math.max(0, target * p.essentialExpenses - p.liquidSavings);
  return calc(
    "ef.gap",
    gap,
    "inr",
    "max(0, targetMonths x essentialMonthlyExpenses - liquidSavings)",
    { targetMonths: target, essentialMonthlyExpenses: p.essentialExpenses, liquidSavings: p.liquidSavings },
    { ids: t.assumptionIds },
  );
}

// ---------- Insurance ----------
export function termInsurance(p: UserProfile): CalcResult {
  const none = av("insurance.term.multiple_none");
  const multiple = p.dependents === 0 ? none : Math.min(av("insurance.term.multiple_cap"), av("insurance.term.multiple_base") + (p.dependents - 1) * av("insurance.term.multiple_per_dependent"));
  const personal = sum(p.insurance.filter((i) => i.kind === "term").map((i) => i.cover));
  const employer = p.employerTermCover ?? 0;
  const cover = personal + employer;
  // view 1: a multiple of yearly income
  const byIncome = p.monthlyIncome * 12 * multiple;
  // view 2: what is owed plus some years of the household's essential spending, only when somebody depends on the income
  const debts = p.dependents > 0 ? sum(p.debts.map((d) => d.outstanding)) : 0;
  const support = p.dependents > 0 ? av("insurance.term.support_years") * 12 * p.essentialExpenses : 0;
  const byNeeds = debts + support;
  const needed = Math.max(byIncome, byNeeds);
  return calc(
    "ins.term",
    { cover, needed, gap: Math.max(0, needed - cover), byIncome, byNeeds, debts, support, personal, employer },
    "inr",
    "needed = the larger of (a) yearly income x multiple (a base multiple, a step per extra dependent, up to a cap) and (b) outstanding loans + years of support x yearly essential spending; cover = your own term cover + employer cover; gap = max(0, needed - cover)",
    { annualIncome: p.monthlyIncome * 12, multiple, dependents: p.dependents, outstandingLoans: debts, employerCoverKnown: p.employerTermCover !== undefined },
    {
      notes: [
        NOTE_DEMO,
        "A starting point for discussion, not a recommendation.",
        p.employerTermCover === undefined ? "Employer-provided cover was not entered, so it is UNKNOWN here and counted as zero. The gap may be overstated if your employer covers you." : "Includes the employer cover you entered.",
        "Policy terms, exclusions and claim conditions are not modelled.",
      ],
      ids: ["insurance.term.multiple_none", "insurance.term.multiple_base", "insurance.term.multiple_per_dependent", "insurance.term.multiple_cap", "insurance.term.support_years", "insurance.severe_ratio"],
    },
  );
}

export function healthInsurance(p: UserProfile): CalcResult {
  const t = p.cityTier;
  const needed = av(`insurance.health.base.tier${t}`) + av(`insurance.health.per_member.tier${t}`) * Math.max(0, p.familySize - 1);
  const cover = sum(p.insurance.filter((i) => i.kind === "health").map((i) => i.cover));
  return calc(
    "ins.health",
    { cover, needed, gap: Math.max(0, needed - cover) },
    "inr",
    "needed = baseByCityTier + perMember x (familySize - 1); gap = max(0, needed - cover)",
    { cityTier: t, familySize: p.familySize },
    { notes: [NOTE_DEMO], ids: [`insurance.health.base.tier${t}`, `insurance.health.per_member.tier${t}`, "insurance.severe_ratio"] },
  );
}

// ---------- Debt ----------
export function debtToIncome(p: UserProfile): CalcResult {
  const emi = sum(p.debts.map((d) => d.emi));
  const dti = p.monthlyIncome > 0 ? (emi / p.monthlyIncome) * 100 : 0;
  return calc("debt.dti", dti, "percent", "sum(monthly EMIs) / monthlyIncome x 100", { totalEmi: emi, monthlyIncome: p.monthlyIncome }, { ids: ["debt.dti_high"] });
}

/** The share of income above which loan payments count as a heavy load (so plan text can cite it). */
export function loanLoadMark(): CalcResult {
  return calc("debt.dtiMark", av("debt.dti_high"), "percent", "loan payments above this share of income are flagged as a heavy load", {}, { notes: [NOTE_DEMO], ids: ["debt.dti_high"] });
}

export function highCostDebt(p: UserProfile): CalcResult {
  const threshold = av("debt.highcost_threshold");
  const high = p.debts.filter((d) => d.ratePct > threshold);
  const rate = high.length ? Math.max(...high.map((d) => d.ratePct)) : 0;
  return calc(
    "debt.highCost",
    { count: high.length, rate, threshold },
    "count",
    "debts with a yearly interest rate above the threshold",
    { debts: p.debts.length },
    { notes: [NOTE_DEMO], sub: { count: "count", rate: "percent", threshold: "percent" }, ids: ["debt.highcost_threshold"] },
  );
}

// ---------- Cash flow: what is actually left each month ----------
/** Income less essentials, other spending AND loan payments (EMIs). Negative means the month does not add up. */
export function cashFlow(p: UserProfile): CalcResult {
  const emi = sum(p.debts.map((d) => d.emi));
  const surplus = p.monthlyIncome - p.essentialExpenses - p.otherExpenses - emi;
  return calc(
    "cash",
    {
      income: p.monthlyIncome,
      essential: p.essentialExpenses,
      other: p.otherExpenses,
      emi,
      surplus,
      shortfall: Math.max(0, -surplus),
      surplusPct: p.monthlyIncome > 0 ? (surplus / p.monthlyIncome) * 100 : 0,
    },
    "inr",
    "surplus = monthly income - essential spending - other spending - loan payments (EMIs); shortfall = max(0, -surplus); surplusPct = surplus / income x 100",
    { monthlyIncome: p.monthlyIncome, essential: p.essentialExpenses, other: p.otherExpenses, totalEmi: emi },
    { sub: { surplusPct: "percent" }, ids: ["cashflow.near_zero_pct"], notes: [NOTE_DEMO, "Loan payments (EMIs) are counted. A negative surplus means spending and loan payments are more than income."] },
  );
}

/** The ladder's own numbers, so they are part of the numeric ground truth like everything else. */
export function ladderFacts(l: Ladder): CalcResult {
  const first = l.firstBlocker ? l.steps.findIndex((s) => s.id === l.firstBlocker) + 1 : 0;
  return calc(
    "ladder",
    { blockedCount: l.steps.filter((s) => s.status === "blocked").length, firstBlockerStep: first, goalsLater: l.goalsLater ? 1 : 0 },
    "count",
    "steps are checked in order (cash flow, reserve, loans, cover); goal investing is reached only when none of them is blocked",
    { steps: l.steps.length },
    { ids: [...new Set(l.steps.flatMap((x) => x.assumptionIds))], notes: [NOTE_DEMO, "A planning order for discussion with a reviewer. It is not an instruction to buy, sell or repay a product."] },
  );
}

// ---------- Savings ----------
export function savingsRate(p: UserProfile): CalcResult {
  const emi = sum(p.debts.map((d) => d.emi));
  const monthly = Math.max(0, p.monthlyIncome - p.essentialExpenses - p.otherExpenses - emi);
  const rate = p.monthlyIncome > 0 ? (monthly / p.monthlyIncome) * 100 : 0;
  return calc(
    "save",
    { rate, monthly },
    "percent",
    "max(0, income - essential - other expenses - loan payments) / income x 100",
    { monthlyIncome: p.monthlyIncome, essential: p.essentialExpenses, other: p.otherExpenses, totalEmi: emi },
    { sub: { rate: "percent", monthly: "inr" }, ids: ["savings.rate_low"] },
  );
}

// ---------- Goals: inflation, existing savings, fees. Taxes are NOT modelled. ----------
export type Scenario = "low" | "base" | "high";
export const GOAL_ASSUMPTION_IDS = ["return.low", "return.base", "return.high", "inflation.low", "inflation.base", "inflation.high", "fee.expense_ratio", "tax.not_modelled"];

/**
 * low = pessimistic (low return, high inflation), base, high = optimistic (high return, low inflation).
 * The return is taken NET of the assumed fee.
 */
export function scenarioParams(s: Scenario): { grossReturnPct: number; netReturnPct: number; inflationPct: number } {
  const gross = av(`return.${s}`);
  const inflation = av(s === "low" ? "inflation.high" : s === "high" ? "inflation.low" : "inflation.base");
  return { grossReturnPct: gross, netReturnPct: gross - av("fee.expense_ratio"), inflationPct: inflation };
}

/** The amount needed at the goal date, after prices rise for `years`. */
export const inflate = (todayAmount: number, years: number, inflationPct: number) => todayAmount * Math.pow(1 + inflationPct / 100, years);

/** Months in a goal, at least one. */
export const monthsIn = (years: number) => Math.max(1, Math.round(years * 12));

/** Value of a lump sum after `years` at a net yearly return (monthly compounding). */
export function growLump(amount: number, years: number, netPct: number): number {
  return amount * Math.pow(1 + netPct / 100 / 12, monthsIn(years));
}

/**
 * Monthly amount that, with `existing` already set aside, reaches `futureTarget` (end-of-month deposits).
 * `delayYears` starts the deposits later; the existing savings still grow for the whole period.
 */
export function sipFor(futureTarget: number, years: number, netPct: number, existing = 0, delayYears = 0): number {
  const n = monthsIn(years);
  const m = Math.max(1, n - Math.round(delayYears * 12));
  const r = netPct / 100 / 12;
  const need = Math.max(0, futureTarget - growLump(existing, years, netPct));
  return r === 0 ? need / m : (need * r) / (Math.pow(1 + r, m) - 1);
}

export function goalFeasibility(g: { id: string; targetAmount: number; years: number; savedSoFar?: number }): CalcResult {
  const saved = g.savedSoFar ?? 0;
  const at = (s: Scenario) => {
    const p = scenarioParams(s);
    return sipFor(inflate(g.targetAmount, g.years, p.inflationPct), g.years, p.netReturnPct, saved);
  };
  return calc(
    `goal.${g.id}.sip`,
    { low: at("low"), base: at("base"), high: at("high") },
    "inr",
    "SIP = max(0, futureTarget - savedSoFar x (1 + r)^n) x r / ((1 + r)^n - 1); futureTarget = today's amount x (1 + inflation)^years; r = (return - fee) / 12; n = years x 12",
    { target: g.targetAmount, years: g.years, savedSoFar: saved },
    {
      notes: [
        NOTE_DEMO,
        "Shown as a range from a pessimistic to an optimistic scenario, never a promise.",
        "The amount you entered is in today's money and is raised for inflation to the goal date.",
        "Savings already set aside for this goal are counted, with growth.",
        "Returns are taken after an assumed yearly fee.",
        "Taxes are not included.",
      ],
      ids: GOAL_ASSUMPTION_IDS,
    },
  );
}

/** The goal in today's money and at the goal date (inflation-adjusted), plus what existing savings grow to. */
export function goalFuture(g: { id: string; targetAmount: number; years: number; savedSoFar?: number }): CalcResult {
  const base = scenarioParams("base");
  return calc(
    `goal.${g.id}.future`,
    {
      today: g.targetAmount,
      base: inflate(g.targetAmount, g.years, base.inflationPct),
      atLowInflation: inflate(g.targetAmount, g.years, av("inflation.low")),
      atHighInflation: inflate(g.targetAmount, g.years, av("inflation.high")),
      savedGrown: growLump(g.savedSoFar ?? 0, g.years, base.netReturnPct),
    },
    "inr",
    "amount at the goal date = today's amount x (1 + inflation)^years",
    { target: g.targetAmount, years: g.years, savedSoFar: g.savedSoFar ?? 0 },
    { notes: [NOTE_DEMO, "Taxes are not included."], ids: GOAL_ASSUMPTION_IDS },
  );
}

// ---------- Loan versus investing: a conversation starter, never an instruction ----------
export function loanVsInvest(p: UserProfile): CalcResult | null {
  if (!p.debts.length) return null;
  const rate = Math.max(...p.debts.map((d) => d.ratePct));
  return calc(
    "tradeoff",
    { loanRate: rate, returnLow: scenarioParams("low").netReturnPct, returnBase: scenarioParams("base").netReturnPct, returnHigh: scenarioParams("high").netReturnPct },
    "percent",
    "highest loan rate compared with the assumed long-term return range, after the assumed fee and before tax",
    { debts: p.debts.length },
    {
      notes: [NOTE_DEMO, "The loan cost is certain; the returns are assumed scenarios and are not promised.", "Worth discussing with your reviewer. This is not an instruction to repay or to invest."],
      ids: ["return.low", "return.base", "return.high", "fee.expense_ratio", "tax.not_modelled"],
    },
  );
}

// ---------- Portfolio ----------
export function concentration(holdings: Holding[]): CalcResult {
  const total = sum(holdings.map((h) => h.amount));
  const sector: Record<string, number> = {};
  for (const h of holdings) {
    const f = SAMPLE_FUNDS[h.label];
    if (f) for (const [s, pct] of Object.entries(f.sectors)) sector[s] = (sector[s] ?? 0) + (h.amount * pct) / 100;
    else sector[UNKNOWN_SECTOR] = (sector[UNKNOWN_SECTOR] ?? 0) + h.amount;
  }
  const equitySectors = Object.entries(sector).filter(([s]) => !["Debt", "Gold", UNKNOWN_SECTOR].includes(s));
  const [topSectorName, topSectorAmt] = equitySectors.sort((a, b) => b[1] - a[1])[0] ?? ["-", 0];
  const topHolding = [...holdings].sort((a, b) => b.amount - a.amount)[0];
  let overlap = 0;
  for (let i = 0; i < holdings.length; i++) {
    for (let j = i + 1; j < holdings.length; j++) {
      const x = SAMPLE_FUNDS[holdings[i].label]?.top ?? {};
      const y = SAMPLE_FUNDS[holdings[j].label]?.top ?? {};
      const o = sum(Object.keys(x).filter((k) => k in y && holdings[i].label !== holdings[j].label).map((k) => Math.min(x[k], y[k])));
      overlap = Math.max(overlap, o);
    }
  }
  return calc(
    "conc",
    { topSector: total ? (topSectorAmt / total) * 100 : 0, topHolding: total && topHolding ? (topHolding.amount / total) * 100 : 0, overlap },
    "percent",
    "sector share = look-through sector amount / portfolio; overlap = sum of shared top-holding weights between the most similar pair",
    { portfolioTotal: total, topSectorName, topHoldingLabel: topHolding?.label ?? "-", holdings: holdings.length },
    { notes: ["Uses a small fictional sample lookup, not live fund data."], ids: ["concentration.sector_pct", "concentration.holding_pct", "concentration.overlap_pct"] },
  );
}

// ---------- Education: commission drag ----------
export function commissionDrag(o: { corpus: number; years: number; returnPct: number; regularExpensePct: number; directExpensePct: number }): CalcResult {
  const fv = (exp: number) => o.corpus * Math.pow(1 + (o.returnPct - exp) / 100, o.years);
  const regular = fv(o.regularExpensePct);
  const direct = fv(o.directExpensePct);
  return calc(
    "drag",
    { regular, direct, diff: direct - regular },
    "inr",
    "corpus x (1 + (assumedReturn - expenseRatio))^years, for regular vs direct",
    { ...o },
    { notes: [NOTE_DEMO, "Assumed return is illustrative and not a promise."], ids: ["drag.corpus", "drag.years", "drag.return", "drag.expense_regular", "drag.expense_direct"] },
  );
}

export function dragDefaults(): CalcResult {
  return commissionDrag({
    corpus: av("drag.corpus"),
    years: av("drag.years"),
    returnPct: av("drag.return"),
    regularExpensePct: av("drag.expense_regular"),
    directExpensePct: av("drag.expense_direct"),
  });
}

// ---------- Second Opinion helper ----------
export function impliedAnnual(monthlyPct: number): CalcResult {
  const annual = (Math.pow(1 + monthlyPct / 100, 12) - 1) * 100;
  return calc("implied", { monthly: monthlyPct, annual }, "percent", "(1 + monthly)^12 - 1", { monthlyPct }, { sub: { monthly: "percent", annual: "percent" } });
}

// ---------- Behaviour: market fall ----------
export function marketFall(holdings: { amount: number }[], dropPct: number = av("fall.drop_pct")): CalcResult {
  const before = sum(holdings.map((h) => h.amount));
  const loss = (before * dropPct) / 100;
  return calc("fall", { before, after: before - loss, loss, drop: dropPct }, "inr", "after = before x (1 - drop%)", { before, dropPct }, {
    notes: ["A fixed scenario for practice, not a prediction."],
    sub: { drop: "percent" },
    ids: ["fall.drop_pct"],
  });
}

export function goldRange(): CalcResult {
  return calc("alloc.gold", { low: av("alloc.gold.low"), high: av("alloc.gold.high") }, "percent", "Range for discussion only", {}, { notes: [NOTE_DEMO], ids: ["alloc.gold.low", "alloc.gold.high"] });
}

// ---------- Summary score (never the headline; shown behind "About this summary") ----------
export function healthScore(parts: {
  months: number;
  target: number;
  termRatio: number;
  healthRatio: number;
  dti: number;
  highCostCount: number;
  savingsRate: number;
  topSector: number;
  hasHoldings: boolean;
}): CalcResult {
  const lowDti = av("score.dti_full_below");
  const highDti = av("score.dti_zero_above");
  const ef = av("score.w_emergency") * clamp(parts.target ? parts.months / parts.target : 0, 0, 1);
  const ins = av("score.w_insurance") * ((clamp(parts.termRatio, 0, 1) + clamp(parts.healthRatio, 0, 1)) / 2);
  const debtBase = parts.dti <= lowDti ? 1 : parts.dti >= highDti ? 0 : (highDti - parts.dti) / (highDti - lowDti);
  const debt = av("score.w_debt") * debtBase * (parts.highCostCount > 0 ? av("score.highcost_factor") : 1);
  const sav = av("score.w_savings") * clamp(parts.savingsRate / av("savings.rate_target"), 0, 1);
  const conc = parts.hasHoldings ? av("score.w_diversification") * clamp(1 - Math.max(0, parts.topSector - av("score.conc_floor")) / av("score.conc_span"), 0, 1) : av("score.w_diversification");
  return calc(
    "health.score",
    Math.round(ef + ins + debt + sav + conc),
    "score",
    "weighted sum of the emergency reserve, insurance, loans, savings and diversification marks",
    { ef: Math.round(ef), insurance: Math.round(ins), debt: Math.round(debt), savings: Math.round(sav), diversification: Math.round(conc) },
    {
      notes: [NOTE_DEMO, "A simple summary of the figures behind it. It hides detail and is not a rating of you."],
      ids: [
        "score.w_emergency", "score.w_insurance", "score.w_debt", "score.w_savings", "score.w_diversification", "score.dti_full_below",
        "score.dti_zero_above", "score.highcost_factor", "score.conc_floor", "score.conc_span", "savings.rate_target",
      ],
    },
  );
}

// ---------- Collect ----------
export function flattenResults(results: CalcResult[]): Pick<EngineResult, "flat" | "units"> {
  const flat: Record<string, number> = {};
  const units: Record<string, Unit> = {};
  for (const r of results) {
    if (typeof r.value === "number") {
      flat[r.id] = r.value;
      units[r.id] = r.unit;
    } else {
      for (const [k, v] of Object.entries(r.value)) {
        flat[`${r.id}.${k}`] = v;
        units[`${r.id}.${k}`] = r.subUnits?.[k] ?? r.unit;
      }
    }
  }
  return { flat, units };
}

function flatten(results: CalcResult[], profile: UserProfile): Pick<EngineResult, "flat" | "units"> {
  const { flat, units } = flattenResults(results);
  const put = (k: string, v: number, u: Unit) => {
    flat[`profile.${k}`] = v;
    units[`profile.${k}`] = u;
  };
  put("age", profile.age, "count");
  put("monthlyIncome", profile.monthlyIncome, "inr");
  put("essentialExpenses", profile.essentialExpenses, "inr");
  put("otherExpenses", profile.otherExpenses, "inr");
  put("liquidSavings", profile.liquidSavings, "inr");
  put("dependents", profile.dependents, "count");
  for (const g of profile.goals) {
    put(`goal.${g.id}.targetAmount`, g.targetAmount, "inr");
    put(`goal.${g.id}.years`, g.years, "years");
    put(`goal.${g.id}.saved`, g.savedSoFar ?? 0, "inr");
  }
  for (const d of profile.debts) {
    put(`debt.${d.id}.outstanding`, d.outstanding, "inr");
    put(`debt.${d.id}.ratePct`, d.ratePct, "percent");
    put(`debt.${d.id}.emi`, d.emi, "inr");
  }
  return { flat, units };
}

export function runEngine(p: UserProfile): EngineResult {
  const trade = loanVsInvest(p);
  const results: CalcResult[] = [
    cashFlow(p),
    incomeStress(p),
    emergencyFundMonths(p),
    emergencyFundTarget(p),
    emergencyFundGap(p),
    termInsurance(p),
    healthInsurance(p),
    debtToIncome(p),
    loanLoadMark(),
    highCostDebt(p),
    savingsRate(p),
    ...p.goals.flatMap((g) => [goalFeasibility(g), goalFuture(g)]),
    ...(trade ? [trade] : []),
    concentration(p.holdings),
    dragDefaults(),
    goldRange(),
  ];
  const by = (id: string) => results.find((r) => r.id === id)!;
  const num = (id: string, k?: string) => {
    const v = by(id).value;
    return typeof v === "number" ? v : v[k!];
  };
  const term = by("ins.term").value as Record<string, number>;
  const health = by("ins.health").value as Record<string, number>;
  const conc = by("conc").value as Record<string, number>;
  results.push(
    healthScore({
      months: num("ef.months"),
      target: num("ef.target"),
      termRatio: term.needed > 0 ? term.cover / term.needed : 1,
      healthRatio: health.needed > 0 ? health.cover / health.needed : 1,
      dti: num("debt.dti"),
      highCostCount: num("debt.highCost", "count"),
      savingsRate: num("save", "rate"),
      topSector: conc.topSector,
      hasHoldings: p.holdings.length > 0,
    }),
  );
  // the ladder reads the numbers above, and its own facts join the numeric ground truth
  const ladder = buildLadder(p, flatten(results, p).flat);
  results.push(ladderFacts(ladder));
  const { flat, units } = flatten(results, p);
  return { results, flat, units, flags: computeFlags(p, flat), ladder };
}

export function computeFlags(p: UserProfile, flat: Record<string, number>): EngineFlag[] {
  const flags: EngineFlag[] = [];
  const cashBad = p.monthlyIncome > 0 && (flat["cash.surplus"] < 0 || flat["cash.surplusPct"] < av("cashflow.near_zero_pct"));
  if (p.monthlyIncome > 0) {
    if (flat["cash.surplus"] < 0) flags.push({ id: "cash_shortfall", severity: "high", metric: "cash" });
    else if (cashBad) flags.push({ id: "cash_tight", severity: "high", metric: "cash" });
  }
  const months = flat["ef.months"];
  const target = flat["ef.target"];
  // a bad month that drains savings faster than the reserve can bridge, when income really does swing
  const swings = !p.incomeStable || p.incomeMonths !== undefined;
  if (swings && flat["inc.badDrain"] > 0 && p.liquidSavings < flat["inc.minReserve"]) flags.push({ id: "bad_month_stress", severity: "medium", metric: "inc" });
  if (months < av("ef.months.critical")) flags.push({ id: "ef_low", severity: "high", metric: "ef.months" });
  else if (months < target) flags.push({ id: "ef_low", severity: "medium", metric: "ef.months" });
  const severe = av("insurance.severe_ratio");
  if (flat["ins.term.gap"] > 0) {
    flags.push({ id: "term_gap", severity: flat["ins.term.cover"] < flat["ins.term.needed"] * severe ? "high" : "medium", metric: "ins.term" });
  }
  if (flat["ins.health.gap"] > 0) {
    flags.push({ id: "health_gap", severity: flat["ins.health.cover"] < flat["ins.health.needed"] * severe ? "high" : "medium", metric: "ins.health" });
  }
  if (flat["debt.highCost.count"] > 0) flags.push({ id: "high_cost_debt", severity: "high", metric: "debt.highCost" });
  if (flat["debt.dti"] > av("debt.dti_high")) flags.push({ id: "dti_high", severity: "high", metric: "debt.dti" });
  // a month that does not add up is already reported as a cash-flow flag; do not say the same thing twice
  if (p.monthlyIncome > 0 && !cashBad && flat["save.rate"] < av("savings.rate_low")) flags.push({ id: "savings_low", severity: "medium", metric: "save" });
  if (p.holdings.length) {
    if (flat["conc.topSector"] > av("concentration.sector_pct") || flat["conc.topHolding"] > av("concentration.holding_pct")) {
      flags.push({ id: "concentration", severity: "medium", metric: "conc" });
    }
    if (flat["conc.overlap"] > av("concentration.overlap_pct")) flags.push({ id: "overlap_high", severity: "medium", metric: "conc" });
  }
  if (p.risk.followsTips) flags.push({ id: "tip_following", severity: "medium" });
  if (!p.incomeStable) flags.push({ id: "irregular_income", severity: "low" });
  return flags;
}

/** Higher = more urgent in the adviser queue. */
export function priorityScore(flags: EngineFlag[], urgent: boolean): number {
  return sum(flags.map((f) => PRIORITY_WEIGHT[f.severity])) + (urgent ? PRIORITY_WEIGHT.urgent : 0);
}

// ---------- Nudges (deterministic rules) ----------
export function nudgeRules(p: UserProfile, e: EngineResult): { ruleId: NudgeRuleId; goalId?: string }[] {
  const out: { ruleId: NudgeRuleId; goalId?: string }[] = [];
  if (e.flags.some((f) => f.id === "cash_shortfall" || f.id === "cash_tight")) out.push({ ruleId: "cash_flow" });
  if (e.flat["ef.months"] < e.flat["ef.target"]) out.push({ ruleId: "ef_low" });
  if (e.flat["ins.health.gap"] > 0 || e.flat["ins.term.gap"] > 0) out.push({ ruleId: "insurance_gap" });
  // a goal amount is never the nudge while something earlier on the ladder is blocked
  if (p.goals[0] && !e.ladder.goalsLater) out.push({ ruleId: "sip_review", goalId: p.goals[0].id });
  if (e.flags.some((f) => f.id === "concentration" || f.id === "overlap_high")) out.push({ ruleId: "rebalance" });
  return out;
}

/** Find the calculation behind a flat key (for the evidence drawer). */
export function findResult(e: EngineResult, key: string): CalcResult | undefined {
  return e.results.find((r) => r.id === key || key.startsWith(r.id + "."));
}

/** Every assumption id the given metric keys depend on. */
export function assumptionIdsFor(e: EngineResult, keys: string[]): string[] {
  const ids = new Set<string>();
  for (const k of keys) for (const id of findResult(e, k)?.assumptionIds ?? []) ids.add(id);
  return [...ids];
}
