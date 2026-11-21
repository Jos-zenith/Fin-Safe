# ArthClear - see your money clearly, decide with someone accountable (India) - DEMO

> **Demo with synthetic data.** Not a SEBI-registered adviser or research analyst. No regulated investment advice is given, and no approval inside it constitutes real advice. The adviser shown is a synthetic persona with no registration. No money moves, nothing real is verified, and no real adviser, firm or user has taken part.

**AI prepares. A human reviews. You understand. Then you improve.** The UX borrows from the apps people already trust: WhatsApp (chat-style intake, ticks, forwarded-message checker, queue-and-thread adviser console) and UPI apps (avatar row, big amount keypad, success tick, history list, bottom nav, bottom sheets).

## Who this is for (an assumption, stated)

**Default assumption: the primary customer is an advisory firm**, not the end consumer. The product idea is a workflow that lets a human adviser review an AI-prepared, evidence-backed draft quickly, with an audit trail, while the end customer gets plain-language guidance. Nothing in the repository proves a firm wants this: no firm has used, reviewed or endorsed it, there has been no customer research, and the unit economics in the demo are illustrative and editable. If the real customer is someone else (a bank, a fintech, a consumer app), the same pieces apply but the positioning changes. `APP_NAME` is a single constant (`src/config/brand.ts`), so the name is easy to change.

**The spine, in the navigation:** **Understand** (what your numbers say, with the evidence behind each) -> **Plan** (a draft, clearly marked, that a human adviser reviews) -> **Review** (what happened, and the audit trail) -> **Improve** (next steps, and what changed when you updated your numbers). Second Opinion (scam-message check) and Market-fall practice are tools, under **Tools**.

## What is real, simulated and not built

| Area | Status | Honest detail |
|---|---|---|
| Deterministic calculations (reserve, goals, insurance gap, loans, concentration) | **Real code, placeholder inputs** | Tested, with independent reference simulations. Every assumption is a "demo placeholder, TO_VERIFY" (`docs/ASSUMPTIONS.md`); none has been reviewed by a qualified professional. Taxes are not modelled. |
| AI text (plan, findings, nudges, answers) | **Simulated by default** | Mock mode uses pre-written templates filled with engine figures. A live model was **run once** (one smoke run of 18 requests against one provider, `docs/live-smoke.md`): 17 of 18 answers passed the checks and 1 fell back to a template. One run is a sample, not an evaluation of quality. `npm run smoke:live` needs your key and a real model id. |
| Priority ladder (cash flow, reserve, loans, cover, **then** goals) | **Real code, placeholder thresholds** | A month that does not add up, a near-zero reserve, costly or heavy loans, or dependents with almost no cover hold every goal amount back as "later"; the plan opens with the first blocking step. A planning order for discussion, never an instruction to buy, sell or repay anything. `docs/FINANCIAL_LADDER.md` records the before and after of the 25,000 / 18,000 / 10,000 scenario. |
| Irregular income, missing-data layer, confidence labels, "Check your answers" | **Real code, placeholder thresholds** | Good, usual and bad month income size the reserve against the worst months (defaults are labelled as defaults). What is missing or implausible is listed before results are relied on; every metric carries a Low / Medium / High confidence label (never High while assumptions are unreviewed); a missing key answer shows "Cannot calculate reliably" instead of a number. The customer ticks or fixes each answer before a review is requested, and the adviser sees what was never ticked. Term cover counts loans and years of support, and employer cover is "unknown" until entered. Hospital costs, room-rent limits and policy exclusions are **not modelled**. `docs/INPUT_QUALITY.md`. |
| Suitability gate (risk questionnaire, consent, every item decided, customer acceptance) | **Demo workflow, not a regulated process** | No case enters the queue without a six-question risk profile and a recorded demo consent (fee, conflicts, what the demo is; **not** an e-signature). Approval is refused until the adviser has decided every plan item and confirmed the risk profile. The customer accepts the reviewed plan or reports an error (it returns flagged). Per-item time-open is recorded as a number, and Metrics warns about possible rubber-stamping by a stated, arguable rule. `docs/SUITABILITY_GATE.md`. |
| Numeric contract (the model never writes a number) | **Real, enforced** | Schema, number check, substitution, number check again, safety rules; rejected answers fall back to a validated fixture. |
| Adviser | **Simulated** | One synthetic persona. No registration, no real adviser identity, no real adviser network or service levels. |
| Case workflow (queue, claim, review, approve, questions, notifications) | **Real in the demo, not production** | Server-side state machine, role checks and SQLite store; see "The demo workflow runs on a server" and `docs/PRODUCTION_GAP.md`. |
| Authentication | **Demo only. Not secure authentication.** | "Continue as a persona". Nobody's identity is proved. |
| Audit trail | **Real hash chain** | Tamper-**evident**, not tamper-proof. |
| Scam check (Second Opinion) | **Real rules, small synthetic evaluation** | Three outcomes, no green tick and no "safe" verdict: **High risk: strong indicators**, **Needs verification: not enough evidence either way** (with a list of what to do, none of it a link or phone number), **No known indicators found** ("That does not mean the message is safe"). Conversation-level signals (an unknown sender claiming to be your adviser, a private-group invitation, a new payee, certainty without the word "guarantee") are weak alone and add up; a lone one is never "no known indicators". Measured on a corpus the authors wrote, in three separately reported kinds of number: **tuned**, **held-out**, and a frozen **adversarial-v1** set that was never tuned on (`docs/scam-eval.md`). None is a real-world detection rate. OCR of screenshots, voice-call reporting and live reputation lookups are not built. |
| Hindi and Tamil text | **Unreviewed** | Pending native-speaker review (`docs/translation-review.md`). |
| SEBI registry | **Sample data only** | Labelled "SAMPLE DATA - NOT THE REAL SEBI REGISTRY". Never a verification. |
| Regulated entity, suitability process, client agreements, fee and conflict disclosures, record retention, AI governance, data-protection review | **Not built** | Items to put before counsel: `docs/PRODUCTION_GAP.md`. |
| Payments, KYC, account aggregation, investment execution, native apps, real customer research | **Not built / out of scope** | |
| Metrics and unit economics | **Illustrative** | Adviser Metrics page is labelled "Demo data. Not evidence." `docs/PILOT_PLAN.md` says what a real pilot would measure. |

