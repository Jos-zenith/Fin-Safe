// The persistence contract. Everything the server remembers goes through this interface, so SQLite (used here,
// because it needs no server and no install) can be replaced by Postgres without touching the workflow code.
//
// Rules the implementation must keep:
//  * `commit` and `createCase` apply the case change, its audit entries, notifications and metric events in ONE
//    transaction. A failure leaves nothing half-written.
//  * Audit rows are append-only: there is no update or delete method for them, and the only code path that removes
//    them is the retention purge. Each row carries prevHash and hash (see audit.ts).
//  * `commit` is optimistic: it applies only if the case is still at `expectedVersion`, so two advisers can never
//    both succeed at the same step.
import type { PlanPack } from "@/lib/ai/schemas";
import type { Actor, CaseStatus, ConsentRecord, CopilotOut, GenRecord, ItemReview, Lang, RiskRecord, UserProfile } from "@/types";

export type UserRole = "customer" | "adviser";
export type AuditRole = "customer" | "adviser" | "system" | "ai";

export interface UserRec {
  id: string;
  role: UserRole;
  /** "priya" | "ramesh" | "anita" for the seeded demo customers, "adviser", or "fresh" for an anonymous demo visitor. */
  persona: string;
  displayName: string;
  language: Lang;
  /** Seeded demo accounts are re-seeded on reset and purge, never deleted. */
  isSeed: boolean;
  createdAt: string;
  lastActiveAt: string;
  /** When the person accepted the demo notice. Recorded on the server, not just in the browser. */
  consentAt: string | null;
}

export interface SessionRec {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface CaseRec {
  id: string;
  userId: string;
  status: CaseStatus;
  urgent: boolean;
  planSource: "mock" | "provider" | "fixture" | null;
  /** The adviser who has claimed the case, or null while it waits. */
  claimedBy: string | null;
  claimedAt: string | null;
  /** The frozen AI draft of the CURRENT plan version. Adviser changes live in `reviews`. */
  plan: PlanPack;
  planVersion: number;
  reviews: Record<string, ItemReview>;
  checklist: Record<string, boolean>;
  adviserQuestion: string | null;
  userReply: string | null;
  copilot: CopilotOut | null;
  /** Preparation of the findings and the plan (null for a seeded case, which was prepared at seed time). */
  gen: GenRecord | null;
  /** Suitability: the risk profile (confirmed by the adviser before approval) and the customer's recorded demo consent. */
  risk: RiskRecord | null;
  consent: ConsentRecord | null;
  /** When the customer accepted the reviewed plan. Until then it is "Reviewed, awaiting your acceptance". */
  acceptedAt: string | null;
  /** The customer reported an error in the plan; the case is back with an adviser, flagged. */
  flagged: boolean;
  flagNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  /** When the case was last put in front of an adviser (creation, or the customer's reply). The SLA runs from here. */
  waitingSince: string;
  /** Optimistic-concurrency counter. Increases on every committed change. */
  version: number;
}

export type CaseFields = Omit<CaseRec, "id" | "userId" | "createdAt" | "version">;

export interface PlanVersionRec {
  caseId: string;
  version: number;
  plan: PlanPack;
  source: CaseRec["planSource"];
  reason: string;
  createdAt: string;
}

export interface AuditInput {
  chainId: string;
  caseId: string | null;
  actorId: string;
  actorRole: AuditRole;
  actor: Actor;
  requestId: string;
  action: string;
  before?: string | null;
  after?: string | null;
  evidenceRefs?: string[];
  disclosuresShown?: string[];
  ts: string;
}

export interface AuditRec extends Required<Omit<AuditInput, "before" | "after">> {
  before: string | null;
  after: string | null;
  seq: number;
  prevHash: string;
  hash: string;
}

export interface ChainVerification {
  ok: boolean;
  entries: number;
  /** seq of the first entry that does not verify. */
  brokenAt?: number;
  reason?: string;
  /** Hash of the last entry: a person can note it down and compare later. */
  head?: string;
}

export interface NewNotification {
  userId: string;
  kind: string;
  caseId?: string | null;
  params?: Record<string, string | number>;
  createdAt: string;
}
export interface NotificationRec extends NewNotification {
  id: string;
  caseId: string | null;
  params: Record<string, string | number>;
  readAt: string | null;
}

/** A metric event describes WHAT happened and WHEN, never WHO or WHAT WAS SAID. No profile content, no message text. */
export interface MetricInput {
  kind: string;
  at: string;
  caseId?: string | null;
  task?: string | null;
  valueMs?: number | null;
  props?: Record<string, string | number | boolean>;
}
export interface MetricRec extends MetricInput {
  id: string;
  caseId: string | null;
  task: string | null;
  valueMs: number | null;
  props: Record<string, string | number | boolean>;
}

export type ActionStatus = "suggested" | "planned" | "done" | "skipped";

/**
 * One planning to-do for one finding. The text is a TEMPLATE KEY plus figures taken from the engine, filled in by
 * app code (never by a model), and it is a planning step, not a product instruction.
 */
export interface ActionRec {
  id: string;
  userId: string;
  findingId: string;
  severity: "high" | "medium" | "low";
  textKey: string;
  params: Record<string, string>;
  status: ActionStatus;
  /** yyyy-mm-dd, chosen by the customer when they plan the step. */
  followupOn: string | null;
  /** False when a later profile update means the finding no longer applies. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssumptionReviewRec {
  assumptionId: string;
  byUserId: string;
  byName: string;
  on: string;
}

export interface CaseChange {
  caseId: string;
  expectedVersion: number;
  patch: Partial<CaseFields>;
  audit?: AuditInput[];
  notifications?: NewNotification[];
  metrics?: MetricInput[];
  /** A new frozen plan version (also bumps the case's planVersion). */
  planVersion?: Omit<PlanVersionRec, "caseId" | "version">;
}

export interface PurgeReport {
  users: number;
  cases: number;
  audit: number;
  notifications: number;
  sessions: number;
}

export interface CaseStore {
  // users and sessions
  getUser(id: string): Promise<UserRec | null>;
  findUserByPersona(persona: string): Promise<UserRec | null>;
  listUsers(): Promise<UserRec[]>;
  saveUser(u: UserRec): Promise<void>;
  touchUser(id: string, at: string): Promise<void>;
  createSession(s: SessionRec): Promise<void>;
  getSession(id: string): Promise<SessionRec | null>;
  deleteSession(id: string): Promise<void>;
  deleteSessionsOf(userId: string): Promise<number>;

