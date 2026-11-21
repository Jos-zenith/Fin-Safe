import { describe, expect, it } from "vitest";
import { seedState } from "@/lib/seed";
import {
  IDLE_MS,
  KEY_LANG,
  KEY_STATE,
  NS,
  clearAllDemoData,
  isIdle,
  loadLang,
  loadState,
  persistState,
  purgeExpired,
  saveLang,
  type StorageLike,
  type Stores,
} from "@/lib/storage";
import type { AppState } from "@/types";

class Mem implements StorageLike {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
const stores = (): Stores & { session: Mem; local: Mem } => ({ session: new Mem(), local: new Mem() });
const touched = (o: Partial<AppState> = {}): AppState => ({ ...seedState("en"), touched: true, ...o });

describe("demo data retention", () => {
  it("default storage is sessionStorage, not localStorage", () => {
    const s = stores();
    persistState(touched(), s);
    expect(s.session.getItem(KEY_STATE)).not.toBeNull();
    expect(s.local.getItem(KEY_STATE)).toBeNull();
  });

  it("everything lives under one namespaced prefix", () => {
    const s = stores();
    persistState(touched(), s);
    saveLang("ta", s);
    for (const store of [s.session, s.local]) for (const k of store.m.keys()) expect(k.startsWith(NS)).toBe(true);
  });

  it("'remember' goes to localStorage with a 24h expiry and leaves nothing in session", () => {
    const s = stores();
    const now = 1_000_000;
    persistState(touched({ remember: true }), s, now);
    const stored = JSON.parse(s.local.getItem(KEY_STATE)!);
    expect(stored.expiresAt).toBe(now + 24 * 3600_000);
    expect(s.session.getItem(KEY_STATE)).toBeNull();
  });

  it("remembered data survives within 24h and is purged after it", () => {
    const s = stores();
    const now = 5_000_000;
    persistState(touched({ remember: true }), s, now);
    expect(loadState(s, now + 23 * 3600_000)).not.toBeNull();
    expect(loadState(s, now + 24 * 3600_000 + 1)).toBeNull();
    expect(s.local.getItem(KEY_STATE)).toBeNull();
  });

  it("purgeExpired also removes corrupt data", () => {
    const s = stores();
    s.local.setItem(KEY_STATE, "{not json");
    expect(purgeExpired(s)).toBe(true);
    expect(s.local.getItem(KEY_STATE)).toBeNull();
  });

  it("turning 'remember' off moves data back to session only", () => {
    const s = stores();
    persistState(touched({ remember: true }), s);
    persistState(touched({ remember: false }), s);
    expect(s.local.getItem(KEY_STATE)).toBeNull();
    expect(s.session.getItem(KEY_STATE)).not.toBeNull();
  });

  it("idle timeout is 30 minutes", () => {
    expect(IDLE_MS).toBe(30 * 60_000);
    expect(isIdle(0, 29 * 60_000)).toBe(false);
    expect(isIdle(0, 30 * 60_000)).toBe(true);
  });

  it("'Clear demo data' removes every namespaced key from BOTH storages and nothing else", () => {
    const s = stores();
    persistState(touched({ remember: true }), s);
    s.session.setItem(`${NS}extra`, "x");
    s.local.setItem(`${NS}other`, "y");
    saveLang("hi", s);
    s.local.setItem("unrelated", "keep");
    s.session.setItem("unrelated2", "keep");
    const n = clearAllDemoData(s);
    expect(n).toBeGreaterThanOrEqual(4);
    expect([...s.session.m.keys()]).toEqual(["unrelated2"]);
    expect([...s.local.m.keys()]).toEqual(["unrelated"]);
    expect(s.local.getItem(KEY_LANG)).toBeNull();
  });

  it("the language choice is the only preference stored apart from state", () => {
    const s = stores();
    saveLang("ta", s);
    expect(loadLang(s)).toBe("ta");
    expect(loadLang(null)).toBeNull();
  });

  it("never stores secrets, pasted text or raw AI responses", () => {
    const s = stores();
    persistState(touched(), s);
    const blob = [...s.session.m.values(), ...s.local.m.values()].join("|");
    expect(blob).not.toMatch(/API_KEY|ANTHROPIC|GEMINI|rawResponse|pastedText/i);
  });
});