## Run it

```bash
npm install
npm run dev          # http://localhost:3000  (mock mode, no key needed)
```

| Command | What it does |
|---|---|
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest: engine, numeric validator, guardrails, fixtures, retention, cases, i18n, contrast |
| `npm run test:e2e` | Playwright (needs `npm run build` first, one-time `npx playwright install chromium`): the full Priya demo, all 16 intake questions, a **two-browser** customer and adviser run (claim, returned question, reply, approval, live notifications, audit chain), a Tamil scam check, Ask-a-question refusals, the goal explorer, and a no-horizontal-scroll check on every page at 360px and 1280px. It starts its own server with a fresh database |
| `npm run smoke:live` | **Needs your key.** Runs every AI task against the real provider and writes `docs/live-smoke.md`. Refuses (non-zero exit, no report) without a key. See "AI status" |
| `npm run eval:scam` | Measures the scam check against `tests/fixtures/scam-corpus.json` and writes `docs/scam-eval.md` (synthetic corpus, optimistic numbers; read the caveats there) |
| `npm run test:live` | Older live-provider vitest check. Skipped in mock mode |
| `npm run docs:assumptions` / `npm run docs:translation` | Regenerate `docs/ASSUMPTIONS.md` and `docs/translation-review.md` + `src/i18n/review-status.json` (tests fail if they are stale) |

## Environment (`.env.example`)

```env
AI_PROVIDER=mock        # mock | anthropic | gemini
AI_MODEL=               # model id lives ONLY here; empty with a real provider => safe fall back to mock
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
SESSION_SECRET=         # REQUIRED in production (signs the demo session cookie); dev generates one with a warning
TRUST_PROXY=            # set to 1 only behind a proxy that overwrites x-forwarded-for
# optional: ANTHROPIC_BASE_URL / GEMINI_BASE_URL (proxy or test stand-in), AI_TIMEOUT_MS, AI_TOTAL_BUDGET_MS, AI_MAX_TOKENS, AI_RATE_PER_MIN, AI_RATE_GLOBAL_PER_MIN (see .env.example)
```

**Mock mode is the default** and needs nothing. Fixtures exist for every task x persona x language (EN/HI/TA) and pass the same validators as live output. A real provider is used only when its key **and** `AI_MODEL` are set. Settings shows which mode the server is actually in.

### What is real, and what is a template (be honest on stage)
In the default mock mode there is **no model**. The plan, findings, nudges and answers are pre-written templates filled with numbers from the deterministic engine. That is safe and reliable, and the app says so: every AI-prepared section carries a source label with an expandable "How was this made?" ("Template (mock)" / "Live model" / "Fallback after validation failure"), and Settings shows the server's mode. With a real provider the same screens carry the live label instead.

