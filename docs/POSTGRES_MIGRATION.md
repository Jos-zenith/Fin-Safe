# Moving the case store from SQLite to Postgres

> **Not implemented.** This is a map of the work, not a migration. The demo keeps `node:sqlite` (one local file, one process)
> because it needs no install. That is the wrong store for a deployment with more than one process or with a serverless
> host: each instance would see its own database, or none. The server prints a warning at start-up when its environment looks
> like either (`hostWarnings` in `src/server/config.ts`).

## What stays the same

The workflow never talks to SQLite: it talks to the `CaseStore` interface in `src/server/store/types.ts`, and every method
is already `async`. A Postgres store is a second implementation of that interface plus one line in `src/server/store/index.ts`.
Nothing in `src/server/workflow.ts`, `api.ts` or the UI should need to change.

## What the interface promises, and what Postgres must keep

1. **One transaction per change.** `createCase` and `commit` write the case, its audit entries, notifications and metric events together.
2. **Optimistic concurrency.** `commit` applies only if the case is still at `expectedVersion`.
3. **Append-only audit.** No update or delete path exists; the SQLite triggers enforce it at the database too.
4. **Hash chain per `chainId`**, with a contiguous `seq`, so two writers must never produce the same `seq`.

## Method by method

| Method | Work needed in Postgres |
|---|---|
| `getUser`, `findUserByPersona`, `listUsers` | Plain `select`s. Keep the partial unique index on `persona` where `is_seed`. |
| `saveUser` | `insert ... on conflict (id) do update`. |
| `touchUser` | `update users set last_active_at`. Consider batching: it runs on every request. |
| `createSession`, `getSession`, `deleteSession`, `deleteSessionsOf` | `sessions` table; add an index on `expires_at`, and a job that deletes expired rows. |
| `getProfile`, `putProfile` | Store as `jsonb`; `insert ... on conflict (user_id) do update`. Decide which fields deserve real columns. |
| `getCase`, `getCaseByUser`, `listCases` | `select`s. `listCases` needs pagination and a status filter before the queue grows. |
| `createCase` | One transaction: `insert` the case, plan version, audit rows, notifications, metrics. Initial `version = 1`. |
| `commit` | `update cases set ..., version = version + 1 where id = $1 and version = $2 returning *`; zero rows means `"conflict"`. Same transaction as the audit, notification and metric inserts. |
| `listPlanVersions` | `select ... order by version`. |
| `appendAudit` | Must pick the next `seq` and `prevHash` without a race: lock the chain (an advisory lock keyed by `chainId`, or `select ... for update` on the chain head row) inside the transaction. |
| `listAudit`, `verifyChain` | `select ... order by seq`. Verification stays in application code (`audit.ts`). For long chains, verify in pages. |
| `listChainHeads` | `select distinct on (chain_id) chain_id, seq, hash from audit order by chain_id, seq desc`. |
| `addNotifications`, `listNotifications`, `markRead`, `unreadCount` | `notifications` table; partial index on unread rows per user. Polling every few seconds becomes `LISTEN/NOTIFY` or server-sent events when there are many users. |
| `addMetrics`, `listMetrics` | `metrics` table with `props` as `jsonb`; index on `(kind, at)`. Aggregate in SQL once the volume is real. |
| `listActions`, `upsertAction` | `insert ... on conflict (user_id, finding_id) do update`. |
| `listAssumptionReviews`, `upsertAssumptionReview` | Tiny table; `insert ... on conflict do update`. |
| `purgeUserData`, `purgeInactiveSince`, `deleteUser` | The SQLite version lifts the audit delete trigger with a one-row `purge_guard` flag. In Postgres do not give the application role `delete` on `audit` at all: run retention as a separate, audited role or job. See the retention notes in `docs/PRODUCTION_GAP.md`: a real record-retention schedule may forbid deleting what the demo deletes. |
| `bumpCounter`, `getCounter` | `insert ... on conflict (name) do update set value = counters.value + $2 returning value`. |
| `close` | Release the pool. |

## Beyond the methods

- **Types.** Timestamps are ISO text in SQLite; use `timestamptz`. JSON columns become `jsonb`. Booleans are `integer 0/1` today.
- **Schema changes.** `migrate()` in `sqlite.ts` adds columns with `alter table`; use a migration tool with versioned files.
- **Connections.** A pool, timeouts, and a read replica for the metrics page if it gets heavy.
- **Encryption and backups.** At rest, in transit, point-in-time recovery, and a tested restore.
- **Background work.** Plan preparation currently runs in the web process after the reply; with several instances it needs a queue (see `docs/PRODUCTION_GAP.md`).
- **Digests.** `npm run audit:digest` writes a local file. Production must anchor the digest somewhere nobody who runs the database can change it.
- **Tests.** Run the whole store contract (`tests/workflow-api.test.ts`, the audit and retention tests) against a Postgres service in CI, not only against `:memory:` SQLite.
