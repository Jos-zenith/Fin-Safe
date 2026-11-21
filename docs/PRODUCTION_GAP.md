# What stands between this demo and a real service

This is a list of gaps, written by the people who built a **demo**. It is not legal advice and it reaches **no legal conclusions**. Where a regulatory question appears, it is something to put in front of qualified counsel, not an answer.

Nothing here has been built, reviewed or approved by a regulator, a lawyer, a security auditor or a licensed adviser. The adviser in the demo is a synthetic persona with no registration. No money moves, no real identity is checked, and the sample registry is sample data, not the real one.

## 1. How the demo's server side works today (and why it is not production)

| Area | What the demo does | What a real service needs |
|---|---|---|
| **Store** | `CaseStore` interface (`src/server/store/types.ts`) with one implementation on **SQLite** via Node's built-in `node:sqlite` (`src/server/store/sqlite.ts`). Chosen because it needs no install and no server. | A managed Postgres (or similar) with backups, point-in-time recovery, replication, encryption at rest and access controls. The interface is async so the swap does not touch the workflow code. `node:sqlite` is still marked experimental by Node. |
| **Authentication** | "Continue as a persona." No passwords. A signed (HMAC), httpOnly, SameSite=Lax session cookie, keyed by `SESSION_SECRET`. Production refuses to start without it. **Demo authentication. Not secure authentication.** | Real identity: verified sign-up, MFA, account recovery, session management, device and fraud signals, an identity provider or an in-house IAM. Nothing here proves who anyone is. |
| **Shared demo accounts** | Priya, Ramesh, Anita and the adviser are single seeded accounts. Everyone who continues as the same persona shares that account's data until it is reset or purged. "Start fresh" creates a private anonymous account. | One account per real person, with real sign-up. |
| **Authorization** | Checked on the server for every route (customer sees only their own case; only an adviser lists the queue, claims, edits and approves). Tested. | Fine-grained roles, an adviser-to-client assignment model, break-glass access with review, and separation of duties. |
| **Workflow** | State machine enforced on the server, claim exclusivity, SLA fields, polling notifications. | Durable queues, real SLAs and escalation paths, a staffing model, and an outage plan. Notifications poll every few seconds; real push, email or WhatsApp delivery is not built. |
| **Audit** | Per-case append-only log with a SHA-256 hash chain, verified on demand. Database triggers refuse updates and deletes. | The chain makes tampering **detectable**, not impossible: someone with full database access could rewrite the whole chain and recompute every hash (a test does exactly that and shows verification alone passes). The demo can export a **daily digest** of every chain's head (`npm run audit:digest`, `GET /api/v1/audit/digest`) and check a stored digest against the live chains, which does catch that rewrite. **A file next to the database is an export, not an anchor.** A real system must keep each day's digest in independent, immutable storage that nobody who runs the database can change (write-once object storage, a timestamping or notary service, another party), monitor the check, and define retention, legal hold and access review. No external service is built or named here. |
| **Retention** | Demo data older than 24 hours without activity is purged at start-up and hourly. "Delete my demo data" removes everything an account holds and keeps one anonymous counter. | A written retention schedule driven by the record-keeping obligations that apply, not a 24-hour timer. Real obligations may require **keeping** records for years, which may conflict with a customer's request to delete; **how retention periods and deletion-request handling fit together has to be reconciled with the applicable regulation by qualified counsel, and nothing here asserts a legal conclusion.** The demo makes its own policy visible: the purge window and its demo-only status are shown in Settings, in the consent text and in the README. |
| **Background generation** | After the reply, the findings and then the plan are prepared by a promise in the same web process, with their timings recorded; the case is held out of the adviser queue until the plan is ready, and a failure or a fallback to pre-written text offers a retry. A host that freezes or kills the process after it replies (many serverless platforms) would drop the work. | A durable job queue and a separate worker, with retries, time limits per section, dead-letter handling and an alert when preparation keeps failing. |
| **Metrics** | Server-side events with no profile content and no message text. | A data-protection assessment of what is measured, who sees it, and for how long. |
| **Rate limiting** | In-memory, per process. | A shared store and a platform-verified client address. |
| **Secrets and config** | Environment variables. | A secrets manager, rotation, and separate environments. |
| **Hosting** | Anywhere Node 22.13+ runs. A single process holds the database file, so it cannot be scaled out as is. The server warns at start-up when the environment looks serverless or multi-instance, and `docs/POSTGRES_MIGRATION.md` maps the work for a managed database (not implemented). | Stateless application servers in front of a managed database. |