How the live path is verified, from weakest to strongest:

1. **Wire tests** (`tests/provider-wire.test.ts`, run by `npm test`). The real Anthropic and Gemini adapters send real HTTP to a local **stand-in** server that speaks each vendor's format. They prove the request shape, auth headers, the model id coming from `AI_MODEL`, the token budget, parsing, truncation / timeout / HTTP-error handling, the privacy rule (no name, city or raw figure leaves the server) and the whole validation pipeline over a socket. The stand-in is **not a model**: it only echoes the placeholders the prompt offers, so this proves plumbing, not quality.
2. **Live smoke run** (needs a key). This is the only thing that proves a real model works:

```powershell
$env:AI_PROVIDER="anthropic"; $env:AI_MODEL="<model id>"; $env:ANTHROPIC_API_KEY="<key>"; npm run smoke:live
```

It sends every task for Priya in English, Hindi and Tamil through the real pipeline and writes `docs/live-smoke.md`: provider, per-task success, p50 and max latency, and counts of schema failures, numeric rejections, guardrail rejections and fallbacks. It records counts only (no key, no model id, no profile data, no model text). **With no key it prints "Live path not exercised; run npm run smoke:live with your key.", exits non-zero and writes nothing**, so a passing report cannot exist without a real run. A run **fails** if any task had no answer that survived validation. Expect live output to be rejected more often than fixtures: the validators are strict on purpose.

`npm run test:live` is the older, lighter vitest version of the same check.

### AI status

| | |
|---|---|
| Default mode | **Mock.** No model is called. Text is pre-written and filled with engine figures. |
| Live model | **Run once** (18 requests, English, Hindi and Tamil, one provider; see `docs/live-smoke.md`). 17 of 18 answers survived validation, one Tamil Second Opinion fell back to a template, and one English adviser-copilot answer was rejected by the number check and retried. This shows the live path runs end to end. It does not measure quality, accuracy or whether Hindi and Tamil text is natural. |
| What *is* tested | The pipeline (schema, number check, safety rules, retry, fallback) against stand-in models that behave well and badly, and the real HTTP adapters against a local stand-in server (`tests/provider-wire.test.ts`, `tests/prompt-quality.test.ts`, `tests/smoke.test.ts`). |
| What is *not* known | Whether a real model follows the placeholder rule often enough to be useful, how often it is rejected, its latency, and the quality of its Hindi and Tamil. Those need your key and then a human reviewer (native speakers for Hindi and Tamil). |
| How you can tell | Every AI-prepared text carries a source line with "How was this made?": **Live model**, **Template (mock)**, or **Fallback after validation failure**. |
| Which outputs were live | **Settings** shows, from this server, "Last N AI outputs on this server: x live, y from templates, z fallback" (counts only; `GET /api/v1/ai/status`). `docs/live-smoke.md` records one live run (18 requests); outside that run the app is in mock mode, so a fresh checkout without a key will show 0 live. |
| Plan preparation | Asking for a review answers at once; the findings and then the plan are prepared in the background with a visible progress state, each timed on its own (Metrics, adviser only). The case enters the adviser's queue only when the plan is ready. If preparation fails, or the model's answer is rejected and pre-written text is shown (badge "Fallback after validation failure"), a **Try again** button is offered until a reviewer starts. A serverless host that stops work after the reply would need a real job queue (`docs/PRODUCTION_GAP.md`). |
| Rejection counters | The server counts, per task, live requests that failed a schema, number or safety check (`GET /api/v1/ai/stats`, adviser only, counts only, held in memory). |

## The demo workflow runs on a server (cases, queue, notifications, audit)

Cases, plan versions, the adviser queue, notifications, assumption reviews and the audit trail live in a **server-side store**, not in the browser. The browser keeps only the customer's own in-progress answers.

