# ArthClear — Financial guidance you can understand

**A prototype of human-accountable, AI-assisted financial guidance for India.**

> **Demo with synthetic data.** ArthClear is not a SEBI-registered Investment Adviser or Research Analyst. It does not provide regulated investment advice. No output or approval within this application constitutes regulated financial advice. The adviser shown is a synthetic demo persona, not a real or registered professional. No real money moves, no identity is verified, and no real financial account is connected.

**AI prepares. The user understands.**

[Live Demo](https://arthclear.vercel.app/) · [GitHub Repository](https://github.com/Jos-zenith/Fin-Safe)

1. Open the live demo.
2. Select **Priya**.
3. Complete the short intake.
4. Review the financial-health dashboard.
5. Select **Get my plan reviewed**.
6. Switch to the Adviser role.
7. Review, edit, complete disclosures, and approve.
8. Return to the user view and inspect the audit trail.
9. Try **Second Opinion** with a suspicious message.
10. Run the market-fall simulation and test the panic-sell guardrail.
---

## 1. The problem: financial access has grown faster than financial guidance

India's financial ecosystem has expanded rapidly. More households are aware of investment products, digital platforms have lowered access barriers, and financial information is available through apps, social media and messaging platforms.

But access to financial products does not automatically translate into informed financial decisions.

A person may have savings in one place, loans in another, insurance through an employer, investments across multiple platforms and long-term goals that are not connected to any coherent financial plan. They may know what a SIP or mutual fund is without understanding whether their overall financial position is ready for a particular decision.

At the same time, financial guidance increasingly comes through online creators, informal distributors and forwarded messages. The credibility, incentives and suitability of that information are not always clear.

### What the evidence tells us

| Evidence | Finding | Why it matters |
|---|---|---|
| SEBI Investor Survey 2025 | 63% of Indian households were aware of at least one securities-market product, while 9.5% participated in the securities market. The survey covered more than 90,000 households. | Awareness and participation are not the same as informed financial decision-making. |
| PwC–FICCI, 2026 | Identifies a shift from access-led financial inclusion towards guidance, accountability and long-term household outcomes. | The next challenge is helping people make better-informed decisions, not simply giving them more products. |
| CFA Institute, *Clicks and Credibility 2.0*, 2026 | In its sample of 48 Indian finfluencers, 6% were SEBI-registered, 33% gave explicit stock recommendations, and 37% did not adequately disclose conflicts of interest. | Financial content can influence decisions without consistently providing the transparency and accountability people need. |
| RBI financial literacy field survey, 2023 | Found that some respondents with relatively better financial knowledge still lagged in financial behaviour or attitude. | Financial education alone does not guarantee better financial behaviour. |

Sources:
- [SEBI Investor Survey 2025](https://www.sebi.gov.in/sebi_data/attachdocs/jan-2026/1768910470286.pdf)
- [PwC–FICCI: Reimagining Financial Distribution — Scale, Trust and Sustainability (2026)](https://www.pwc.in/assets/pdfs/reimagining-financial-distribution-scale-trust-and-sustainability.pdf)
- [CFA Institute: Clicks and Credibility 2.0 (2026)](https://rpc.cfainstitute.org/research/reports/2026/clicks-and-credibility-2-0)
- [RBI: Financial Literacy in India — Insights from a Field Survey (2023)](https://www.rbi.org.in/Scripts/BS_ViewBulletin.aspx?Id=21865)

These findings do not mean every non-investor needs an adviser, nor do they establish that ArthClear has solved the problem. They establish a broader gap between financial access, understandable guidance and accountable decision-making.

### Why does this problem persist?

1. **Fragmented financial lives:** Savings, expenses, liabilities, insurance and investments are often considered separately.
2. **Information without context:** People receive financial content but may not know how it applies to their own circumstances.
3. **Unclear incentives:** Product commissions, affiliate relationships and sponsorships can make it difficult to assess the neutrality of financial information.
4. **Limited guidance capacity:** Human-led financial planning can be difficult to deliver consistently and affordably at scale.
5. **Language and comprehension barriers:** Complex financial explanations are not always accessible to people who are more comfortable in regional languages.

### The opportunity

Build a system where financial information is organised, calculations are explainable, AI assists with preparation, and a human professional remains accountable for the review process.

---

## 2. What is ArthClear?

ArthClear is a prototype of a human-supervised financial guidance platform designed for the Indian market.

It brings together four connected stages:

**Understand → Plan → Review → Improve**

- **Understand:** Build a picture of a person's financial health using their income, expenses, savings, debt, insurance and goals.
- **Plan:** Prepare an evidence-backed, asset-class-level planning draft using deterministic calculations and AI-assisted explanations.
- **Review:** Allow a human adviser persona to inspect, edit, question and approve the draft within a clearly labelled demo workflow.
- **Improve:** Show the user what changed, what needs attention and which assumptions still need verification.

The product is designed around a simple principle:

> **AI should reduce the effort involved in preparing financial guidance, not remove human accountability from financial decisions.**

### Intended customer — a hypothesis

The initial customer hypothesis is a small or mid-sized financial advisory firm.

ArthClear explores whether such firms could use a structured workflow to:

- Organise client financial information.
- Identify missing or inconsistent inputs.
- Generate explainable planning drafts.
- Review and edit those drafts efficiently.
- Maintain a visible record of decisions and changes.
- Give clients understandable explanations in their preferred language.

This is an unvalidated business hypothesis. No advisory firm has yet used, reviewed or endorsed the product, and the demo's unit economics are illustrative.

---

## 3. How ArthClear works

### A. Financial-health intake

Users can start with a seeded demo persona or begin with a fresh profile.

The intake collects information about:

- Income and income stability.
- Essential and discretionary expenses.
- Emergency savings.
- Dependents.
- Existing loans and interest rates.
- Term and health insurance.
- Financial goals and time horizons.
- Existing investments, where provided.
- Risk behaviour and relevant preferences.

The intake is designed to reduce unnecessary complexity while making missing information visible.

### B. Deterministic financial analysis

The financial engine uses pure TypeScript calculations. It does not rely on an LLM to calculate financial values.

Core calculations include:

- Emergency-fund coverage.
- Savings rate.
- Debt-to-income ratio.
- High-cost debt indicators.
- Term and health insurance gaps.
- Goal feasibility under illustrative return scenarios.
- Portfolio and sector concentration.
- Fund overlap using a limited local sample dataset.
- Educational regular-versus-direct expense-ratio comparisons.

Every metric carries its value, unit, formula, inputs, assumptions and assumption references.

The interface also displays confidence and missing-data information. When the inputs are insufficient, the application can indicate that a metric cannot be calculated reliably instead of presenting a misleading number.

**Important:** Financial assumptions and thresholds are placeholders marked `TO_VERIFY`. Taxes are not modelled, and the calculations have not been independently reviewed by a qualified financial professional.

### C. AI-assisted planning

The AI layer can prepare:

- Plain-language explanations of financial findings.
- Goal-based planning drafts.
- Prioritised planning considerations.
- Questions for an adviser.
- Meeting agendas and follow-up notes.
- Educational explanations and nudges.

AI output is constrained to general education, factual observations and asset-class-level planning options.

It cannot generate personalised recommendations for individual securities, mutual fund schemes, ETFs, AMCs or crypto tokens.

### D. Human review workflow

A plan is never presented as final simply because an AI task has completed.

The adviser workflow supports:

1. Case queue and priority review.
2. Client financial snapshot.
3. Inspection of engine findings and AI-prepared drafts.
4. Item-level acceptance, editing, rejection or comments.
5. Required review checklist.
6. Approval confirmation.
7. A user-visible reviewed state and audit history.

The adviser in this prototype is a synthetic persona. Approval simulates a review process and is not regulated advice.

### E. Second Opinion

Second Opinion is an educational message-screening tool.

Users can paste a suspicious financial message and receive:

- Quoted warning signs.
- Explanations of why particular phrases may be concerning.
- Questions to ask before acting.
- Suggested verification steps.
- A risk-oriented summary.

It does not issue a definitive safe/unsafe verdict.

Its three possible outcomes are:

- **High risk: strong indicators**
- **Needs verification: not enough evidence either way**
- **No known indicators found** — this does not mean the message is safe.

The default implementation uses rules and pattern matching. It is not a substitute for verifying an intermediary through official channels or seeking professional assistance.

### F. Behavioural guardrail

The market-fall practice flow simulates a portfolio decline and introduces a cooling-off experience when the user attempts a panic-driven action.

It provides options to pause, review the plan or speak with an adviser. It does not execute trades or issue a buy, sell or hold instruction.

---

## 4. Core product principles

| Principle | Implementation |
|---|---|
| Explain before recommending | Metrics show formulas, inputs, assumptions and limitations. |
| AI assists, not decides | AI-prepared plans remain drafts until the demo review workflow is completed. |
| Human accountability | Adviser actions, edits and approvals are attributed in the audit trail. |
| No stock tips | The plan schema does not contain a free-text instrument recommendation field. |
| Numbers must be traceable | Financial figures come from deterministic engine outputs. |
| Transparency by default | Fees, conflicts, assumptions and product limitations are disclosed. |
| Language accessibility | English, Hindi and Tamil interfaces and generated content are supported, subject to translation review. |
| Deliberate friction | High-stakes or emotionally driven actions do not have a one-tap execution path. |

---

## 5. Technical architecture

### Technology stack

- **Frontend:** Next.js App Router, React, TypeScript and Tailwind CSS.
- **Backend:** Next.js server routes and server-side workflow services.
- **AI integration:** Provider abstraction supporting Anthropic, Gemini and mock mode.
- **Validation:** Zod schemas, numeric-integrity validation and output guardrails.
- **Financial engine:** Pure TypeScript functions.
- **Database:** SQLite using Node's built-in `node:sqlite` for the demo workflow.
- **Testing:** Vitest and Playwright.
- **Charts and icons:** Recharts and lucide-react.
- **Deployment:** Vercel-compatible frontend; server-side SQLite deployment requires a persistent, single-process environment.

### Architecture overview

```text
                 USER / ADVISER
                       |
                       v
                NEXT.JS APPLICATION
                       |
          +------------+------------+
          |                         |
          v                         v
    FINANCIAL INTAKE           ADVISER CONSOLE
          |                         |
          v                         v
    USER PROFILE               CASE WORKFLOW
          |
          v
   DETERMINISTIC ENGINE
          |
          v
    ENGINE RESULTS
          |
          v
       AI LAYER
          |
     +----+------------------+
     |                       |
     v                       v
  ZOD SCHEMA          NUMERIC VALIDATOR
                             |
                             v
                       PLACEHOLDER
                       SUBSTITUTION
                             |
                             v
                         GUARDRAILS
                             |
                             v
                      VALIDATED DRAFT
                             |
                             v
                      HUMAN REVIEW
                             |
                             v
                   REVIEWED (DEMO)
                             |
                             v
                   HASH-CHAINED AUDIT
```

### Main code areas

```text
src/
├── app/                 Next.js pages and API routes
├── components/          Shared UI and design-system components
├── config/              Brand, assumptions, economics and workflow settings
├── data/                Synthetic personas, samples and source registry
├── i18n/                English, Hindi and Tamil translations
├── lib/
│   ├── ai/              Providers, prompts, schemas, validators and fixtures
│   ├── engine/          Deterministic financial calculations
│   ├── scam/            Second Opinion rules and scoring
│   ├── cases.ts         Case presentation helpers
│   ├── redact.ts        Free-text redaction
│   └── storage.ts       Browser demo-data retention
└── server/
    ├── api.ts           Server API routing
    ├── auth.ts          Demo sessions and role checks
    ├── workflow.ts      Case lifecycle and approval rules
    ├── retention.ts     Server-side data retention
    └── store/           CaseStore interface and SQLite implementation
```

---

## 6. Numeric integrity: AI cannot invent financial figures

A key engineering decision is separating financial computation from language generation.

The LLM is not trusted to calculate or invent financial numbers.

Instead:

1. The deterministic engine calculates financial metrics.
2. AI receives the structure and references needed to explain those metrics.
3. AI-generated text uses placeholders such as `{{ef.months}}`.
4. A server-side renderer substitutes the actual engine values.
5. The numeric validator checks the text before and after substitution.
6. Guardrails inspect the final output before it is displayed.
7. Invalid output is retried once and then replaced with a validated mock fixture.

The validator checks:

- Integers, decimals, percentages, ratios and currency amounts.
- Indian lakh/crore number grouping.
- Devanagari and Tamil digits.
- English, Hindi and Tamil number words.
- Unresolved placeholders.
- Numbers that do not match deterministic engine outputs.

The system records rejected output through a `system` audit entry without logging the user's financial profile.

This approach does not prove that every explanation is financially correct. It does establish a controlled boundary around the source of displayed financial figures.

---

## 7. AI modes and current implementation status

**The default application mode is mock.**

No live model is called when the application runs without a configured provider key and model ID.

| Component | Current implementation |
|---|---|
| Financial calculations | Deterministic TypeScript implementation; assumptions remain unverified placeholders. |
| AI explanations and planning | Pre-written fixtures in mock mode; live provider integration available when configured. |
| Numeric validation | Implemented as part of the AI output pipeline. |
| Output guardrails | Schema and pattern-based validation. |
| Adviser workflow | Server-side demo state machine with role checks. |
| Audit | Append-only, hash-chained audit records. |
| Second Opinion | Rules-based screening in mock mode. |
| Tamil and Hindi | UI and fixtures exist; native-speaker review remains pending. |
| Adviser identity | Synthetic demo persona only. |
| Financial integrations | Not implemented. |

### Live-model smoke test

The repository documents one live-provider smoke run involving 18 requests:

- 17 outputs passed the validation checks.
- 1 output fell back to a mock template.

This is evidence that the live integration path has been exercised. It is **not** a statistically meaningful assessment of financial accuracy, response quality, language naturalness or production reliability.

To exercise the live path yourself, configure the required environment variables and run:

```bash
npm run smoke:live
```

See `docs/live-smoke.md` for the recorded run and its limitations.

---

## 8. Security, privacy and data retention

ArthClear treats synthetic financial data as sensitive even though the demo does not use real customer financial records.

### Implemented controls

- API keys and session secrets are accessed server-side.
- Signed, httpOnly and SameSite session cookies.
- Server-side role and case-access checks.
- Request-size and input validation.
- Content Security Policy and other security headers.
- Redaction of several sensitive patterns in free-text inputs.
- Logs avoid storing financial profile content and pasted message text.
- API responses are validated before use.
- Demo data has explicit clearing and retention controls.
- Audit events are hash-chained to make changes detectable.

### Demo retention policy

- Browser data defaults to `sessionStorage` and is cleared when the tab closes.
- Optional device-level remembering is off by default and expires after 24 hours.
- Idle browser sessions clear demo data after 30 minutes.
- Server-side demo cases and audit data are purged after 24 hours of inactivity.
- Users can delete their demo data.
- Resetting the demo restores seeded data.
- Raw Second Opinion text is not stored as ordinary browser demo data; the optional missed-scam reporting flow stores a redacted message for a maximum of 24 hours.

### Important security limitations

This is not a completed security audit.

- Demo sign-in does not establish a real person's identity.
- Names are not reliably removed from free text.
- Rate limiting is in-memory and per server instance.
- SQLite is intended for a single-process demo, not a multi-instance production deployment.
- Hash-chained audit records are tamper-evident, not tamper-proof.
- Audit digest export is not an independent immutable anchor.
- Penetration testing, a formal threat model, WAF/DDoS protection, dependency-provenance review and secrets rotation have not been completed.

A production deployment needs a managed database, real authentication, shared rate limiting, independent audit anchoring, a security assessment and a reviewed data-retention framework.

---

## 9. Compliance and responsible financial guidance

ArthClear is designed to demonstrate a safer architecture for AI-assisted financial guidance. It is not itself a regulated financial-advice service.

The prototype deliberately avoids:

- Personalised stock, ETF or mutual-fund scheme recommendations.
- Buy, sell or hold instructions.
- Price targets and guaranteed-return claims.
- Real brokerage or investment execution.
- Real KYC, Aadhaar handling, bank linking or payment processing.
- Claims of SEBI registration or regulatory approval.

The plan-generation schema restricts outputs to asset-class-level planning options. AI-generated plans remain drafts until the demo review process is completed.

The adviser checklist includes risk-profile confirmation, suitability considerations, disclosures, fee transparency, client language and explicit acknowledgement that the workflow is a demo.

**A real deployment would require a registered advisory entity or appropriate regulated partner, legal and compliance review, suitability processes, fee and conflict disclosures, record-keeping controls, AI governance and a DPDP Act review.**

The demo approval mechanism is not a substitute for those requirements.

---

## 10. Assumptions and limitations

The following are deliberately disclosed rather than hidden.

| Area | Current limitation |
|---|---|
| Financial assumptions | Return, inflation, insurance and expense-ratio constants are placeholders marked `TO_VERIFY`. |
| Tax | Tax calculations and tax-specific suitability are not modelled. |
| Insurance | Hospital costs, room-rent limits and policy exclusions are not modelled. |
| Portfolio analysis | Look-through uses a small fictional sample dataset. |
| AI quality | Mock mode uses templates; one live smoke run is not a quality evaluation. |
| Scam screening | Pattern matching can miss novel, cleverly worded or context-dependent scams. |
| Language | Tamil and Hindi require native-speaker review. |
| Registry | Adviser registry data is fictional sample data, not the actual SEBI registry. |
| Authentication | Demo personas do not prove identity. |
| Storage | SQLite is a single-process demo implementation. |
| Customer demand | No advisory firm has validated the proposed customer hypothesis. |
| Unit economics | Metrics and pricing assumptions are illustrative, not measured business results. |
| Accessibility | Accessibility features exist, but a complete independent WCAG 2.2 AA audit has not been completed. |

### Second Opinion evaluation caveat

The scam-screening evaluation uses a small, author-created synthetic corpus. Tuned, held-out and adversarial results are reported separately in `docs/scam-eval.md`.

These results should not be represented as real-world scam-detection accuracy. OCR, screenshot analysis, voice-call reporting and live reputation lookups are not implemented.

---

## 11. Setup and local development

### Requirements

- Node.js 22.13 or later.
- npm.
- Git.

### Installation

```bash
git clone https://github.com/Jos-zenith/Fin-Safe.git
cd Fin-Safe
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The application runs in mock mode by default. No AI API key is required to explore the demo.

### Environment variables

Create a `.env.local` file if you want to configure a live provider.

```env
AI_PROVIDER=mock
AI_MODEL=

ANTHROPIC_API_KEY=
GEMINI_API_KEY=

SESSION_SECRET=
TRUST_PROXY=

# Optional provider and runtime configuration
ANTHROPIC_BASE_URL=
GEMINI_BASE_URL=
AI_TIMEOUT_MS=
AI_TOTAL_BUDGET_MS=
AI_MAX_TOKENS=
AI_RATE_PER_MIN=
AI_RATE_GLOBAL_PER_MIN=
```

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | `mock`, `anthropic` or `gemini`. |
| `AI_MODEL` | Model identifier supplied through the environment. |
| `ANTHROPIC_API_KEY` | Server-side key for the Anthropic provider. |
| `GEMINI_API_KEY` | Server-side key for the Gemini provider. |
| `SESSION_SECRET` | Required in production for signing demo session cookies. |
| `TRUST_PROXY` | Set to `1` only behind a trusted proxy that overwrites `x-forwarded-for`. |
| `AI_TIMEOUT_MS` | Per-call AI timeout. |
| `AI_TOTAL_BUDGET_MS` | Total budget for attempts and retries. |
| `AI_MAX_TOKENS` | Optional output-token configuration. |
| `AI_RATE_PER_MIN` | Per-client AI request limit when supported by the deployment. |
| `AI_RATE_GLOBAL_PER_MIN` | Global AI request limit. |

A real provider is used only when its API key and `AI_MODEL` are configured. If the model identifier is missing, the application safely falls back to mock mode.

**Never expose provider keys through client-side environment variables.**

---

## 12. Testing and verification

Run the following commands before presenting or modifying the project:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For browser-level verification:

```bash
npx playwright install chromium
npm run test:e2e
```

For live-provider verification:

```bash
npm run smoke:live
```

For the synthetic scam corpus:

```bash
npm run eval:scam
```

### What the test suite is intended to cover

- Deterministic financial-engine calculations.
- Numeric-integrity validation.
- Rejection of invented financial figures.
- AI schema and output guardrails.
- Mock fixture validation.
- English, Hindi and Tamil text handling.
- Case lifecycle and adviser permissions.
- Audit-chain integrity.
- Browser data retention and clearing.
- Responsive layouts and horizontal-overflow checks.
- End-to-end customer and adviser workflows.

The repository's CI workflow runs linting, type checking, unit tests, builds and Playwright tests. Run the commands locally to verify the current checkout; this README does not claim a fresh test run for every environment.

---

## 13. Product acceptance criteria

The prototype is intended to satisfy the following end-to-end requirements:

1. A new visitor can complete the Priya demo journey from landing to `REVIEWED (DEMO)` within the target three-minute flow.
2. Switching to Tamil or Hindi changes the relevant interface and AI-generated sections.
3. The adviser cannot approve without completing the required checklist and confirmation.
4. The synthetic-adviser disclaimer is visible wherever the demo review is represented.
5. Model identifiers are configured through environment variables rather than hardcoded into application code.
6. Numeric validation rejects invented values and falls back to validated fixtures.
7. The plan schema cannot carry personalised instrument recommendations; stock-tip requests are refused and logged.
8. Second Opinion identifies the expected warning samples without classifying legitimate educational examples as high risk.
9. The audit timeline exposes the difference between the AI draft and the demo-reviewed version.
10. Browser data retention, idle clearing and explicit deletion work as documented.
11. Resetting the demo restores the seed data.
12. Build, lint and unit-test commands pass.
13. The README documents setup, environment variables, mock mode, architecture, numeric integrity, retention and compliance boundaries.

These are acceptance requirements, not a claim that every item has been independently revalidated on every deployment. Refer to the automated tests and project documentation for the current evidence.

---

## 14. Roadmap

### Near-term validation

- Conduct structured interviews with registered investment advisers and small advisory firms.
- Test whether the adviser workflow reduces preparation and review effort.
- Have an independent financial professional review the calculation assumptions.
- Validate Tamil and Hindi explanations with native speakers.
- Evaluate Second Opinion using independently collected, consented and appropriately anonymised examples.
- Measure completion time, user comprehension, adviser review time and correction rates.

### Production-readiness work

- Integrate a managed database and production-grade authentication.
- Establish a regulated advisory partnership or operating entity.
- Complete suitability, compliance and record-retention design.
- Add independent security testing and audit anchoring.
- Review data processing, consent and DPDP Act obligations.
- Establish real pilot economics and service-level expectations.

### Longer-term direction

Move from a financial-health prototype towards a dependable workflow that helps regulated professionals deliver understandable, evidence-backed and accountable financial guidance at scale.

---

## 15. The central idea

India does not need another application that simply produces more financial content or more investment suggestions.

It needs better ways to turn financial information into decisions people can understand, question and review.

ArthClear explores one possible approach:

**Deterministic calculations for financial facts. AI for preparation and explanation. Human review for accountability. Clear records for trust.**

*Built as a demonstration of responsible, human-accountable AI-assisted financial guidance.*
