# Deploying the demo (read before you put it on a public URL)

This app keeps its workflow state (users, cases, audit chains, notifications) in one **SQLite file on local disk**, and runs plan preparation as a background promise inside the Node process. That is correct for a single long-lived server and **wrong for serverless hosting** such as Vercel.

## Why not Vercel (as the code stands)
| Behaviour | Effect on serverless |
|---|---|
| The database path is `DATA_DIR`, defaulting to `./.data` under the working directory | The deployment folder is read-only; creating the folder fails and every `/api/v1` call errors |
| Even with `DATA_DIR=/tmp` | Each instance gets its own empty database. A customer's case may never reach the adviser's queue; claims, notifications and audit chains diverge between instances |
| Plan preparation continues after the HTTP reply | The platform can freeze or stop the function before it finishes |
| Rate limiter and AI counters live in memory | Each instance has its own counters, so a limit cannot protect a paid model key |

The two-browser customer and adviser flow, the main differentiator, is the part this breaks. `src/server/config.ts` already prints a warning when it detects a serverless host.

## Two reliable options
1. **One long-lived Node server with a persistent disk** (Render, Railway, Fly.io, a VPS). Works with the code as it is. Quickest path.
2. **Managed Postgres** (Neon, Supabase) plus a queue or durable background job. This is the real fix; the mapping of every store method is in `docs/POSTGRES_MIGRATION.md`. Not built.

## Option 1: single-server checklist
- Node 22.13 or newer (the store uses the built-in `node:sqlite`, which prints an "experimental" warning).
- Build and start: `npm ci`, `npm run build`, `npm start`.
- Environment variables:
  - `SESSION_SECRET`: at least 16 random characters. **Production refuses to start without it.**
  - `DATA_DIR`: a folder on a **persistent disk**. Without a disk, a redeploy wipes the database.
  - `TRUST_PROXY`: set it only if the host's proxy sets a trustworthy client-address header (see the README on the rate limiter).
  - `AI_PROVIDER`, `AI_MODEL`, and the matching key (see the spend warning below).
- Run **exactly one instance.** Two instances share nothing.
- After deploying, test: open Priya in one browser, the adviser in another, request a review, claim, approve, and check the customer view updates and `Audit chain verified` shows. Check the host logs for file-system errors, and Settings for the AI mode.

## Spend warning: do not expose a live key on a public URL
The demo personas are shared accounts anyone with the URL can enter, and the rate limit is per process. If `AI_PROVIDER` is `gemini` or `anthropic`, anyone who finds the link can spend your quota.
- For a public link, leave `AI_PROVIDER=mock` (the app is fully usable and labels its text as template-made).
- If you must show live output publicly, use a key with a hard spending cap and a short expiry, rotate it afterwards, and keep the link private.
- `AI_MODEL` must be a real model id your key can call. A product name such as "Gemini" fails every request.

## Data on a public server
The data is synthetic and the app deletes demo data after a day, but the database still holds whatever people type. Say so on the page you share, and do not invite real personal or financial details.
