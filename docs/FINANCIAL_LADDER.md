# The priority ladder: what comes before goal investing

> A planning **order** for discussion with a reviewer. It is **not** an instruction to buy, sell or repay any named
> product, and every threshold below is an unverified demo placeholder (`docs/ASSUMPTIONS.md`). A qualified
> professional must review them before any real use.

## Why it exists

A second independent review pointed out that the engine had no cash-flow check: a person whose month does not add up
could still be shown an attractive monthly goal amount. That was reproduced first (see "Before and after" below),
and is now blocked by a deterministic ladder in `src/lib/engine/ladder.ts`.

## The steps, in order

| # | Step | Blocks goal investing when | Needs attention (does not block) when |
|---|---|---|---|
| 1 | Monthly cash flow | income less essentials, other spending **and EMIs** is negative (shortfall), or is below the near-zero share of income | no income entered (shown as "attention", never as a verdict) |
| 2 | Emergency reserve (liquidity) | months of essential costs saved are below the severe mark | months saved are below the target for steady or irregular income |
| 3 | Loans | any loan costs more than the high-cost rate, **or** loan payments take more than the heavy-load share of income | |
| 4 | Insurance cover | people depend on the income and term cover is below the severe share of the starting point | any other term or health cover gap |
| 5 | Goals | any of steps 1 to 4 is blocked: goals are **later** | |

When a step is blocked:

- the plan pack opens with the **first** blocking step, then the other steps that need work, and every goal appears
  only as a "later" item with **no amount** (no SIP, no range, no future value);
- the dashboard shows "Fix cash flow first" (or the relevant step) and each goal card says "Later";
- the goal explorer shows "Fix cash flow first" instead of a slider;
- the goal-amount reminder is replaced by a cash-flow reminder;
- a live model that writes a `goal.*.sip` or `goal.*.future` placeholder is **rejected** and the validated fixture is
  used (`src/lib/ai/run.ts`, tested in `tests/ladder.test.ts`).

## Thresholds (all from the registry)

| Registry id | Value | Used for |
|---|---|---|
| `cashflow.near_zero_pct` | 5 | step 1: a surplus below this share of income is "near zero" |
| `ladder.liquidity_severe_months` | 1 | step 2: below this many months the reserve blocks |
| `ef.months.stable` | 6 | step 2 target (steady income) |
| `ef.months.irregular` | 9 | step 2 target (irregular income) |
| `debt.highcost_threshold` | 12 | step 3: yearly rate above which a loan is costly |
| `debt.dti_high` | 40 | step 3: loan payments above this share of income are a heavy load |
| `insurance.severe_ratio` | 0.5 | step 4: cover below this share of the starting point is a severe gap |

`tests/readme-truth.test.ts` fails if this table disagrees with the registry.

## Numbers added to the ground truth

`cash.income`, `cash.essential`, `cash.other`, `cash.emi`, `cash.surplus`, `cash.shortfall`, `cash.surplusPct`,
`ladder.blockedCount`, `ladder.firstBlockerStep`, `ladder.goalsLater`, `debt.dtiMark`. Each result carries
`{ value, formula, inputs, assumptions, assumptionIds }`, so the evidence drawer and the numeric validator treat them like any other engine value.

The "savings rate" now also subtracts EMIs. Before this change it ignored them, which is how a person with a negative
month was told they saved 28% of their income.

## Before and after: income 25,000, essentials 18,000, EMIs 10,000

Both runs use the same profile (a ten-year home goal of 15,00,000, savings of 40,000, one loan at 11%).

**Before** (recorded by running the engine before the change):

```
flags: ef_low:high, health_gap:high
save: {"rate":28.000000000000004,"monthly":7000}  <- ignores the 10,000 of EMIs
goal SIP low/base/high: 20855 / 14683 / 10232
plan items (in order):
 - p-emergency_reserve | Build your emergency reserve | Gap to target: ₹68,000
 - p-health_cover | Check your health cover | For discussion: cover near ₹10,00,000
 - p-goal_long-g1 | Plan for your home goal | Range for discussion: ₹10,232 to ₹20,855 a month. Taxes are not included.
findings.savings: You save about 28% of your income, which is ₹7,000 a month.
findings.goals: For your goal, the monthly amount may range from ₹10,232 to ₹20,855 depending on returns and inflation, which are not promised. Taxes are not included.
```

The old engine reported a 28% savings rate and a monthly saving of 7,000 although the month was 3,000 short, raised no
cash-flow finding, and put a goal amount of 10,232 to 20,855 a month (more than the person's whole income) in the plan.

**After**:

```
flags: cash_shortfall:high, ef_low:high, health_gap:high
cash: {"cash.income":25000,"cash.essential":18000,"cash.other":0,"cash.emi":10000,"cash.surplus":-3000,"cash.shortfall":3000,"cash.surplusPct":-12}
ladder: cash_flow=blocked(shortfall)  liquidity=attention(below_target)  debt=ok(ok)  protection=attention(gaps)  goals=later(later) | goalsLater: true
--- plan (en):
 - p-cash_flow | Fix your monthly cash flow first | Monthly gap: ₹3,000
 - p-emergency_reserve | Build your emergency reserve | Gap to target: ₹68,000
 - p-health_cover | Check your health cover | For discussion: cover near ₹10,00,000
 - p-goals_later-g1 | Your home goal comes after the steps above | Later: held back until the first step is on track
--- plan (hi):
 - p-cash_flow | पहले अपना मासिक नकदी-प्रवाह ठीक करें | मासिक कमी: ₹3,000
 - p-emergency_reserve | अपना आपातकालीन फंड बनाएं | लक्ष्य तक कमी: ₹68,000
 - p-health_cover | अपना स्वास्थ्य बीमा कवर जांचें | चर्चा के लिए: कवर लगभग ₹10,00,000
 - p-goals_later-g1 | आपका घर लक्ष्य ऊपर के कदमों के बाद आता है | बाद में: पहला कदम ठीक होने तक रुका हुआ
--- plan (ta):
 - p-cash_flow | முதலில் உங்கள் மாதாந்திரப் பணப்புழக்கத்தைச் சரிசெய்யுங்கள் | மாதாந்திர இடைவெளி: ₹3,000
 - p-emergency_reserve | உங்கள் அவசர நிதியை உருவாக்குங்கள் | இலக்குக்கான இடைவெளி: ₹68,000
 - p-health_cover | உங்கள் மருத்துவக் காப்பீட்டைச் சரிபார்க்கவும் | விவாதத்துக்கு: காப்பீடு சுமார் ₹10,00,000
 - p-goals_later-g1 | உங்கள் வீட்டு இலக்கு மேலுள்ள படிகளுக்குப் பிறகு வருகிறது | பின்னர்: முதல் படி சரியாகும் வரை நிறுத்தி வைக்கப்பட்டுள்ளது
findings.cash: After essentials, other spending and loan payments you are ₹3,000 short each month. Goal amounts are held back until the month adds up.
findings.savings: undefined
findings.goals: Goal amounts come after the first step on your ladder, so none is shown yet.
```

## What this does not do

- It does not know a person's real circumstances; it reads six answers and placeholders.
- Near-zero and severe thresholds are judgement calls, not rules from any regulator or standard.
- It says nothing about which product to use for any step.
- It does not model hospital costs, room-rent limits or policy exclusions (see `docs/ASSUMPTIONS.md`, "Not modelled").