- **Store:** a `CaseStore` interface (`src/server/store/types.ts`) with a **SQLite** implementation on Node's built-in `node:sqlite` (Node 22.13+, no install, no native build), so `npm install && npm run dev` still just works. It is a demo choice, not a production one; `docs/PRODUCTION_GAP.md` says what a real service needs. The database file is `.data/demo.sqlite` (git-ignored).
- **Sign-in:** "Continue as Priya / Ramesh / Anita / Start fresh / Adviser console" starts a session for a seeded demo account. There are no passwords. The cookie is HMAC-signed, httpOnly and SameSite=Lax, keyed by `SESSION_SECRET` (production refuses to start without it; development generates one and warns). **Demo authentication. Not secure authentication.** It proves nobody's identity.
- **Shared accounts:** Priya, Ramesh, Anita and the adviser are single seeded accounts; everyone who continues as the same persona shares it until it is reset or purged. "Start fresh" gives a private anonymous account.
- **Authorization** is checked on the server for every route: a customer sees only their own case; only an adviser lists the queue, claims, edits and approves. Tests cover a customer approving, claiming or reading someone else's case.
- **State machine** enforced on the server: waiting -> in review -> (question -> reply ->) approved -> accepted by the customer (or an error reported, which returns it flagged). Invalid steps return 409. Two advisers cannot both claim a case. Approval needs the whole checklist (including the assumptions acknowledgement), a recorded consent, a risk profile the adviser has confirmed, and a decision on every plan item (`docs/SUITABILITY_GATE.md`).
- **Queue:** priority, language, flags, waiting time and an SLA (120 minutes in `src/config/workflow.ts`) with an "overdue" marker. Two seeded cases are waiting (Ramesh is already overdue).
- **Notifications** reach the other side within the poll interval (5 s; `POLL_MS`) without a reload: a new case, a returned question, a reply, an approval. An unread badge sits on the bell.
- **Audit:** per-case, append-only, hash-chained (`hash = SHA-256(prevHash + canonical entry)`), with actor id, role and request id. The database refuses updates and deletes of audit rows, and "Audit chain verified" is recomputed on demand. A hash chain makes tampering **detectable**, not impossible.
- **Retention:** demo data idle for 24 hours is purged at start-up and hourly. "Delete my demo data" removes everything an account holds and keeps one anonymous counter. "Reset demo" re-seeds **only the signed-in account**.
- **The plan is drafted on the server** from the profile the server holds; a customer cannot supply one.

## Screens (the 25 approved routes, designed at 1440, 1024, 768 and 390 px)

The visual design is the approved wireframe set in `wireframes2/project` (charcoal ground, electric lime for the one primary action, burgundy, lavender and warm ivory; Space Grotesk headings, Inter text). Tokens and component classes are in `src/app/globals.css`; the shared components are `src/components/ui.tsx` and `src/components/ds.tsx`. A "surface" class (`s-dark`, `s-ivory`, `s-lime`, `s-burg`, `s-lav`) redefines the colour variables for everything inside it, so one component is readable on any surface (`tests/palette.test.ts` checks the contrast of each).

Navigation: customers get a top bar (Home, My Plan, Second Opinion, Learn, Settings) and, on a phone, a bottom bar of five round icons; advisers get Cases, My Queue, Copilot, Audit, Settings. Role, language, the "Demo: synthetic data" pill and the profile menu are always reachable.

| # | Route | What |
|---|---|---|
| 01 | `/` | Landing: the promise, two entry points (Start Financial Health Check, Explore Second Opinion), the journey, "Built to be checked", AI vs human cards, the three content labels; sample people (Priya, Ramesh, Anita) and the demo adviser as small shortcuts |
| 02 | `/intake` | Step list, one question card (the six core questions, the keypad, voice input), and a rail with "What we know so far", why each question is asked and what happens to the data |
| 03 | `/dashboard` | The first thing to fix (the current step on the financial ladder) with its figures, a plain summary, savings rate, loans, income and spending (table is the primary view), cover gaps, allocation; rail with plan status, data quality (**Add** tasks), priority findings, sources, action center. **See all measures** opens the full list with confidence and the AI-written findings |
| 04 | `/advice/:caseId` | The AI draft: amber banner ("Do not act on this yet"), dashed amber items with a DRAFT chip, evidence and limits, goal explorer, "Ask a question" |
| 05 | `/case/:caseId` | Case status: five-step tracker, owner, next step (no invented turnaround time), what to do while waiting, activity, the adviser's question and your reply |
| 06 | `/case/:caseId/review-requested` | Confirmation with the case reference and time, the "still a draft" panel and what happens next |
| 07 | `/case/:caseId/approved` | The reviewed plan: green banner, the adviser's accountability card, edited and removed items marked in words, accept, report an error, disclosures |
| 08 | `/case/:caseId/audit` | What changed, who acted, when: filters, version compare, approval record, hash-chain check, record download. "Tamper-evident, not tamper-proof" |
| 09, 10 | `/second-opinion`, `/second-opinion/result` | Check a message without an account; warning signs quoted and numbered, questions to ask, what to verify, what the check could not do. Never a green tick or a "safe" verdict |
| 11 | `/guardrail/market-fall` | A quiet page for a panic moment: facts, what nobody can know, three equal options (pause, review the plan, talk to an adviser). There is no sell path |
| 12 | `/actions` | Planning steps per finding: mark complete, snooze (3 days, 1 week, a date), dismiss, each with Undo, and "Why you are seeing this" |
| 13 | `/transparency` | How we earn, conflicts first; figures are placeholders and say so |
| 14 | `/learn` | Search and topics over the education that exists (emergency fund, SIP, regular vs direct plans, registry check) and the two practice tools |
| 15 | `/settings` | Language, accessibility (text size, high contrast, reduced motion, screen-reader hints), demo data (reset, clear, remember), AI mode, privacy |
| 16-20 | `/adviser`, `/adviser/case/:caseId` (+ `/copilot`, `/approve`, `/audit`) | Case table with filters, review with the original AI text beside the adviser's edit (a reason is required for an edit), copilot, the approval checklist and the read-only audit record |
| 21-24 | `/about`, `/compliance`, `/sources`, `/help` | Product boundary, demo limits and data handling, the registry of assumptions and statistics with their dates (placeholders are flagged), FAQ. The long text on Compliance and Help is in English for now and says so |
| 25 | any other address, and a failed page | 404 and a recovery-oriented error page; data-unavailable and no-permission states appear where they happen |

