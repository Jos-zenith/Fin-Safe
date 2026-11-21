// Hash-chained audit. Each entry's hash covers the previous entry's hash and the entry itself, so changing,
// removing or re-ordering any past entry breaks every hash after it. Verification recomputes the whole chain.
//
// This makes tampering DETECTABLE. It does not prevent someone with full database access from rewriting the whole
// chain; for that, the head hash would have to be anchored somewhere they cannot reach (see docs/PRODUCTION_GAP.md).
import { createHash } from "node:crypto";
import type { AuditRec, ChainVerification } from "./types";

export const GENESIS = "0".repeat(64);

/** JSON with sorted keys and no whitespace, so the same entry always hashes the same. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(",")}}`;
}

/** Exactly the fields the hash covers (everything except the hashes themselves). */
export function hashable(e: Omit<AuditRec, "prevHash" | "hash">) {
  return {
    seq: e.seq,
    chainId: e.chainId,
    caseId: e.caseId,
    actorId: e.actorId,
    actorRole: e.actorRole,
    actor: e.actor,
    requestId: e.requestId,
    action: e.action,
    before: e.before,
    after: e.after,
    evidenceRefs: e.evidenceRefs,
    disclosuresShown: e.disclosuresShown,
    ts: e.ts,
  };
}

export const hashEntry = (prevHash: string, e: Omit<AuditRec, "prevHash" | "hash">): string =>
  createHash("sha256")
    .update(prevHash + canonicalJson(hashable(e)))
    .digest("hex");

export function verifyEntries(entries: AuditRec[]): ChainVerification {
  let prev = GENESIS;
  let expectedSeq = 1;
  for (const e of entries) {
    if (e.seq !== expectedSeq) return { ok: false, entries: entries.length, brokenAt: e.seq, reason: "sequence gap or reorder" };
    if (e.prevHash !== prev) return { ok: false, entries: entries.length, brokenAt: e.seq, reason: "previous hash does not match" };
    if (hashEntry(prev, e) !== e.hash) return { ok: false, entries: entries.length, brokenAt: e.seq, reason: "entry was changed" };
    prev = e.hash;
    expectedSeq++;
  }
  return { ok: true, entries: entries.length, head: entries.length ? prev : undefined };
}
