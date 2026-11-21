# Pilot plan (a plan, not a result)

This describes how a **real** pilot of the review workflow could be run and judged. **No pilot has been run.** There are no participants, no results and no claims here. Every threshold is a blank for the people who would run the pilot to fill in, in advance, with a qualified adviser and counsel.

The demo's Metrics page is labelled "Demo data. Not evidence." for a reason: it counts a few clicks by the people who built it. It cannot support any of the questions below.

## Preconditions that must come first (not part of the pilot)

1. **Regulatory standing.** A real pilot with real clients needs a regulated entity that is accountable for the advice, and counsel's view on what the pilot may and may not do. That is not built or decided here (see `docs/PRODUCTION_GAP.md`).
2. **Data protection.** A data-protection assessment, a notice and consent text, a retention rule, and a way to delete a participant's data. The demo uses synthetic data only.
3. **Participating advisers** who agree to review in the tool, and a firm that can say what "adequate review" means for them.
4. **Real, reviewed assumptions.** Every figure in the demo rests on a placeholder (`docs/ASSUMPTIONS.md`). A qualified professional must replace and sign off each one before any figure goes to a real person.
5. **Reviewed Hindi and Tamil** by native speakers (`docs/translation-review.md`), if those languages are in scope.
6. **A live model run** with the team's own key (`npm run smoke:live`) and a human review of its output, before any live text reaches an adviser.

## What the pilot would try to learn (questions, not hypotheses we claim are true)

| Question | How it could be measured | Where the demo already records something similar |
|---|---|---|
| Does a prepared draft shorten an adviser's review compared with their usual process? | Time per plan, tool vs a control set done the usual way, same adviser, comparable cases. | Median review time; time to first reviewed plan |
| How often does the adviser have to change the draft, and where? | Share of plans with at least one edit or rejection; edit rate by plan topic; a short reason code per edit. | Drafts needing correction; edit rate per topic |
| Are any errors **material**? | An independent qualified reviewer samples approved plans and grades errors by severity. This is the measure that matters most, and it needs a person. | Not measured by the demo |
| Does the "numbers come only from the calculator" rule hold with a live model? | Rejection counts per task and a manual audit of every plan that reached an adviser. | Validation rejection rate; live-vs-template share |
| Can the end client understand and act sensibly on the output? | A short comprehension check with a sample of clients, in their language. | Not measured by the demo |
| Does the queue (priority, language, SLA) match how a firm really triages? | Adviser feedback; overdue counts against the firm's real service levels. | Overdue cases |
| Do clients come back and act on the next steps? | Follow-up completion and dates kept, with consent. | Action status and follow-up dates |
| Does the scam check help people, and what does it miss? | Reports of missed scams and false alarms, reviewed by a person; a sample of real messages (with consent) scored against the rules. | "Report a missed scam" list (local only in the demo) |

## Design notes

- **Pre-register** what counts as success and what counts as failure **before** starting, with the adviser and the firm. Fill in the thresholds in this table first: _median review time at most ___; drafts needing correction at most ___; material errors in sampled plans: ___ allowed; ___._
- **Sample size** needs a statistician. With a few dozen plans, medians are wide and rates are noisy; say so in any report.
- **A control** is needed for any "faster than before" claim.
- **Blinding** the independent reviewer to which plans were edited avoids anchoring.
- **Segments:** language, income pattern, goal type. A tool that works for one group may fail another; look.

## Stop conditions (decide these in advance)

Stop and review if any of these happens: a plan with a specific product or a price call reaches a client; a wrong figure reaches a client; a participant's data is exposed; an adviser reports feeling pressured to approve faster than they can check; a scam-check miss leads to a participant harm.

## What a pilot still would not show

Whether the model is safe in general; whether the economics work at scale (the unit-economics calculator is made-up arithmetic); whether clients would pay; whether a regulator would accept the process. Each needs its own evidence.

## A realistic sequence (to adapt)

1. Preconditions above. 2. Closed trial with advisers only, synthetic and consented real cases, no client contact. 3. Review the sampled errors with the firm. 4. Only then consider a small client-facing phase, if the entity and counsel agree. Dates and owners: _to be decided by the firm._
