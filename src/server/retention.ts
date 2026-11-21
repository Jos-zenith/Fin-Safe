// Retention: demo data older than 24 hours without activity is removed on server start and then hourly.
// Seeded accounts are re-seeded (so the demo always has its waiting cases); anonymous visitors are deleted outright.
import { RETENTION_HOURS } from "@/config/workflow";
import { exportDailyDigest } from "./auditDigest";
import { clock, nowIso } from "./config";
import { resetAccount } from "./seed";
import type { CaseStore, PurgeReport } from "./store/types";

export async function purgeStale(store: CaseStore, nowMs = clock.now()): Promise<{ purgedUsers: number; report: PurgeReport }> {
  const cutoff = new Date(nowMs - RETENTION_HOURS * 3_600_000).toISOString();
  const { purgedUserIds, report } = await store.purgeInactiveSince(cutoff);
  for (const id of purgedUserIds) {
    const user = await store.getUser(id);
    if (!user) continue;
    if (user.isSeed) await resetAccount(store, user);
    else {
      await store.deleteUser(id);
      await store.bumpCounter("demo_data_deleted");
    }
  }
  return { purgedUsers: purgedUserIds.length, report };
}

const g = globalThis as unknown as { __finSafeRetention?: ReturnType<typeof setInterval> };

/** Runs the purge every hour. Safe to call twice. The timer never keeps the process alive on its own. */
export function startRetentionTimer(store: () => CaseStore, everyMs = 3_600_000): void {
  if (g.__finSafeRetention) return;
  const t = setInterval(() => {
    // the digest is taken BEFORE the purge removes anything, so it covers what the purge is about to delete
    exportDailyDigest(store(), nowIso())
      .catch(() => console.error(JSON.stringify({ digest: { status: "error" } })))
      .then(() => purgeStale(store()))
      .catch(() => console.error(JSON.stringify({ retention: { status: "error" } })));
  }, everyMs);
  t.unref?.();
  g.__finSafeRetention = t;
}
