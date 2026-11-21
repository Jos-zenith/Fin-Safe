import { profileFor } from "@/data/personas";
import type { AppState, PersonaId, UserProfile } from "@/types";

/** Pick a seed persona (or start fresh). The UI language is kept; the profile follows it. */
export function pickPersona(s: AppState, id: PersonaId): AppState {
  const p = profileFor(id, s.lang);
  return { ...s, touched: true, personaId: id, profile: { ...p, language: s.lang }, intakeStep: 0, intakeDone: false, extras: [], fallSimulated: false };
}

export function completeIntake(s: AppState, profile: UserProfile, answeredOptional?: string[]): AppState {
  const familySize = profile.dependents + 1;
  return {
    ...s,
    touched: true,
    profile: { ...profile, familySize: Math.max(profile.familySize, familySize), language: s.lang },
    intakeDone: true,
    extras: answeredOptional ?? s.extras ?? [],
  };
}
