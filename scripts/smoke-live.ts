// `npm run smoke:live`: runs every AI task for Priya in English, Hindi and Tamil against the REAL provider
// configured in the environment, and writes docs/live-smoke.md.
//
//   PowerShell:  $env:AI_PROVIDER="anthropic"; $env:AI_MODEL="<id>"; $env:ANTHROPIC_API_KEY="<key>"; npm run smoke:live
//   bash:        AI_PROVIDER=gemini AI_MODEL=<id> GEMINI_API_KEY=<key> npm run smoke:live
//   or put the same variables in .env.local.
//
// Without a provider, key and model it prints that the live path was not exercised, exits non-zero, and writes
// NOTHING: there is no way to produce a passing report without a real run. It never prints keys or profile data.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { makeLLM, resolveProvider } from "../src/lib/ai/providers";
import { NOT_EXERCISED, passed, renderSmokeDoc, runSmoke } from "../src/lib/ai/smoke";

const root = path.resolve(__dirname, "..");
for (const f of [".env.local", ".env"]) {
  try {
    if (existsSync(path.join(root, f))) process.loadEnvFile(path.join(root, f));
  } catch {
    /* an unreadable env file is treated as absent */
  }
}

async function main() {
  const cfg = resolveProvider(process.env);
  const llm = makeLLM(cfg);
  if (!llm) {
    console.error(NOT_EXERCISED);
    if (cfg.warning) console.error(`(${cfg.warning})`);
    process.exit(2);
  }
  console.log(`Running the live smoke against provider "${cfg.provider}". This makes real, paid model calls.`);
  const rows = await runSmoke(llm, {
    onRow: (r) => console.log(`${r.task.padEnd(16)} ${r.lang}  ${r.source.padEnd(8)} ${String(r.latencyMs).padStart(6)} ms  ${r.kinds.join(",") || "-"}`),
  });
  const out = path.join(root, "docs/live-smoke.md");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderSmokeDoc(rows, { provider: cfg.provider, at: new Date().toISOString() }));
  const ok = passed(rows);
  console.log(`\n${ok ? "PASS" : "FAIL"}: wrote ${out}`);
  process.exit(ok ? 0 : 1);
}

main().catch(() => {
  // never print the error object: it can echo request details
  console.error("smoke:live failed before finishing. Nothing was written.");
  process.exit(1);
});
