# The suitability gate of the demo workflow

> **This is a demo workflow.** Nothing here is a real suitability assessment, a real client agreement, a real e-signature or
> a regulated process. It shows where such steps would sit and makes the demo harder to rubber-stamp. What a real service
> needs is listed in `docs/PRODUCTION_GAP.md` as questions for qualified counsel, not answered here.

## Before a case enters the adviser queue

1. **Check your answers** (`/confirm`): every input, ticked or fixed by the customer (see `docs/INPUT_QUALITY.md`).
2. **Risk questionnaire** (`/agreement`): six structured questions covering **capacity** to bear a loss, **willingness** to bear
   it, **time horizon** and **experience**. The server computes a label (cautious, moderate, balanced, growth-oriented) that
   follows the **lower** of capacity and willingness; a short horizon or no experience can only pull it down. Capacity is also
   checked against the person's own numbers: an answer that does not fit them, or each other, is listed for the adviser.
   The label is **for discussion**. It is not a rating of the person.
3. **Consent (demo)**: the customer sees the **fee** (a placeholder), the **conflicts** statement, **what the demo is**, that there
   is **no e-signature**, and how their data is handled, and ticks one box. The record holds the version, the time, the language
   and the list of disclosures shown. It is **not** a signature and creates nothing legally binding.

The server refuses to create the case without both (`409 consent_required`, `consent_version`, `risk_incomplete`), and writes
`consent_recorded` and `risk_profile_recorded` into the case's hash-chained audit **before** the draft entry. The two seeded
waiting cases carry synthetic answers and a consent that are labelled as seeded: nobody gave them.

## Before approval

Approval (`POST /cases/:id/approve`) is refused unless **all** of these hold:

| Gate | Error | How it is met |
|---|---|---|
| the checklist, including "I have reviewed the assumptions marked unverified", is complete | `checklist_incomplete` | seven ticks |
| a consent is recorded | `consent_missing` | the agreement step |
| a risk profile exists | `risk_incomplete` | the agreement step |
| the adviser has **confirmed** the risk profile (name and time recorded) | `risk_not_confirmed` | ticking "Risk profile confirmed", which is only possible if a profile exists |
| the adviser has acted on **every plan item** (accept, edit or reject) | `items_pending` | nothing is accepted on their behalf any more |

The UI mirrors it: Approve stays off and says how many items are still undecided.

## Evidence that review was not a rubber stamp

- The time each plan item was **open** in front of the adviser (only while the tab is visible and at least half the card is on
  screen) is recorded as a **number** with the decision, capped at 30 minutes per item. No text is recorded.
- Approval time (claim to approval) is recorded as before.
- **Metrics warning, a demo heuristic:** an adviser who approves **more than 95%** of the cases they decide, with a median
  review time **under 2 minutes**, over **at least 5 decisions**, is flagged as *possible rubber-stamping*. The rule is shown on
  the page so it can be argued with; it can be wrong in both directions and is a prompt for a person to look, not a finding.
  The constants are in `src/config/workflow.ts`.

## After approval

- The state is **"Reviewed, awaiting your acceptance"** until the customer accepts the final reviewed plan (`plan_accepted` in the
  audit trail; the adviser is notified). Acceptance is a demo action.
- **"Report an error in this plan"** puts the case back with an adviser, **flagged** and urgent, with the customer's note
  (passed through the same safety rules as any text). An approved plan loses its approval and its risk confirmation and must be
  reviewed again; the earlier approval stays in the audit trail. An `error_reported` audit entry and notification are written.
- **What the adviser changed**, in plain language above the draft-versus-reviewed diff and on the plan: *"Changed 2 of 7 items,
  removed 1."*
