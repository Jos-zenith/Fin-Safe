"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Reviews } from "@/config/assumptions";
import { translate, type Params, type TFn } from "@/i18n";
import { browserStores, clearAllDemoData, isIdle, loadLang, loadState, persistState, saveLang, type Stores } from "@/lib/storage";
import { resetPrefsCache } from "@/lib/prefs";
import { seedState } from "@/lib/seed";
import type { AppState, Lang } from "@/types";

interface Ctx {
  state: AppState | null;
  ready: boolean;
  lang: Lang;
  t: TFn;
  /** Apply a pure state transition. */
  update: (fn: (s: AppState) => AppState) => void;
  setLang: (l: Lang) => void;
  setRemember: (on: boolean) => void;
  clearData: () => void;
  resetDemo: () => void;
  idleCleared: boolean;
  dismissIdle: () => void;
  /** Adviser reviews of assumptions (server-side once signed in). Empty = everything unverified. */
  reviews: Reviews;
  setReviews: (r: Reviews) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [idleCleared, setIdleCleared] = useState(false);
  const [reviews, setReviews] = useState<Reviews>({});
  const stores = useRef<Stores | null>(null);
  const lastActive = useRef(0);

  // Hydrate after mount (never during SSR) so server and client markup match.
  useEffect(() => {
    stores.current = browserStores();
    const savedLang = loadLang(stores.current);
    const loaded = stores.current ? loadState(stores.current) : null;
    const lang = savedLang ?? loaded?.lang ?? "en";
    setState({ ...(loaded ?? seedState(lang)), lang });
    lastActive.current = Date.now();
  }, []);

  // Persist only after the user actually did something.
  useEffect(() => {
    if (state?.touched && stores.current) persistState(state, stores.current);
  }, [state]);

  const lang: Lang = state?.lang ?? "en";
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((s) => (s ? fn(s) : s));
  }, []);

  const clearData = useCallback(() => {
    if (stores.current) clearAllDemoData(stores.current);
    resetPrefsCache(); // the accessibility preferences are part of the demo data
    setState((s) => seedState(s?.lang ?? "en")); // untouched => nothing is written back
  }, []);

  const resetDemo = useCallback(() => {
    setState((s) => (s ? { ...seedState(s.lang), noticeSeen: true, touched: true, remember: s.remember } : s));
  }, []);

  const setLang = useCallback((l: Lang) => {
    saveLang(l, stores.current);
    setState((s) => (s ? { ...s, lang: l } : s));
  }, []);

  const setRemember = useCallback((on: boolean) => {
    setState((s) => (s ? { ...s, remember: on, touched: true } : s));
  }, []);

  // Idle timeout: 30 minutes without input clears demo data.
  useEffect(() => {
    const bump = () => {
      lastActive.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = window.setInterval(() => {
      if (lastActive.current && isIdle(lastActive.current, Date.now())) {
        if (stores.current) clearAllDemoData(stores.current);
        setState((s) => seedState(s?.lang ?? "en"));
        setIdleCleared(true);
        lastActive.current = Date.now();
      }
    }, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(timer);
    };
  }, []);

  const t = useCallback<TFn>((key: string, params?: Params) => translate(lang, key, params), [lang]);

  const value = useMemo<Ctx>(
    () => ({ state, ready: state !== null, lang, t, update, setLang, setRemember, clearData, resetDemo, idleCleared, dismissIdle: () => setIdleCleared(false), reviews, setReviews }),
    [state, lang, t, update, setLang, setRemember, clearData, resetDemo, idleCleared, reviews],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
