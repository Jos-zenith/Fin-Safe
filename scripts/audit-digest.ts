// `npm run audit:digest` writes today's audit-chain digest next to the database (once per day, never overwriting an
// earlier file) and checks the latest export against the live chains. A local file is an export, not an anchor:
// copy it somewhere nobody who runs the database can change it (docs/PRODUCTION_GAP.md).
import path from "node:path";
import { checkDigest, exportDailyDigest, latestExport } from "../src/server/auditDigest";
import { dataDir } from "../src/server/config";
import { SqliteCaseStore } from "../src/server/store/sqlite";

async function main() {
  const file = path.join(dataDir(), "demo.sqlite");
  const store = new SqliteCaseStore(file);
  const before = latestExport();
  const r = await exportDailyDigest(store, new Date().toISOString());
  console.log(`${r.created ? "wrote" : "already exists (not overwritten)"}: ${path.join("audit-digests", r.file)}`);
  console.log(`digest ${r.doc.digest}  (${r.doc.chains} chains, ${r.doc.entries} entries, ${r.doc.date})`);
  const last = before ?? latestExport();
  if (last) {
    const c = await checkDigest(store, last.doc);
    console.log(`latest export ${last.file}: ${c.ok ? "matches the live chains" : `MISMATCH ${c.mismatched.join(", ") || "-"}; missing (purged?) ${c.missing.join(", ") || "-"}`}`);
    if (c.mismatched.length) process.exitCode = 3;
  }
  await store.close();
}
void main();
