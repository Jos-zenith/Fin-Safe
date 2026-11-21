# Judging playbook (demo script, claims, and answers to hard questions)

This is for you, not for the app. It keeps the pitch inside what the repository can prove.

## The one sentence
"ArthClear is an accountability loop for financial planning: **deterministic analysis, an AI draft, automatic validation, human review, a recorded decision and a tamper-evident audit trail.** The adviser is simulated; the loop is real."

If you remember one rule: **demo the loop, not the features.**

## The 4-minute demo (cut everything else)
| Time | Show | What it proves |
|---|---|---|
| 0:00 | One sentence above, then the landing page (do not click around) | The problem and the loop |
| 0:20 | Sign in as Priya, "Use demo answers", dashboard: 1.8 months of emergency cover, open the evidence drawer | Numbers come from a formula you can read, with assumptions and the "unverified" tag |
| 1:00 | "Get my plan reviewed": the amber **DRAFT** plan. Open "How was this made?" | Draft is not advice; you can see whether it was a live model or a template |
| 1:30 | **Bad output rejected** (see "Show a rejection" below) | The validator stops a wrong number or a stock tip before a user sees it |
| 2:00 | Switch to the adviser: claim, change one item, tick the checklist (including unverified assumptions), "Approve (demo)" | Human review, attributable edits |
| 2:45 | Back to Priya: green **REVIEWED (DEMO)** with the diff of what the adviser changed | The user sees exactly what changed |
| 3:15 | Audit trail, then terminal: `npm run audit:tamper` | Tampering is detected, and you can state the honest limit |
| 3:45 | Close on "what is real, simulated, not built" | Credibility |

Optional only if asked: Second Opinion, goal explorer, market-fall practice, metrics.

## Show a rejection (stronger than a perfect answer)
Run `npm test -- ai-pipeline numeric guardrails` or open `tests/ai-pipeline.test.ts` and point at the stub that returns an invented number and a named stock. Say: "Here the model output is wrong on purpose. The validator rejects it, the app falls back to a checked template, and the audit log records that it happened." That is true to the code and needs no live model.

## Prove the live model once
1. Set a **real model id** in `.env.local` (`AI_MODEL`). It must be an id your key can call, not a product name.
2. Run `npm run smoke:live`. A good run writes `docs/live-smoke.md` with per-task latency and the counts of schema failures, numeric rejections and fallbacks.
3. Quote only what that file says. If a task fell back to a template, say so.

## What you may claim, and what you may not
| Say | Do not say |
|---|---|
| "The workflow and safeguards are real; the adviser is a simulated persona." | "A human adviser reviews every plan." |
| "Numbers come from a deterministic engine; the model cannot write literal numbers." | "The AI is accurate" or "financially correct" |
| "The checks are tested; the live model was run N times with these results (cite the file)." | "Production-ready", "compliant", "SEBI-approved" |
| "Second Opinion lists warning signs and what it could not check." | "Scam detector", "this message is safe" |
| "The audit chain detects edits; a full rewrite is caught only by an outside digest." | "Tamper-proof" |
| "Hindi and Tamil text are pending native-speaker review." | "Fully localised" |

## The hard questions, with honest answers

### 1. "The adviser is simulated, so what does human review protect against?"
"In this prototype, nothing real. What we validated technically is whether AI-prepared planning can be constrained, reviewed, corrected, attributed and audited before a user sees a final result. The adviser is simulated because we are demonstrating the workflow, not offering regulated advice. A real deployment needs a registered adviser or partner entity."

### 2. "Which feature is the point?"
"The loop: input, deterministic analysis, AI draft, validation, review, decision, audit. Everything else supports it."

### 3. "Can your scam checker be fooled?"
"Yes. It is a rule-based second-opinion tool. On a frozen adversarial set we wrote ourselves it caught about 42% before we changed its default posture (see `docs/scam-eval.md`). Messages with a financial request and no known pattern are now rated 'Needs verification', never reassured. It does not read screenshots, calls, links or senders, and it never says a message is safe."
(If you have run the new eval after the posture change, quote the new number from the file instead.)

### 4. "A correct formula can still mislead. How do you handle that?"
"Three things: every result shows its formula, inputs and assumptions; results using unverified assumptions carry a visible tag; and when key inputs are missing the app says it cannot calculate reliably instead of showing a number. We do not claim the thresholds are validated. A qualified professional must review them."

### 5. "Does the AI actually work?"
"Default mode is templates filled with engine numbers, and the app labels which source produced each output. We ran the live path against a real provider: [cite `docs/live-smoke.md`: tasks, latency, rejections, fallbacks]. Rejection by the validator is expected and by design."

### 6. "Is your Tamil any good?"
"It has not been reviewed by native speakers. The highest-risk strings are listed in `docs/translation-review.md` for review. We would not ship it to real users before that."

### 7. "Can your audit log be tampered with?"
"Editing one entry is detected, shown live by `npm run audit:tamper`. Someone with full database access could rewrite the whole chain, and the demo shows that too. The defence is a daily digest stored where the database operator cannot change it. We export the digest but do not anchor it; production must."

## Before you present (checklist)
- [ ] `.env.local`: `AI_PROVIDER`, `AI_MODEL` (a real id), the matching key. Never show this file on screen.
- [ ] `npm run smoke:live` passed at least once; note the numbers.
- [ ] `npm run build` and `npm start` (or the deployed URL) work; load the app once before you present.
- [ ] Reset demo data; sign in as Priya in one window and the adviser in another.
- [ ] Rehearse the 4-minute path twice with a timer.
- [ ] Have `docs/scam-eval.md`, `docs/live-smoke.md` and `docs/PRODUCTION_GAP.md` open in tabs for questions.
