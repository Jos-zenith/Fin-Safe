import type { AppState, Lang } from "@/types";

/**
 * The browser's own starting state. Cases, the audit trail, the queue and notifications are held by the SERVER
 * (src/server), which seeds the adviser, the demo customers and the two waiting cases.
 */
export function seedState(lang: Lang): AppState {
  return {
    v: 1,
    touched: false,
    noticeSeen: false,
    lang,
    personaId: null,
    profile: null,
    intakeStep: 0,
    intakeDone: false,
    fallSimulated: false,
    remember: false,
  };
}