  // profiles
  getProfile(userId: string): Promise<UserProfile | null>;
  putProfile(userId: string, profile: UserProfile, at: string): Promise<void>;

  // cases (every write goes through createCase or commit)
  getCase(id: string): Promise<CaseRec | null>;
  getCaseByUser(userId: string): Promise<CaseRec | null>;
  listCases(): Promise<CaseRec[]>;
  createCase(
    rec: Omit<CaseRec, "version">,
    extras: { audit?: AuditInput[]; notifications?: NewNotification[]; metrics?: MetricInput[]; planVersion?: Omit<PlanVersionRec, "caseId" | "version"> },
  ): Promise<CaseRec>;
  commit(change: CaseChange): Promise<CaseRec | "conflict" | "not_found">;
  listPlanVersions(caseId: string): Promise<PlanVersionRec[]>;

  // audit (append through createCase / commit / appendAudit only)
  appendAudit(input: AuditInput): Promise<AuditRec>;
  listAudit(chainId: string): Promise<AuditRec[]>;
  verifyChain(chainId: string): Promise<ChainVerification>;
  /** The last entry of every chain: what a daily digest is built from. */
  listChainHeads(): Promise<{ chainId: string; seq: number; hash: string }[]>;

  // notifications
  addNotifications(n: NewNotification[]): Promise<void>;
  listNotifications(userId: string, limit?: number): Promise<NotificationRec[]>;
  markRead(userId: string, ids: string[] | "all", at: string): Promise<number>;
  unreadCount(userId: string): Promise<number>;

  // metrics (no profile content)
  addMetrics(m: MetricInput[]): Promise<void>;
  listMetrics(sinceIso?: string): Promise<MetricRec[]>;

  // improve: planning actions per finding
  listActions(userId: string): Promise<ActionRec[]>;
  upsertAction(a: ActionRec): Promise<void>;

  // assumption reviews (an adviser marks an assumption as reviewed in the demo; audited by the caller)
  listAssumptionReviews(): Promise<AssumptionReviewRec[]>;
  upsertAssumptionReview(r: AssumptionReviewRec): Promise<void>;

  // retention
  /** Removes a person's profile, cases, plan versions, audit chains, metric events and notifications. The user row and sessions stay. */
  purgeUserData(userId: string): Promise<PurgeReport>;
  /** Removes data for demo users with no activity since `cutoffIso`. Seed accounts are reset by the caller afterwards. */
  purgeInactiveSince(cutoffIso: string): Promise<{ purgedUserIds: string[]; report: PurgeReport }>;
  deleteUser(id: string): Promise<void>;
  bumpCounter(name: string, by?: number): Promise<number>;
  getCounter(name: string): Promise<number>;

  close(): Promise<void>;
}
