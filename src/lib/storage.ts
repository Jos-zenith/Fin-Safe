// Demo data retention (PRD 7.6). Default sessionStorage. Optional "remember" -> localStorage with a 24h expiry.
// One namespaced prefix; "Clear demo data" removes every namespaced key from BOTH storages.
import { CONSTANTS } from "@/config/constants";
import type { AppState, Lang } from "@/types";

export const NS = "fsdemo:v1:";
export const KEY_STATE = `${NS}state`;
export const KEY_LANG = `${NS}lang`;

export interface StorageLike {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
export interface Stores {
  session: StorageLike;
  local: StorageLike;
}

export function browserStores(): Stores | null {
  try {
    return { session: window.sessionStorage, local: window.localStorage };
  } catch {
    return null; // blocked storage: app still works in memory
  }
}

export function persistState(state: AppState, s: Stores, now = Date.now()): void {
  try {
    if (state.remember) {
      const expiresAt = now + CONSTANTS.rememberHours * 3600_000;
      s.local.setItem(KEY_STATE, JSON.stringify({ expiresAt, state }));
      s.session.removeItem(KEY_STATE);
    } else {
      s.session.setItem(KEY_STATE, JSON.stringify(state));
      s.local.removeItem(KEY_STATE);
    }
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

/** Remove expired "remember" data. Returns true if something was purged. */
export function purgeExpired(s: Stores, now = Date.now()): boolean {
  try {
    const raw = s.local.getItem(KEY_STATE);
    if (!raw) return false;
    const { expiresAt } = JSON.parse(raw) as { expiresAt?: number };
    if (typeof expiresAt !== "number" || expiresAt <= now) {
      s.local.removeItem(KEY_STATE);
      return true;
    }
  } catch {
    s.local.removeItem(KEY_STATE);
    return true;
  }
  return false;
}

export function loadState(s: Stores, now = Date.now()): AppState | null {
  purgeExpired(s, now);
  try {
    const remembered = s.local.getItem(KEY_STATE);
    if (remembered) return (JSON.parse(remembered) as { state: AppState }).state;
    const sess = s.session.getItem(KEY_STATE);
    if (sess) return JSON.parse(sess) as AppState;
  } catch {
    /* corrupt data is ignored */
  }
  return null;
}

/** Removes EVERY namespaced key from both storages. */
export function clearAllDemoData(s: Stores): number {
  let n = 0;
  for (const store of [s.session, s.local]) {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(NS)) keys.push(k);
    }
    for (const k of keys) {
      store.removeItem(k);
      n++;
    }
  }
  return n;
}

// The language choice is the only preference allowed to outlive the session.
export function saveLang(lang: Lang, s: Stores | null): void {
  try {
    s?.local.setItem(KEY_LANG, lang);
  } catch {
    /* ignore */
  }
}
export function loadLang(s: Stores | null): Lang | null {
  try {
    const v = s?.local.getItem(KEY_LANG);
    return v === "en" || v === "hi" || v === "ta" ? v : null;
  } catch {
    return null;
  }
}

export const IDLE_MS = CONSTANTS.idleMinutes * 60_000;
export const isIdle = (lastActive: number, now: number) => now - lastActive >= IDLE_MS;