Also kept (no wireframe was supplied, so they use the same design system): `/confirm` (Check your answers: every input with its status, an edit button and a tick; asking for a review passes through it), `/agreement` (the risk questionnaire and the demo consent that must precede a case, with no e-signature), `/assumptions` (every assumption with its status; an adviser can mark one reviewed) and `/metrics` (adviser-only, labelled "Demo data. Not evidence."). The first version's addresses (`/home`, `/check`, `/fall`, `/improve`, `/plan`, `/activity`) redirect to the new ones.

### Draft mark, print and the single score

- **Every screen that shows an unreviewed plan** (the draft plan, the action center and the adviser's case view) carries a diagonal "DRAFT · NOT FINAL" mark that repeats on every printed page. It is not clickable and is hidden from screen readers (the words are already in the visible banner). **Printing or saving as PDF** adds a banner ("DRAFT, printed copy. Prepared by AI, not final, not advice") and leaves the navigation out. Once a plan is approved in the demo workflow the mark is gone. There is no separate export screen; print is the only export, and this is what it carries.
- **The composite score is never alone.** On the dashboard it sits in the same card as the individual checks, behind a disclosure, with the unverified-assumptions tag. In the adviser's snapshot it is behind a disclosure under the individual numbers, with the same tag. When someone asks for it in the Ask box, the answer always includes at least one number behind it (a test checks every persona and language).
- **No new screens were added** in this pass: the dashboard is shorter, not split.

## Architecture

```
src/config      assumptions.ts (the registry: EVERY financial constant), workflow.ts (SLA, checklist ids, retention hours),
                brand.ts (APP_NAME), economics.ts, constants.ts (a read-only view of the registry for the UI)
src/data        personas, synthetic adviser, 8 Second Opinion samples, sample registry, sources
src/lib/engine  pure deterministic maths: {id, value, unit, formula, inputs, assumptions, assumptionIds}
src/lib/engine/explore.ts   goal-explorer maths (corpus at a monthly amount, cost of waiting)
src/lib/ai      schemas (Zod), prompts, numeric validator, guardrails, mock fixtures + answers, providers, run.ts pipeline
src/lib/scam    the Second Opinion rules: normalisation, offline link heuristics, scoring
src/server      api.ts (ONE router), auth.ts, workflow.ts (the state machine), improve.ts (actions), metrics.ts, retention.ts
src/server/store  the CaseStore interface and its SQLite implementation (hash-chained audit lives here)
src/app/api/v1  the workflow API (catch-all route into src/server/api.ts); src/app/api/ai is the stateless AI route
src/lib         cases.ts (pure view helpers over a server case), storage.ts (browser retention), session.ts, redact.ts
src/i18n        en / hi / ta JSON (parity is tested)
```

**Pipeline for every AI output (mock or live):** Zod schema -> numeric check on templates -> placeholder substitution -> numeric check on the result -> guardrails. Failure: retry once, then the validated fixture, and a `system` audit entry.

### The numeric contract
The model never writes numbers. It writes `{{ef.months}}`-style placeholders; the server substitutes engine values (Indian grouping, e.g. `₹1,20,000`). `validateNumericIntegrity(text, engine, allowlist, phase)`:
- normalises Devanagari / Tamil / full-width digits;
- **pre**: any literal number or number word (English, Hindi, Tamil) fails unless it sits in `numericAllowlist.ts`; unknown placeholders fail;
- **post**: every number must equal an engine value within rounding tolerance; leftover placeholders fail.
The model only ever sees structure and flags, never the user's figures.

### No-security-recommendation rule (enforced twice)
Prompt rules in `prompts.ts`; then the plan schema: `assetClass` is an enum and every schema is `strict` (no instrument field exists), plus the guardrail layer (security directives, named instruments, price targets, guaranteed-return language, superlatives; EN/HI/TA). A stock-tip question never reaches a model: it gets a refusal and a `system` audit entry.

Guardrail design: **a word alone never blocks**. Insurance words ("sum assured", "guaranteed renewal"), finance terms ("risk-free rate"), a goal sentence ("your goal is to reach ₹50,00,000"), tax terms ("TCS" as tax collected at source) and the user's own bank ("your HDFC home loan") are legitimate planning text. Blocking needs a promise, a price call, a directive, a projection ("this will double in five years"), or a named instrument paired with an instrument word, an action or a verdict.
- **Guarantees** are about returns. "Nobody can promise guaranteed returns" passes only because a negator or warning frame sits right next to the phrase. First- and second-person promises ("I promise...", "as promised...", "you will definitely earn...") are always blocked.
- **Price calls** need a price subject ("stock price will reach..."), so a goal sentence is safe. Hindi "टारगेट" and Tamil "இலக்கு" mean goal and are only blocked inside "target price" phrases.
- **`best`** is blocked as a product claim; "in your best interest" and "best practices" pass.
- **Named companies**: in anything personalised, blocked next to an instrument word ("HDFC mutual fund"), an action ("move your money into SBI Bluechip") or a verdict ("Tata Motors looks attractive"). In Second Opinion explanations (education text) a neutral mention passes. Crypto tokens are always blocked in personalised text.
- **The refusal** targets specific securities and price predictions, in English, Devanagari, Tamil script and romanised Hinglish / Tamil ("kaun sa share lun", "SBI share lena chahiye kya"). Questions about a house, insurance, a loan, gold, equity as an asset class, or "what is a mutual fund?" are answered.
- **Numeric check** accepts everyday idioms ("no one", "one of the risks") and Hindi "एक" used as an article; a counted quantity ("एक प्रतिशत", "one percent") still fails.
- Adviser edits go through the same guardrails; a blocked edit is not saved and is logged as `system`.
- Every sentence that once misfired is a row in `tests/corpus.test.ts`. When you tune a rule, add the row first, so the rule's history is kept in the repo.

## Security notes (a demo, not a security audit)

- **Headers** (`next.config.ts`): Content-Security-Policy (same-origin by default, `frame-ancestors 'none'`, no plugins, no foreign script hosts), `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a restrictive `Permissions-Policy` (microphone only for this origin, for optional voice input). Next.js needs inline scripts, so `script-src` still has `'unsafe-inline'`; a nonce-based policy is future work.
- **Secrets:** keys and `SESSION_SECRET` are read on the server only. `tests/bundle-secrets.test.ts` builds the app with sentinel secrets in the environment and fails if any sentinel value, or any key-shaped string, appears in the build output.
- **Logs** hold task, status, latency and reasons only (never profile data, pasted text or error messages). Tested.
- **Limits:** the API rejects oversized bodies (413), unsupported languages and unknown fields (400). Tested.
- **Rate limiting** sits behind a `RateLimiter` interface; the in-memory implementation trusts `x-forwarded-for` only when `TRUST_PROXY=1`. A real deployment needs a shared store and a platform-verified address.
- **Demo authentication. Not secure authentication.** See "The demo workflow runs on a server".
- **`npm audit`, before and after the test-runner upgrade (2026-11-20).** *Before:* production dependencies (`npm audit --omit=dev`) **0** vulnerabilities; including development dependencies **3** (1 moderate, 2 critical), all in the test runner chain (`vitest`, `@vitest/mocker`, `tinypool`) and none in the application bundle. *After:* `vitest` moved from 3 to **5.1.1** with an explicit install (not `npm audit fix --force`), `vite` held on the 7.x line; both `npm audit` and `npm audit --omit=dev` now report **0** vulnerabilities, and all tests pass. The upgrade needed two changes: the config became an ES module (`vitest.config.mts`) and the **test pool is `vmForks`**, because Vitest 5's default pool failed every file here ("failed to find the runner", reproduced with a one-line test) while the VM pools pass. **The root cause was not found**; `vitest.config.mts` says so, and the default pool should be re-checked on the next upgrade. Re-run `npm audit` before relying on this.
- **Free text and redaction.** Before a pasted message or a typed question can reach a model it is redacted (also inside the AI pipeline, whatever the caller did): link query strings (with or without a scheme), emails, UPI handles, PAN, IFSC codes, Aadhaar-shaped and other long numbers (phone and account numbers, in Hindi and Tamil digits too), short account numbers that say "A/c" or "account", and a one-time code or PIN typed into the text. **Names are not removed reliably**: only a name after a greeting or "my name is" is caught. A visible notice says "Do not type names, account numbers or ID numbers" above the Ask box and the message checker, in all three languages, and says that names cannot be removed reliably.
- **Audit anchoring.** The SHA-256 chain makes tampering detectable only while the whole chain is not rewritten. `GET /api/v1/audit/digest` (advisers) shows a digest of every chain's head, the Metrics page shows it with an export button, and `npm run audit:digest` writes `audit-digest-YYYY-MM-DD.json` next to the database, **once per day and never overwriting an earlier file**; the retention timer also writes it. A test shows a chain rewritten with every hash recomputed still verifies on its own but fails the digest check. **This is an export, not an anchor**: production must keep the digest in independent, immutable storage (`docs/PRODUCTION_GAP.md`). Nothing is sent anywhere.
- **Database.** The embedded SQLite store is for local, single-process use. The server prints a warning at start-up when its environment looks serverless or multi-instance. `docs/POSTGRES_MIGRATION.md` maps every `CaseStore` method to the work a Postgres store needs; it is **not implemented**.
- **Not done:** penetration test, threat model, dependency-provenance review, WAF, DDoS protection, secrets rotation. See `docs/PRODUCTION_GAP.md`.

## Retention (PRD 7.6)
- Default `sessionStorage`, one namespace `fsdemo:v1:`. Gone when the tab closes.
- "Remember my demo on this device" is **off by default**; when on, `localStorage` with a 24h `expiresAt`, purged on load.
- 30 minutes idle -> notice and data cleared.
- "Clear demo data" removes every namespaced key from both storages (tested); "Reset demo" restores seed data (separate).
- Language is the only preference kept beyond the session.
- Never stored: API keys, raw AI responses, or Second Opinion text (it lives in component state only). The one exception is the person's own choice: "Report a missed scam" saves the **redacted** message in this browser for at most 24 hours (capped at 50, removed by "Delete my demo data"). Names are removed on a best-effort basis only.
- Server: the workflow keeps cases, plan versions, the audit trail, notifications, actions and metric events in the SQLite store described above (demo data, purged after 24 hours idle, deletable on request). There is no third-party analytics. Logs carry only task, status, latency and rejection reasons.

**The 24-hour purge is a demo policy, not a record-retention schedule**, and Settings says so. A real deployment would need consent, data minimisation, a retention schedule reconciled with whatever record-keeping duties apply, and a DPDP Act compliance review, with qualified counsel (`docs/PRODUCTION_GAP.md`).

## Compliance design
Every badge pairs an icon with text. "Approve (demo)" stays disabled until all seven checklist items (including "I have reviewed the assumptions marked unverified" and "I understand this is a demo workflow and not real advice.") are ticked, then asks for confirmation with the demo sentence. The adviser has no registration field; the UI shows "No registration (demo persona)". The "How we earn" banner appears on the plan, approval screen and recommendation-like screens. No hardcoded statistics: anything statistical comes from `src/data/sources.ts` with source and as-of (all `TO_VERIFY`).

## What this demo is not
- **Multi-party only as a demo.** Customer and adviser are separate server-side sessions (two browsers work and are tested), but the adviser is one synthetic persona, sign-in proves nobody's identity, and the store is a single-process SQLite file. A real service needs real identity, a managed database, real staffing and service levels (`docs/PRODUCTION_GAP.md`).
- **No real data.** The first result needs six answers; optional "Improve accuracy" questions add more. Portfolio look-through uses a small fictional fund table; there is no account-aggregator or CAS import.
- **What the goal maths does and does not do.** Goal amounts are in today's money and raised for inflation, savings already set aside for a goal are counted with growth, and returns are after an assumed fee. **Taxes are not modelled**, and every constant is an unverified placeholder (`docs/ASSUMPTIONS.md`). The evidence drawer says so.
- **Product reality.** Asset-class-only outputs are safe, but much of a user's value sits in mapping to actual products, which this system refuses to do by design. The adviser Metrics page carries an illustrative unit-economics calculator with made-up defaults; the real economics (adviser time per plan against `₹X/month`, and who pays) are unmeasured until a pilot runs (`docs/PILOT_PLAN.md`).

## Regulatory reality (not legal advice)
In India, personalised advice that a human adviser reviews and approves is a regulated activity (registration, suitability and risk profiling, fee rules, record-keeping). "Approve (demo)" beside an empty registration field is a clean demonstration device, not a compliant process. A real business needs to be, or partner with, the registered entity, and to have counsel review the product, the disclosures and the data handling (including DPDP Act duties).

## Known limits
- **"Ask a question" in mock mode is topic routing, not conversation.** It matches keywords (English, romanised Hindi, Hindi, Tamil) to about 18 answer templates built from the user's numbers or plain education, refuses named securities and market predictions, and says what it *can* answer when it does not understand. Each answer is labelled as a template. A live model, behind the same validators, is what makes it open-ended.
- **Vernacular scam coverage is tested but written by the build agent.** `tests/vernacular.test.ts` covers Tamil, Hindi, romanised Hindi and romanised Tamil scams and warnings, including Tamil / Devanagari digits. The messages are not from native speakers or real scam reports; add real ones as they are collected.
- **Second Opinion is rule-based in mock mode.** It works sentence by sentence (so a warning notice such as "beware of guaranteed returns, never share your OTP" is not flagged, and "we are SEBI registered" does not switch off the unregistered-adviser flag). It covers investment pitches plus credential requests (OTP / PIN), phishing links, payments to a personal UPI ID and pre-IPO offers, in English, Hindi, Tamil and romanised Hindi. It is still pattern matching: a cleverly worded or new kind of scam can slip past it, and fake apps are only caught through the link and credential rules. A live model does better, behind the same safety checks.
- **Guardrails are pattern-based.** The named-company list is a deny-list, not exhaustive. Treat the guardrail as a safety net behind the schema, not a substitute for it. Live output will still sometimes show a "this part was removed" sentence; that is the trade for safety, and the live smoke test reports how often it happens.
- **Live latency is unmeasured.** There is no streaming. Each model call has a timeout (`AI_TIMEOUT_MS`, default 10s per the PRD) and all attempts share a total budget (`AI_TOTAL_BUDGET_MS`) so a retry cannot overrun your host's function limit. A timeout or a truncated answer is not retried; it is recorded (`timeout` / `truncated`) and the fixture is used. Hindi and Tamil plan packs get the largest output budget (`AI_MAX_TOKENS` overrides it), but a long Indic plan pack may still need a longer timeout on a host that allows it. Check this with `npm run test:live` before a live demo.
- **Redaction.** See "Free text and redaction" under Security notes. **Names are not removed reliably**; the pages ask people not to type or paste personal details.
- **Rate limit is a demo.** It only applies when a real (paid) model is configured; mock answers are free and never limited. It is in-memory and per server instance. Without `TRUST_PROXY=1` there is no per-client bucket (so a room of people is not throttled together); a global cap (`AI_RATE_GLOBAL_PER_MIN`, default 300) always applies, and over-limit requests silently get fixtures, so size it for your audience. Production needs a shared store and a platform-verified client IP.
- **Not independently verified:** Hindi and Tamil wording (written by the build agent, needs a native-speaker review) and real-device speed (the 3-second first-load target was not measured on a phone).
- **Dependencies:** `lucide-react` is pinned to an exact version; the others use caret ranges locked by `package-lock.json`. CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build and the Playwright tests on every push.

## Defaults chosen for the open items (PRD 16)
- Insurance, health-baseline, return, inflation and expense-ratio constants: the registry in `src/config/assumptions.ts`, all `TO_VERIFY`.
- Name: `APP_NAME = "ArthClear"` in `src/config/brand.ts`; the mark (a lime tile with a burgundy parallelogram) is drawn in CSS (`.ac-logo-mark`) and in `src/app/opengraph-image.tsx`. Internal identifiers (the `fsdemo:v1:` storage namespace, the audit-digest file kind, the package name) keep their first-version names so saved data and records stay readable.
- Provider: `mock`. Demo fee: `₹X/month`. Sample portfolio / lookup data: fictional (`src/data/lookup.ts`).
- Ramesh and Anita start as cases already waiting in the adviser queue, so the console is never empty.
- Fonts are loaded from Google Fonts with a system fallback (Nirmala UI covers Tamil and Devanagari offline).
