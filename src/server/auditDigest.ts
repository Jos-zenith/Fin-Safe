// A daily digest of the audit chains' head hashes, written to a file.
//
// WHY: the per-case SHA-256 chain makes tampering detectable only while the WHOLE chain is not rewritten. Someone with full
// database access could recompute every hash. A digest taken on a given day and kept somewhere they CANNOT reach lets a
// later check say "the chain's history no longer matches what was written down that day".
//
// WHAT THIS DOES: it computes the digest and writes it to a local file, and it can check a stored digest against the
// live chains. It does NOT send the digest anywhere. Production must anchor it in independent, immutable storage
// (write-once object storage, a notary, another party), which is not built here and is described in docs/PRODUCTION_GAP.md.
// A file next to the database is an export, not an anchor.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import type { CaseStore } from "./store/types";

export interface DigestDoc {
  kind: "fin-safe-audit-digest";
  /** UTC date the digest was taken for. */
  date: string;
  generatedAt: string;
  chains: number;
  /** Total number of audit entries covered (the sum of every chain's last sequence number). */
  entries: number;
  /** SHA-256 over the sorted "chainId:seq:headHash" lines. */
  digest: string;
  heads: { chainId: string; seq: number; hash: string }[];
  note: string;
}

const NOTE = "A local export, not an anchor. To mean anything, keep a copy where whoever runs the database cannot change it.";

export const digestDir = () => path.join(dataDir(), "audit-digests");
const fileFor = (date: string) => `audit-digest-${date}.json`;
const utcDate = (iso: string) => iso.slice(0, 10);

/** The digest of every chain's current head. */
export async function currentDigest(store: CaseStore, nowIso: string): Promise<DigestDoc> {
  const heads = (await store.listChainHeads()).sort((a, b) => a.chainId.localeCompare(b.chainId));
  const lines = heads.map((h) => `${h.chainId}:${h.seq}:${h.hash}`).join("\n");
  return {
    kind: "fin-safe-audit-digest",
    date: utcDate(nowIso),
    generatedAt: nowIso,
    chains: heads.length,
    entries: heads.reduce((a, h) => a + h.seq, 0),
    digest: createHash("sha256").update(lines).digest("hex"),
    heads,
    note: NOTE,
  };
}

/**
 * Writes today's digest, once. An existing file for the date is NEVER overwritten (an anchor that can be replaced
 * is not an anchor); the existing one is returned with created = false.
 */
export async function exportDailyDigest(store: CaseStore, nowIso: string, dir = digestDir()): Promise<{ file: string; created: boolean; doc: DigestDoc }> {
  const date = utcDate(nowIso);
  const file = fileFor(date);
  const full = path.join(dir, file);
  if (existsSync(full)) return { file, created: false, doc: JSON.parse(readFileSync(full, "utf8")) as DigestDoc };
  const doc = await currentDigest(store, nowIso);
  mkdirSync(dir, { recursive: true });
  writeFileSync(full, JSON.stringify(doc, null, 2) + "\n", { flag: "wx" });
  return { file, created: true, doc };
}

export interface DigestCheck {
  /** Every chain the digest covers still has the same hash at the same position. */
  ok: boolean;
  checked: number;
  /** The chain exists but its history at that position is DIFFERENT: evidence the chain was rewritten. */
  mismatched: string[];
  /** The chain (or that position) no longer exists. In the demo the 24-hour purge removes chains, so this is expected. */
  missing: string[];
}

/** Compares a stored digest with the live chains. Chains are append-only, so an anchored head must still be there. */
export async function checkDigest(store: CaseStore, doc: DigestDoc): Promise<DigestCheck> {
  const mismatched: string[] = [];
  const missing: string[] = [];
  for (const h of doc.heads) {
    const entry = (await store.listAudit(h.chainId)).find((e) => e.seq === h.seq);
    if (!entry) missing.push(h.chainId);
    else if (entry.hash !== h.hash) mismatched.push(h.chainId);
  }
  const recomputed = createHash("sha256")
    .update([...doc.heads].sort((a, b) => a.chainId.localeCompare(b.chainId)).map((h) => `${h.chainId}:${h.seq}:${h.hash}`).join("\n"))
    .digest("hex");
  if (recomputed !== doc.digest) mismatched.push("(the digest file itself)");
  return { ok: mismatched.length === 0 && missing.length === 0, checked: doc.heads.length, mismatched, missing };
}

/** The most recent export in the folder, if any. */
export function latestExport(dir = digestDir()): { file: string; doc: DigestDoc } | null {
  // the folder is chosen at run time (AUDIT_DIGEST_DIR), so the bundler must not try to trace it
  if (!existsSync(/*turbopackIgnore: true*/ dir)) return null;
  const files = readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => /^audit-digest-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  const file = files[files.length - 1];
  return file ? { file, doc: JSON.parse(readFileSync(path.join(dir, file), "utf8")) as DigestDoc } : null;
}