## 2. Items to put in front of qualified counsel

These are questions, not findings. The demo makes no claim about any of them.

1. **Who is the regulated entity?** Whether any real offering would need a registered investment adviser, a distributor, a partner entity, or a combination, and what that entity must disclose on every screen. A registration number must never be shown for a synthetic adviser, and the demo shows none.
2. **Suitability and risk profiling.** What a real suitability and risk-profiling process must collect, how it is recorded, and when it must be refreshed. The demo has a six-question questionnaire and a computed label that an adviser must confirm before approval (`docs/SUITABILITY_GATE.md`); it is a conversation starter, not a suitability assessment, and its scoring has not been reviewed by anyone qualified.
3. **Client agreements and consent.** The agreement a real client signs before receiving advice, fee disclosures, conflict-of-interest disclosures, and how consent is captured. The demo records a **demo consent** (a version, a time, the disclosures shown) before a case can be created, and says in the same place that it is **not** an e-signature and binds nobody. It is not a client agreement.
4. **Fees and conflicts.** How the firm is paid, how conflicts are disclosed in the product, and how that interacts with any distribution lane. The demo has an "How we earn" explainer written for a hypothetical firm.
5. **Record retention.** How long advice records, communications and audit logs must be kept, in what form, and who can inspect them.
6. **AI governance.** Who is accountable for AI-prepared drafts, how outputs are tested and monitored, how models are changed, what is logged, and what a customer is told. The numeric contract (the model never writes a number) and the rejection counters are engineering controls, not governance.
7. **Data protection.** The DPDP Act and related rules as they apply to collecting, storing, transferring and deleting personal financial data; notices and consent; children's data; cross-border processing by a model provider; breach handling. The demo uses synthetic data and sends a model provider no names, cities or raw figures, but a real service would hold real data.
8. **Insurance-related content.** Whether any insurance explanation or product-adjacent text touches IRDAI considerations.
9. **Marketing and claims.** What the product may say about itself, about accuracy, and about "reviewed" content.
10. **Language.** Whether translated financial text needs qualified review before use. The Hindi and Tamil text in the demo has **not** been reviewed by a native speaker (see `docs/translation-review.md`).

## 3. Engineering gaps

- **Security review.** No penetration test, threat model, dependency audit sign-off or secure-development process has been done by a third party. `npm audit` output is reported in the README only (0 vulnerabilities after the test-runner upgrade, 3 before).
- **Redaction.** Numbers, emails, UPI handles, PAN, IFSC codes and typed codes are masked before free text reaches a model; **names are not removed reliably**. A real service needs a reviewed approach to personal data in prompts (or none at all), and a provider agreement about retention and training.
- **Backups and disaster recovery.** None.
- **Observability.** Logs hold task, status, latency and reasons only. There is no alerting, tracing, or on-call.
- **Accessibility.** Tested for contrast and keyboard use on key screens, not audited by an accessibility specialist or with real assistive-technology users.
- **Real model quality.** `npm run smoke:live` was run once (18 requests, one provider; `docs/live-smoke.md`). That shows the path runs, not that the output is good. Quality, rejection rates over a larger sample, and Hindi and Tamil wording are still unmeasured. See the README "AI status".
- **Scam check.** Rule-based, measured against a small synthetic corpus the authors wrote (`docs/scam-eval.md`). It has not been evaluated on real messages and will miss scams that avoid its rules.
- **Assumptions.** Every financial assumption is a placeholder marked "demo placeholder, TO_VERIFY" (`docs/ASSUMPTIONS.md`). Replacing them needs a qualified professional.
- **Tax.** Not modelled. Every goal result says so.
- **Account aggregation, execution and payments.** Not built and out of scope.

## 4. Things this demo deliberately does not do

Real adviser network and SLAs; registration or licensing; any claim of regulatory approval; payments or money movement; account aggregation (for example a CAS import); investment execution; native mobile apps; a production security audit; real customer research. Each of these is a project in its own right.
