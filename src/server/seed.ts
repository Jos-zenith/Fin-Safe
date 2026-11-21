// Demo data: one synthetic adviser, three seeded customers, and two cases already waiting in the queue.
// "Reset demo" re-seeds ONLY the signed-in account (resetAccount); it never touches anyone else's data.
import { ANITA, PRIYA, RAMESH } from "@/data/personas";
import { localFixture } from "@/lib/ai/run";
import type { PlanPack } from "@/lib/ai/schemas";
import { CONSENT_SHOWN, CONSENT_VERSION } from "@/config/workflow";
import { runEngine } from "@/lib/engine";
import { scoreRisk, type RiskAnswers } from "@/lib/risk";
import type { UserProfile } from "@/types";
import { clock, nowIso } from "./config";
import type { AuditInput, CaseStore, UserRec } from "./store/types";

export const ADVISER_ID = "adviser-demo";
export const ADVISER_NAME = "Demo adviser (synthetic)";

interface SeedCustomer {
  persona: "priya" | "ramesh" | "anita";
  profile: UserProfile;
  /** Minutes the seeded case has already been waiting, or null for "no case yet". */
  waitingMinutes: number | null;
  /** Synthetic questionnaire answers for the seeded case (nobody answered them; the record says so). */
  risk?: Required<RiskAnswers>;
}
const CUSTOMERS: SeedCustomer[] = [
  { persona: "priya", profile: PRIYA, waitingMinutes: null },
  { persona: "ramesh", profile: RAMESH, waitingMinutes: 130, risk: { cushion: 0, fall: 1, swing: 1, horizon: 2, years: 1, past: 1 } },
  { persona: "anita", profile: ANITA, waitingMinutes: 35, risk: { cushion: 3, fall: 2, swing: 2, horizon: 3, years: 3, past: 2 } },
];

export const PERSONAS = ["priya", "ramesh", "anita"] as const;
export type SeedPersona = (typeof PERSONAS)[number];

const userRec = (id: string, role: UserRec["role"], persona: string, displayName: string, language: UserRec["language"], isSeed: boolean): UserRec => ({
  id,
  role,
  persona,
  displayName,
  language,
  isSeed,
  createdAt: nowIso(),
  lastActiveAt: nowIso(),
  consentAt: null,
});

const seedAudit = (caseId: string, userId: string, action: string, kind: "user" | "ai", ts: string, after?: string): AuditInput => ({
  chainId: caseId,
  caseId,
  actorId: kind === "ai" ? "ai" : userId,
  actorRole: kind === "ai" ? "ai" : "customer",
  actor: kind,
  requestId: "seed",
  action,
  after: after ?? null,
  disclosuresShown: kind === "ai" ? ["not_final", "earn_banner"] : ["demo_banner", "earn_banner"],
  ts,
});

/** Puts one seeded customer back to its starting state: profile, and a waiting case for Ramesh and Anita. */
export async function resetSeedCustomer(store: CaseStore, persona: SeedPersona): Promise<UserRec> {
  const seed = CUSTOMERS.find((c) => c.persona === persona)!;
  let user = await store.findUserByPersona(persona);
  if (!user) {
    user = userRec(`user-${persona}`, "customer", persona, seed.profile.name, seed.profile.language, true);
    await store.saveUser(user);
  } else {
    await store.purgeUserData(user.id);
    user = { ...user, lastActiveAt: nowIso(), consentAt: null };
    await store.saveUser(user);
  }
  if (seed.waitingMinutes !== null) {
    await store.putProfile(user.id, structuredClone(seed.profile), nowIso());
    const at = new Date(clock.now() - seed.waitingMinutes * 60_000).toISOString();
    const plan = localFixture({ task: "draftPlanPack", language: seed.profile.language, profile: seed.profile }) as PlanPack;
    const id = `case-${persona}`;
    await store.createCase(
      {
        id,
        userId: user.id,
        status: "DRAFT_READY",
        urgent: false,
        planSource: "mock",
        claimedBy: null,
        claimedAt: null,
        plan,
        planVersion: 1,
        reviews: {},
        checklist: {},
        adviserQuestion: null,
        userReply: null,
        copilot: null,
        risk: seed.risk
          ? { ...scoreRisk(seed.risk, seed.profile, runEngine(seed.profile)), answers: { ...seed.risk }, completedAt: at, seeded: true }
          : null,
        consent: { at, version: CONSENT_VERSION, language: seed.profile.language, shown: [...CONSENT_SHOWN], seeded: true },
        acceptedAt: null,
        flagged: false,
        flagNote: null,
        gen: null,
        createdAt: at,
        updatedAt: at,
        reviewedAt: null,
        waitingSince: at,
      },
      {
        audit: [seedAudit(id, user.id, "plan_requested", "user", at), seedAudit(id, user.id, "draft_generated", "ai", at, `${plan.items.length} items`)],
        planVersion: { plan, source: "mock", reason: "seeded draft", createdAt: at },
      },
    );
  }
  return user;
}

/** Creates the adviser and the seeded customers if they are missing. Safe to call on every start. */
export async function ensureSeeded(store: CaseStore): Promise<void> {
  if (!(await store.getUser(ADVISER_ID))) await store.saveUser(userRec(ADVISER_ID, "adviser", "adviser", ADVISER_NAME, "en", true));
  for (const c of CUSTOMERS) if (!(await store.findUserByPersona(c.persona))) await resetSeedCustomer(store, c.persona);
}

/** A new anonymous demo visitor ("Start fresh"). Deleted by the retention purge. */
export async function createFreshUser(store: CaseStore, language: UserRec["language"]): Promise<UserRec> {
  const id = `user-fresh-${crypto.randomUUID()}`;
  const user = userRec(id, "customer", "fresh", "You", language, false);
  await store.saveUser(user);
  return user;
}

/** Re-seeds only this account. A seeded customer goes back to its starting state; an anonymous one is emptied. */
export async function resetAccount(store: CaseStore, user: UserRec): Promise<void> {
  if (user.role === "customer" && user.isSeed && (PERSONAS as readonly string[]).includes(user.persona)) {
    await resetSeedCustomer(store, user.persona as SeedPersona);
    return;
  }
  await store.purgeUserData(user.id);
}
