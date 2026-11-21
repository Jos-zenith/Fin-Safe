// Runs once when the server starts. Production REFUSES to start without SESSION_SECRET: the process exits with a
// non-zero status and says why. Otherwise the demo data is seeded and the hourly 24-hour purge begins.
export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertStartupConfig } = await import("@/server/config");
  try {
    assertStartupConfig();
  } catch (e) {
    console.error(`\n[auth] ${e instanceof Error ? e.message : "invalid configuration"}\n`);
    // bracket access: this file is also analysed for the Edge runtime, which has no process.exit (it never runs there)
    (process as unknown as { exit(code: number): never })["exit"](1);
  }
  // The embedded SQLite store is for local and single-process use. Say so loudly where it is the wrong choice.
  const { hostWarnings } = await import("@/server/config");
  for (const why of hostWarnings()) console.warn(`\n[store] WARNING: ${why}. The demo store is a single local SQLite file; see docs/POSTGRES_MIGRATION.md.\n`);
  const { getStore } = await import("@/server/store");
  const { ensureSeeded } = await import("@/server/seed");
  const { purgeStale, startRetentionTimer } = await import("@/server/retention");
  const store = getStore();
  await ensureSeeded(store);
  await purgeStale(store);
  startRetentionTimer(getStore);
}
