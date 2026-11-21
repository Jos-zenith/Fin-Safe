// `npm run audit:tamper` shows, on a THROWAWAY database in the OS temp folder, what the audit chain does and does not protect.
// It never touches the demo database.
//
//   1. an honest chain verifies
//   2. someone with database access edits one entry          -> the chain check FAILS (tampering detected)
//   3. the same person recomputes every hash after the edit  -> the chain check PASSES again (the chain alone is not enough)
//   4. the daily digest taken BEFORE the edit is compared     -> it MISMATCHES (an outside copy catches the rewrite)
//
// Step 3 is the honest limit: a hash chain proves tampering only while the whole chain is not rewritten. The fix is to keep
// the digest somewhere the database operator cannot change (docs/PRODUCTION_GAP.md). This script proves the mechanism; it is
// not an anchor.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkDigest, currentDigest } from "../src/server/auditDigest";
import { GENESIS, hashEntry } from "../src/server/store/audit";
import { SqliteCaseStore } from "../src/server/store/sqlite";
import type { AuditRec } from "../src/server/store/types";

const ok = (b: boolean) => (b ? "PASS" : "FAIL");

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "fin-safe-tamper-"));
  const store = new SqliteCaseStore(path.join(dir, "throwaway.sqlite"));
  const chainId = "demo-case";
  try {
    const steps: [string, string, string][] = [
      ["customer", "case_created", "draft plan requested"],
      ["ai", "draft_generated", "draft v1"],
      ["adviser", "item_edited", "emergency item rationale softened"],
      ["adviser", "approved_demo", "approved in the demo workflow"],
    ];
    let n = 0;
    for (const [role, action, after] of steps) {
      await store.appendAudit({
        chainId,
        caseId: chainId,
        actorId: `${role}-1`,
        actorRole: role as "customer" | "adviser" | "ai",
        actor: role === "customer" ? "user" : (role as "ai" | "adviser"),
        requestId: `req-${++n}`,
        action,
        after,
        ts: new Date(Date.UTC(2026, 10, 21, 10, n)).toISOString(),
      });
    }

    console.log("1) Honest chain");
    const v1 = await store.verifyChain(chainId);
    console.log(`   verifyChain: ${v1.ok ? "ok" : "BROKEN"} (${v1.entries} entries)  expected ok -> ${ok(v1.ok)}`);

    // The anchor an operator would have copied somewhere they cannot edit.
    const anchored = await currentDigest(store, new Date(Date.UTC(2026, 10, 21, 12)).toISOString());
    console.log(`   daily digest taken and kept elsewhere: ${anchored.digest.slice(0, 16)}...`);

    // An attacker with database access removes the append-only trigger, which the app itself never does.
    store.db.exec("drop trigger audit_no_update");
    store.db.prepare("update audit set after = ? where chain_id = ? and seq = 3").run("emergency item rewritten to push a product", chainId);

    console.log("2) One entry edited directly in the database");
    const v2 = await store.verifyChain(chainId);
    console.log(`   verifyChain: ${v2.ok ? "ok" : `BROKEN at entry ${v2.brokenAt} (${v2.reason})`}  expected broken -> ${ok(!v2.ok)}`);

    // The attacker recomputes every hash from the edited entry onward.
    const rows = await store.listAudit(chainId);
    let prev = GENESIS;
    for (const r of rows) {
      const base: Omit<AuditRec, "prevHash" | "hash"> = { ...r };
      const hash = hashEntry(prev, base);
      store.db.prepare("update audit set prev_hash = ?, hash = ? where chain_id = ? and seq = ?").run(prev, hash, chainId, r.seq);
      prev = hash;
    }

    console.log("3) The whole chain recomputed after the edit");
    const v3 = await store.verifyChain(chainId);
    console.log(`   verifyChain: ${v3.ok ? "ok" : "BROKEN"}  (the chain alone is fooled; this is the honest limit)  expected ok -> ${ok(v3.ok)}`);

    console.log("4) The digest kept elsewhere, compared with the rewritten chain");
    const d = await checkDigest(store, anchored);
    console.log(`   checkDigest: ${d.ok ? "matches" : `MISMATCH on ${d.mismatched.join(", ") || "-"}`}  expected mismatch -> ${ok(!d.ok)}`);

    const all = v1.ok && !v2.ok && v3.ok && !d.ok;
    console.log(`\n${all ? "As designed." : "UNEXPECTED RESULT."} A local file is an export, not an anchor: production must keep digests in storage the database operator cannot change.`);
    if (!all) process.exitCode = 1;
  } finally {
    await store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
void main();
