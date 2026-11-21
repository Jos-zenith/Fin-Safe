# Assumptions behind the numbers

> Generated from `src/config/assumptions.ts` by `npm run docs:assumptions`. Do not edit by hand.

**Every value below is a demo placeholder.** None has been reviewed by a qualified professional, and no entry
has a real source. Where there is no real source it says "demo placeholder, TO_VERIFY". Nothing is pre-marked
reviewed. An adviser can mark an assumption reviewed inside the demo (name and date, audited), which is a demo
workflow and not a regulatory approval.

The engine reads only from this registry (`tests/assumptions.test.ts` fails if a financial constant is
hardcoded in `src/lib/engine`). Every engine result lists the assumption ids it used, and any figure or plan
item built on an unverified assumption shows a visible "Uses unverified assumptions" tag.

## Registry

| id | value | unit | description | source | as of | confidence | status |
|---|---|---|---|---|---|---|---|
| `ef.months.stable` | 6 | months | Months of essential expenses to hold as an emergency reserve when income is steady. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `ef.months.irregular` | 9 | months | Months of essential expenses to hold when income is irregular. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `ef.months.critical` | 3 | months | Below this many months the emergency reserve is flagged as a high-severity gap. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `cashflow.near_zero_pct` | 5 | percent | A monthly surplus (income less spending and loan payments) below this share of income counts as near zero, which blocks goal investing. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `ladder.liquidity_severe_months` | 1 | months | Below this many months of essential costs saved, the emergency reserve is a blocking step before goal investing. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `income.good_uplift_pct` | 30 | percent | When only 'irregular income' is known, a good month is assumed this share above a typical month (a default, replaced by figures the person enters). | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `income.bad_drop_pct` | 40 | percent | When only 'irregular income' is known, a bad month is assumed this share below a typical month (a default, replaced by figures the person enters). | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `income.bad_run_months` | 6 | months | How many bad months in a row the reserve should be able to bridge when good, typical and bad month figures are entered. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `return.low` | 6 | percent | Pessimistic scenario: assumed yearly return before fees and tax. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `return.base` | 9 | percent | Base scenario: assumed yearly return before fees and tax. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `return.high` | 12 | percent | Optimistic scenario: assumed yearly return before fees and tax. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `inflation.low` | 4 | percent | Optimistic scenario: assumed yearly rise in prices. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `inflation.base` | 6 | percent | Base scenario: assumed yearly rise in prices. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `inflation.high` | 8 | percent | Pessimistic scenario: assumed yearly rise in prices. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `fee.expense_ratio` | 1 | percent | Assumed yearly cost of holding the investments, taken off the return. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `debt.highcost_threshold` | 12 | percent | Loans costing more than this yearly rate are flagged as costly. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `debt.dti_high` | 40 | percent | Loan payments above this share of income are flagged as a heavy load. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `savings.rate_low` | 10 | percent | Savings below this share of income are flagged as low. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `savings.rate_target` | 20 | percent | Savings rate used as the 'full marks' reference in the summary. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.term.multiple_none` | 0 | ratio | Term cover as a multiple of yearly income when nobody depends on the income. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.term.multiple_base` | 10 | ratio | Term cover as a multiple of yearly income when somebody depends on the income. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.term.multiple_per_dependent` | 1 | ratio | Extra multiple of yearly income for each dependent beyond the first. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.term.multiple_cap` | 15 | ratio | Upper limit of the term-cover multiple. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.term.support_years` | 5 | years | Years of the household's essential spending counted as support for dependents in the needs-based view of term cover (added to outstanding loans). | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.severe_ratio` | 0.5 | ratio | Cover below this share of the starting point is flagged as a high-severity gap. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.health.base.tier1` | 1000000 | inr | Health cover starting point for one person in a big city. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.health.base.tier2` | 700000 | inr | Health cover starting point for one person in a large town. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.health.base.tier3` | 500000 | inr | Health cover starting point for one person in a smaller town. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.health.per_member.tier1` | 300000 | inr | Added health cover for each further family member in a big city. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.health.per_member.tier2` | 200000 | inr | Added health cover for each further family member in a large town. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `insurance.health.per_member.tier3` | 150000 | inr | Added health cover for each further family member in a smaller town. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `quality.round_min_inr` | 10000 | inr | An amount at or above this that is a 1 or a 5 followed only by zeros (for example 1,00,000 or 50,000) looks like a placeholder. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `quality.round_count` | 2 | count | This many round-looking amounts among income, essential spending and savings suggests placeholders were typed in. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `concentration.sector_pct` | 40 | percent | A single sector above this share of the portfolio is flagged. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `concentration.holding_pct` | 25 | percent | A single holding above this share of the portfolio is flagged. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `concentration.overlap_pct` | 50 | percent | Fund overlap above this share is flagged. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `alloc.gold.low` | 5 | percent | Lower end of the gold share often discussed for diversification. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `alloc.gold.high` | 10 | percent | Upper end of the gold share often discussed for diversification. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `drag.corpus` | 1000000 | inr | Example amount for the regular-vs-direct illustration. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `drag.years` | 20 | years | Example duration for the regular-vs-direct illustration. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `drag.return` | 11 | percent | Example yearly return for the regular-vs-direct illustration. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `drag.expense_regular` | 1.6 | percent | Example yearly cost of a regular plan. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `drag.expense_direct` | 0.6 | percent | Example yearly cost of a direct plan. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `fall.drop_pct` | 12 | percent | Size of the practice market fall. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.w_emergency` | 30 | score | Weight of the emergency reserve in the summary. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.w_insurance` | 20 | score | Weight of insurance cover in the summary. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.w_debt` | 20 | score | Weight of loans in the summary. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.w_savings` | 20 | score | Weight of the savings rate in the summary. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.w_diversification` | 10 | score | Weight of diversification in the summary. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.dti_full_below` | 20 | percent | Loan load at or below this share of income earns full loan marks. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.dti_zero_above` | 50 | percent | Loan load at or above this share of income earns no loan marks. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.highcost_factor` | 0.6 | ratio | Loan marks are scaled by this when any loan is costly. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.conc_floor` | 20 | percent | Top-sector share below this earns full diversification marks. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |
| `score.conc_span` | 40 | percent | Extra top-sector share over which diversification marks fall to zero. | demo placeholder, TO_VERIFY | TO_VERIFY | low | unverified |

## Not modelled

- `tax.not_modelled`: Income tax, capital-gains tax and tax benefits are NOT modelled. Every goal result is before tax.
- `health.hospital_costs.not_modelled`: Hospital and treatment costs are NOT modelled. The health cover starting point is a placeholder by city size and family size, not an estimate of any bill.
- `health.room_rent.not_modelled`: Room-rent limits, sub-limits and proportionate deductions in a health policy are NOT modelled.
- `health.exclusions.not_modelled`: Policy exclusions, waiting periods, co-payments and claim conditions are NOT modelled. A cover amount says nothing about what a policy will actually pay.

## How goal results use them

- The amount a user enters is in **today's money**. It is raised for inflation to the goal date (pessimistic = high inflation, optimistic = low inflation).
- Savings already set aside for the goal are counted, **with growth**, before the monthly amount is worked out.
- Returns are taken **after** the assumed yearly fee (`fee.expense_ratio`).
- Results are a **range** (pessimistic / base / optimistic), never a promise.
- **Taxes are not included** and every goal result says so.

## Who must review these

A qualified adviser or other professional must review and replace these placeholders before any real use.
Reviewing them is outside what this repository can do.
