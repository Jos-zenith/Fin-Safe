// "Report a missed scam": the person chooses to save a message they think the check got wrong. Only the
// REDACTED text is saved, in this browser, under the demo namespace (so "Delete my demo data" removes it), for at
// most 24 hours, capped at 50 items. Nothing is sent anywhere from here. Names are removed on a best-effort basis only.
import { RETENTION_HOURS } from "@/config/workflow";
import type { Lang } from "@/types";
import { redact } from "./redact";
import { NS, type Stores } from "./storage";

export const KEY_MISSED = `${NS}missedScams`;
const MAX_ITEMS = 50;

export interface MissedReport {
  at: number;
  lang: Lang;
  overall: "low" | "medium" | "high";
  /** Already redacted. */
  text: string;
}

export function readMissed(s: Stores | null, now = Date.now()): MissedReport[] {
  if (!s) return [];
  try {
    const raw = s.local.getItem(KEY_MISSED);
    if (!raw) return [];
    const all = JSON.parse(raw) as MissedReport[];
    const fresh = all.filter((r) => now - r.at < RETENTION_HOURS * 3_600_000);
    if (fresh.length !== all.length) s.local.setItem(KEY_MISSED, JSON.stringify(fresh));
    return fresh;
  } catch {
    return [];
  }
}

/** Appends a report (redacting again, which is harmless on already-redacted text). Returns the new count. */
export function appendMissed(text: string, lang: Lang, overall: MissedReport["overall"], s: Stores | null, now = Date.now()): number {
  if (!s) return 0;
  const items = readMissed(s, now);
  items.push({ at: now, lang, overall, text: redact(text).slice(0, 3000) });
  const kept = items.slice(-MAX_ITEMS);
  try {
    s.local.setItem(KEY_MISSED, JSON.stringify(kept));
  } catch {
    /* storage may be blocked */
  }
  return kept.length;
}
