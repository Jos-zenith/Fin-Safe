# Input quality, confidence, irregular income and term cover

> Everything here is deterministic and runs from the same assumption registry as the rest of the engine. Every
> constant in the table below is an **unverified demo placeholder** (`docs/ASSUMPTIONS.md`). Nothing here judges a person:
> it says where a figure may be wrong and why.

## 1. What is listed before results are relied on

`src/lib/quality.ts` produces a list of issues. The dashboard shows the serious ones first ("Before you rely on this");
the "Check your answers" screen (`/confirm`) shows all of them; the adviser sees the same list for the case.

| Issue | Kind | Rule |
|---|---|---|
| income missing | missing | monthly income is zero or not entered |
| essentials missing | missing | essential monthly spending is zero or not entered |
| no insurance | missing | no term and no health cover entered at all |
| income below essentials | implausible | income is less than essential spending |
| EMIs above income | implausible | loan payments are more than income |
| family mismatch | implausible | zero dependents but a family size above one |
| goal in the past | implausible | a goal with zero or negative years left |
| round placeholders | implausible | two or more of income, essentials and savings look like round placeholders (a 1 or a 5 followed only by zeros, at or above a minimum amount) |
| employer cover unknown | default | somebody depends on the income and employer cover was never entered |
| defaults used | default | optional answers (other spending, city size, how steady income is, life and health cover, investments, savings set aside for goals) still at their defaults; good and bad month income when income is irregular |

## 2. Confidence next to every number

| Level | When |
|---|---|
| **Low** | a key input is missing. The metric says **"Cannot calculate reliably: <what is missing>"** and shows no number |
| **Medium** | every key input is there, but a default, an optional answer that is missing, or an implausible answer sits behind it, **or** it rests on assumptions nobody has reviewed |
| **High** | every input is entered, nothing looks off, **and** every assumption behind it has been marked reviewed |

Because nothing in this repository is pre-marked reviewed, **no metric can show High in the demo**. That is deliberate: it
is what "unverified assumptions" means. An adviser marking assumptions reviewed (a demo action, audited) is what would raise it.

A plan built on a missing key input contains one item, "Cannot calculate reliably: we need a few answers first", and every
goal is held back as "later" (see `docs/FINANCIAL_LADDER.md`). No figure, ranking or goal amount is shown.

## 3. "Check your answers" before a plan is requested

Asking for a review opens `/confirm`: every input, its value, a status (**You entered this**, **Default**, **Check this**),
an Edit button and a "This is right" tick. Defaults and answers that look off start **unticked**; the person ticks them on
purpose or edits them. Nothing goes to a reviewer until they confirm. The list of ticked fields is stored with the profile,
and the adviser's view shows **"Not confirmed by the customer: ..."** (or that the screen was never used).

## 4. Irregular income

The customer can enter income for a **good**, a **usual** and a **bad** month, or paste recent months (the best and
worst become good and bad; the median becomes usual). Without figures, "irregular income" keeps a longer default reserve
target and uses stated defaults for the good and bad month, **labelled as defaults** on the dashboard.

- **bad-month drain** = essential spending + EMIs - bad-month income (never below zero). Other spending is assumed to be cut.
- **minimum reserve** = bad-month drain x the number of bad months in a row to bridge.
- **survivable months** = savings / bad-month drain.
- **reserve target (with figures)** = the larger of the steady-income months and minimum reserve / essential spending.
  So it is **worked out from the bad month**, and can be longer or shorter than the blunt default.
- A **bad-month stress** finding appears when income really does swing and savings are below the minimum reserve.

| Registry id | Value | Used for |
|---|---|---|
| `income.good_uplift_pct` | 30 | default good month (only when no figures are entered) |
| `income.bad_drop_pct` | 40 | default bad month (only when no figures are entered) |
| `income.bad_run_months` | 6 | bad months in a row the reserve should bridge |
| `insurance.term.support_years` | 5 | years of essential spending counted as support for dependents |
| `quality.round_min_inr` | 10000 | smallest amount that can look like a round placeholder |
| `quality.round_count` | 2 | how many round-looking amounts raise the flag |

## 5. Term cover that knows about loans

When somebody depends on the income, the starting point to discuss is the **larger** of two views, both shown with their formula:

- **(a)** yearly income x a multiple (a base multiple, a step per extra dependent, up to a cap), and
- **(b)** outstanding loans + years of support x yearly essential spending.

Cover counts your own term policies plus **employer cover if it was entered**. If it was not entered it is **unknown**, which
the result says, and it is counted as zero for the gap (so the gap may be overstated). Entering zero says there is none.

## 6. What is not modelled

Hospital and treatment costs, room-rent limits and sub-limits, policy exclusions, waiting periods, co-payments and
claim conditions are **not modelled** and are listed as such in `docs/ASSUMPTIONS.md`. A cover amount says nothing about
what a policy will pay.
