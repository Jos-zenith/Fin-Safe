"use client";
import { useEffect, useMemo, useState } from "react";
import { callAI } from "@/lib/ai/client";
import type { SystemEvent, TaskRequest } from "@/lib/ai/run";
import { nudgeRules, runEngine } from "@/lib/engine";
import type { EngineResult, Lang, Nudge, UserProfile } from "@/types";

/**
 * The live height of an element, in px (it follows the element as it grows or shrinks). `"header"` finds the page header.
 * Pass a callback-ref element (state), not a ref object, so the hook re-attaches when the element mounts.
 */
export function useHeight(target: Element | null | "header", initial = 0): number {
  const [h, setH] = useState(initial);
  useEffect(() => {
    const el = target === "header" ? document.querySelector("header") : target;
    if (!el || typeof ResizeObserver === "undefined") return;
    // the observer reports once as soon as it starts watching, so there is no separate first measurement
    const ro = new ResizeObserver(() => setH(Math.ceil(el.getBoundingClientRect().height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [target]);
  return h;
}

export function useEngine(profile: UserProfile | null): EngineResult | null {
  return useMemo(() => (profile ? runEngine(profile) : null), [profile]);
}

/** Runs an AI task whenever `key` changes. `req` must be stable for a given key. */
export function useAI<T>(
  req: TaskRequest | null,
  key: string,
): { data: T | null; loading: boolean; events: SystemEvent[]; source: "mock" | "provider" | "fixture" | null } {
  const [s, setS] = useState<{ key: string; data: T | null; events: SystemEvent[]; source: "mock" | "provider" | "fixture" | null }>({
    key: "",
    data: null,
    events: [],
    source: null,
  });
  useEffect(() => {
    if (!req) return;
    let live = true;
    callAI(req).then((r) => {
      if (live) setS({ key, data: r.data as T, events: r.events, source: r.source });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const cur = s.key === key;
  return { data: cur ? s.data : null, loading: !!req && !cur, events: cur ? s.events : [], source: cur ? s.source : null };
}

export type NudgeWithSource = Nudge & { source?: "mock" | "provider" | "fixture" };

export function useNudges(profile: UserProfile | null, engine: EngineResult | null, lang: Lang): NudgeWithSource[] {
  const rules = useMemo(() => (profile && engine ? nudgeRules(profile, engine).slice(0, 3) : []), [profile, engine]);
  const key = `${lang}|${profile?.id}|${rules.map((r) => r.ruleId).join()}`;
  const [out, setOut] = useState<{ key: string; list: NudgeWithSource[] }>({ key: "", list: [] });
  useEffect(() => {
    if (!profile || rules.length === 0) return;
    let live = true;
    Promise.all(rules.map((r) => callAI({ task: "nudgeCopy", language: lang, profile, nudge: r }))).then((res) => {
      if (live) setOut({ key, list: rules.map((r, i) => ({ ...r, text: (res[i].data as { text: string }).text, source: res[i].source })) });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return out.key === key ? out.list : [];
}
