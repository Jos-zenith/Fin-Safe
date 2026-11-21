"use client";
// Accessibility preferences from Settings (text size, high contrast, reduced motion, screen-reader hints).
// They live in this browser tab only (sessionStorage, under the demo namespace), so "Clear demo data" removes them and
// language stays the only preference that outlives the session.
import { useSyncExternalStore } from "react";
import { NS } from "@/lib/storage";

export interface Prefs {
  text: "md" | "lg" | "xl";
  contrast: boolean;
  motion: boolean;
  hints: boolean;
}
export const DEFAULT_PREFS: Prefs = { text: "md", contrast: false, motion: false, hints: false };
export const KEY_PREFS = `${NS}prefs`;

const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  try {
    const raw = window.sessionStorage.getItem(KEY_PREFS);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return {
        text: p.text === "lg" || p.text === "xl" ? p.text : "md",
        contrast: !!p.contrast,
        motion: !!p.motion,
        hints: !!p.hints,
      };
    }
  } catch {
    /* blocked or corrupt storage: use the defaults */
  }
  return DEFAULT_PREFS;
}

/** Put the preferences on <html>, where the stylesheet reads them (see globals.css). */
export function applyPrefs(p: Prefs): void {
  const el = document.documentElement;
  if (p.text === "md") delete el.dataset.text;
  else el.dataset.text = p.text;
  if (p.contrast) el.dataset.contrast = "high";
  else delete el.dataset.contrast;
  if (p.motion) el.dataset.motion = "reduce";
  else delete el.dataset.motion;
  if (p.hints) el.dataset.hints = "on";
  else delete el.dataset.hints;
}

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  return (cache ??= read());
}

export function setPrefs(patch: Partial<Prefs>): void {
  const next = { ...getPrefs(), ...patch };
  cache = next;
  try {
    window.sessionStorage.setItem(KEY_PREFS, JSON.stringify(next));
  } catch {
    /* works in memory */
  }
  applyPrefs(next);
  listeners.forEach((l) => l());
}

/** Forget the cached copy (after "Clear demo data" removed the storage key). */
export function resetPrefsCache(): void {
  cache = null;
  if (typeof window !== "undefined") applyPrefs(DEFAULT_PREFS);
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs, () => DEFAULT_PREFS);
}
