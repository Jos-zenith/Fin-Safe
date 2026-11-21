"use client";
// The pasted message and its result, held in memory only so they can move between /second-opinion and
// /second-opinion/result. Nothing here is written to storage: a reload forgets the message, exactly as before.
// (The person can still choose "Report a missed message", which saves the REDACTED text for at most 24 hours.)
import { useSyncExternalStore } from "react";
import type { TextSource } from "@/components/SourceTag";
import type { SecondOpinionResult } from "@/lib/ai/schemas";

export interface OpinionResult {
  shown: string;
  out: SecondOpinionResult;
  source: TextSource;
}
interface OpinionState {
  text: string;
  res: OpinionResult | null;
  busy: boolean;
  failed: boolean;
}

let state: OpinionState = { text: "", res: null, busy: false, failed: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setOpinion(patch: Partial<OpinionState>): void {
  state = { ...state, ...patch };
  emit();
}
export function resetOpinion(): void {
  state = { text: "", res: null, busy: false, failed: false };
  emit();
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const SERVER: OpinionState = { text: "", res: null, busy: false, failed: false };
export function useOpinion(): OpinionState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
