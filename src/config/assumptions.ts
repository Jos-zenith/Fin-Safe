// THE single source of every financial constant. The engine reads only from here (a test enforces it).
// Every value is a DEMO PLACEHOLDER unless an adviser has reviewed it. Nothing is pre-marked reviewed and
// no source is invented: where there is no real source it says "demo placeholder, TO_VERIFY".
import type { Unit } from "@/types";

export type Confidence = "low" | "medium" | "high";
export type ReviewStatus = "unverified" | "reviewed";

export interface Assumption {
  id: string;
  value: number;
  unit: Unit | "none";
  description: string;
  source: string;
  asOf: string;
  applicability: string;
  confidence: Confidence;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedOn?: string;
  /** Listed so users can see what is NOT modelled. It has no numeric effect. */
  notModelled?: boolean;
}

const SRC = "demo placeholder, TO_VERIFY";
const a = (id: string, value: number, unit: Assumption["unit"], description: string, applicability: string, extra: Partial<Assumption> = {}): Assumption => ({
  id,
  value,
  unit,
  description,
  source: SRC,
  asOf: "TO_VERIFY",
  applicability,
  confidence: "low",
  reviewStatus: "unverified",
  ...extra,
});

export const ASSUMPTIONS: readonly Assumption[] = [
  // --- emergency reserve
  a("ef.months.stable", 6, "months", "Months of essential expenses to hold as an emergency reserve when income is steady.", "Salaried, steady income"),
  a("ef.months.irregular", 9, "months", "Months of essential expenses to hold when income is irregular.", "Business, gig or seasonal income"),
  a("ef.months.critical", 3, "months", "Below this many months the emergency reserve is flagged as a high-severity gap.", "All households"),
  // --- the priority ladder: what has to be on track before money goes to goal investing
  a("cashflow.near_zero_pct", 5, "percent", "A monthly surplus (income less spending and loan payments) below this share of income counts as near zero, which blocks goal investing.", "All households"),
  a("ladder.liquidity_severe_months", 1, "months", "Below this many months of essential costs saved, the emergency reserve is a blocking step before goal investing.", "All households"),
  // --- irregular income: good, typical and bad months
  a("income.good_uplift_pct", 30, "percent", "When only 'irregular income' is known, a good month is assumed this share above a typical month (a default, replaced by figures the person enters).", "Business, gig or seasonal income"),
  a("income.bad_drop_pct", 40, "percent", "When only 'irregular income' is known, a bad month is assumed this share below a typical month (a default, replaced by figures the person enters).", "Business, gig or seasonal income"),
  a("income.bad_run_months", 6, "months", "How many bad months in a row the reserve should be able to bridge when good, typical and bad month figures are entered.", "Business, gig or seasonal income"),
  // --- goal scenarios (pessimistic / base / optimistic)
  a("return.low", 6, "percent", "Pessimistic scenario: assumed yearly return before fees and tax.", "Long-term, diversified, growth-oriented mix (illustrative)"),
  a("return.base", 9, "percent", "Base scenario: assumed yearly return before fees and tax.", "Long-term, diversified, growth-oriented mix (illustrative)"),
  a("return.high", 12, "percent", "Optimistic scenario: assumed yearly return before fees and tax.", "Long-term, diversified, growth-oriented mix (illustrative)"),
  a("inflation.low", 4, "percent", "Optimistic scenario: assumed yearly rise in prices.", "General household costs"),
  a("inflation.base", 6, "percent", "Base scenario: assumed yearly rise in prices.", "General household costs"),
  a("inflation.high", 8, "percent", "Pessimistic scenario: assumed yearly rise in prices.", "General household costs"),
  a("fee.expense_ratio", 1, "percent", "Assumed yearly cost of holding the investments, taken off the return.", "Regular-plan style costs (illustrative)"),
  a("tax.not_modelled", 0, "none", "Income tax, capital-gains tax and tax benefits are NOT modelled. Every goal result is before tax.", "All goal results", { notModelled: true }),
  a("health.hospital_costs.not_modelled", 0, "none", "Hospital and treatment costs are NOT modelled. The health cover starting point is a placeholder by city size and family size, not an estimate of any bill.", "Health cover results", { notModelled: true }),
  a("health.room_rent.not_modelled", 0, "none", "Room-rent limits, sub-limits and proportionate deductions in a health policy are NOT modelled.", "Health cover results", { notModelled: true }),
  a("health.exclusions.not_modelled", 0, "none", "Policy exclusions, waiting periods, co-payments and claim conditions are NOT modelled. A cover amount says nothing about what a policy will actually pay.", "Health and term cover results", { notModelled: true }),
  // --- debt and savings
  a("debt.highcost_threshold", 12, "percent", "Loans costing more than this yearly rate are flagged as costly.", "Personal, card and small-business loans"),
  a("debt.dti_high", 40, "percent", "Loan payments above this share of income are flagged as a heavy load.", "All households"),
  a("savings.rate_low", 10, "percent", "Savings below this share of income are flagged as low.", "All households"),
  a("savings.rate_target", 20, "percent", "Savings rate used as the 'full marks' reference in the summary.", "All households"),
  // --- insurance
  a("insurance.term.multiple_none", 0, "ratio", "Term cover as a multiple of yearly income when nobody depends on the income.", "No dependents"),
  a("insurance.term.multiple_base", 10, "ratio", "Term cover as a multiple of yearly income when somebody depends on the income.", "One or more dependents"),
  a("insurance.term.multiple_per_dependent", 1, "ratio", "Extra multiple of yearly income for each dependent beyond the first.", "Two or more dependents"),
  a("insurance.term.multiple_cap", 15, "ratio", "Upper limit of the term-cover multiple.", "All households"),
  a("insurance.term.support_years", 5, "years", "Years of the household's essential spending counted as support for dependents in the needs-based view of term cover (added to outstanding loans).", "One or more dependents"),
  a("insurance.severe_ratio", 0.5, "ratio", "Cover below this share of the starting point is flagged as a high-severity gap.", "Term and health cover"),
  a("insurance.health.base.tier1", 1000000, "inr", "Health cover starting point for one person in a big city.", "City tier 1"),
  a("insurance.health.base.tier2", 700000, "inr", "Health cover starting point for one person in a large town.", "City tier 2"),
  a("insurance.health.base.tier3", 500000, "inr", "Health cover starting point for one person in a smaller town.", "City tier 3"),
  a("insurance.health.per_member.tier1", 300000, "inr", "Added health cover for each further family member in a big city.", "City tier 1"),
  a("insurance.health.per_member.tier2", 200000, "inr", "Added health cover for each further family member in a large town.", "City tier 2"),
  a("insurance.health.per_member.tier3", 150000, "inr", "Added health cover for each further family member in a smaller town.", "City tier 3"),
  // --- input plausibility (a data-quality heuristic, not a financial rule)
  a("quality.round_min_inr", 10000, "inr", "An amount at or above this that is a 1 or a 5 followed only by zeros (for example 1,00,000 or 50,000) looks like a placeholder.", "Plausibility check only"),
  a("quality.round_count", 2, "count", "This many round-looking amounts among income, essential spending and savings suggests placeholders were typed in.", "Plausibility check only"),
  // --- portfolio
  a("concentration.sector_pct", 40, "percent", "A single sector above this share of the portfolio is flagged.", "Equity-oriented portfolios"),
  a("concentration.holding_pct", 25, "percent", "A single holding above this share of the portfolio is flagged.", "All portfolios"),
  a("concentration.overlap_pct", 50, "percent", "Fund overlap above this share is flagged.", "Fund portfolios"),
  a("alloc.gold.low", 5, "percent", "Lower end of the gold share often discussed for diversification.", "Portfolios with no gold"),
  a("alloc.gold.high", 10, "percent", "Upper end of the gold share often discussed for diversification.", "Portfolios with no gold"),
  // --- education example and practice scenario
  a("drag.corpus", 1000000, "inr", "Example amount for the regular-vs-direct illustration.", "Education example only"),
  a("drag.years", 20, "years", "Example duration for the regular-vs-direct illustration.", "Education example only"),
  a("drag.return", 11, "percent", "Example yearly return for the regular-vs-direct illustration.", "Education example only"),
  a("drag.expense_regular", 1.6, "percent", "Example yearly cost of a regular plan.", "Education example only"),
  a("drag.expense_direct", 0.6, "percent", "Example yearly cost of a direct plan.", "Education example only"),
  a("fall.drop_pct", 12, "percent", "Size of the practice market fall.", "Behaviour practice only"),
  // --- summary score (never the headline; shown only behind 'About this summary')
  a("score.w_emergency", 30, "score", "Weight of the emergency reserve in the summary.", "Summary only"),
  a("score.w_insurance", 20, "score", "Weight of insurance cover in the summary.", "Summary only"),
  a("score.w_debt", 20, "score", "Weight of loans in the summary.", "Summary only"),
  a("score.w_savings", 20, "score", "Weight of the savings rate in the summary.", "Summary only"),
  a("score.w_diversification", 10, "score", "Weight of diversification in the summary.", "Summary only"),
  a("score.dti_full_below", 20, "percent", "Loan load at or below this share of income earns full loan marks.", "Summary only"),
  a("score.dti_zero_above", 50, "percent", "Loan load at or above this share of income earns no loan marks.", "Summary only"),
  a("score.highcost_factor", 0.6, "ratio", "Loan marks are scaled by this when any loan is costly.", "Summary only"),
  a("score.conc_floor", 20, "percent", "Top-sector share below this earns full diversification marks.", "Summary only"),
  a("score.conc_span", 40, "percent", "Extra top-sector share over which diversification marks fall to zero.", "Summary only"),
];

const BY_ID = new Map(ASSUMPTIONS.map((x) => [x.id, x]));

export function assumption(id: string): Assumption {
  const x = BY_ID.get(id);
  if (!x) throw new Error(`unknown assumption: ${id}`);
  return x;
}
/** The numeric value of an assumption. The engine's only way to read a constant. */
export const av = (id: string): number => assumption(id).value;

/** Adviser reviews live server-side; the code default for every entry is "unverified". */
export type Reviews = Record<string, { by: string; on: string }>;

export function statusOf(id: string, reviews: Reviews = {}): ReviewStatus {
  return reviews[id] ? "reviewed" : assumption(id).reviewStatus;
}

/** Ids (from the given list) that are still unverified. A result built on any of these shows the tag. */
export function unverifiedIn(ids: readonly string[], reviews: Reviews = {}): string[] {
  return ids.filter((id) => !assumption(id).notModelled && statusOf(id, reviews) === "unverified");
}
