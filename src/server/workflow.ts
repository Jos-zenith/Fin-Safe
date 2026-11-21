// The case workflow, enforced on the server. The client only ASKS for a step; this file decides whether the step is
// allowed, and writes the change, its audit entries, its notifications and its metric events in one transaction.
//
// States:  (none) --submit--> DRAFT_READY --claim--> IN_REVIEW --approve--> APPROVED
//                                  ^                    |
//                                  |--customer reply----+-- return --> CHANGES_REQUESTED
// Anything not drawn above is rejected with 409 "invalid_transition".
import { CHECKLIST_IDS, CONSENT_SHOWN, CONSENT_VERSION, MAX_DWELL_MS, SLA_MINUTES } from "@/config/workflow";
import { applyGuardrails } from "@/lib/ai/guardrails";
import { priorityScore, runEngine } from "@/lib/engine";
import { riskComplete, scoreRisk, type RiskAnswers } from "@/lib/risk";
import type { Case, CaseStatus, CopilotOut, Decision, GenRecord, ItemReview, Lang, UserProfile } from "@/types";
import type { PlanPack } from "@/lib/ai/schemas";
import { clock, nowIso } from "./config";
import { WorkflowError } from "./errors";
import type { TaskResult } from "@/lib/ai/run";
import { generateAnswer, generateFindings, generatePlan } from "./plan";
import { raiseNudges, recordProfileChange, syncActions, type MetricChange } from "./improve";
import type { AuditInput, AuditRole, CaseChange, CaseRec, CaseStore, UserRec } from "./store/types";

export { WorkflowError };
const fail = (status: number, code: string): never => {
  throw new WorkflowError(status, code);
};

export interface Ctx {
  store: CaseStore;
  user: UserRec;
  requestId: string;
}

const DEMO = ["demo_workflow"];

// ---------- helpers ----------
function auditOf(ctx: Ctx, caseId: string | null, kind: "user" | "adviser" | "system" | "ai", action: string, extra: Partial<AuditInput> = {}): AuditInput {
  const role: AuditRole = kind === "user" ? "customer" : kind;
  return {
    chainId: caseId ?? "global",
    caseId,
    actorId: kind === "system" || kind === "ai" ? kind : ctx.user.id,
    actorRole: role,
    actor: kind,
    requestId: ctx.requestId,
    action,
    ts: nowIso(),
    ...extra,
  };
}

async function advisers(store: CaseStore): Promise<UserRec[]> {
  return (await store.listUsers()).filter((u) => u.role === "adviser");
}

async function mustCase(ctx: Ctx, id: string): Promise<CaseRec> {
  const c = await ctx.store.getCase(id);
  return c ?? fail(404, "not_found");
}

const mustAdviser = (ctx: Ctx) => (ctx.user.role === "adviser" ? undefined : fail(403, "forbidden"));
const mustCustomer = (ctx: Ctx) => (ctx.user.role === "customer" ? undefined : fail(403, "forbidden"));

/** The adviser must hold the claim and the case must be in review. */
function mustHold(ctx: Ctx, c: CaseRec): void {
  mustAdviser(ctx);
  if (c.status !== "IN_REVIEW") fail(409, "invalid_transition");
  if (c.claimedBy !== ctx.user.id) fail(403, "not_claimer");
}

async function apply(ctx: Ctx, c: CaseRec, change: Omit<CaseChange, "caseId" | "expectedVersion">): Promise<CaseRec> {
  const out = await ctx.store.commit({ ...change, caseId: c.id, expectedVersion: c.version, patch: { ...change.patch, updatedAt: nowIso() } });
  if (out === "conflict") return fail(409, "conflict");
  if (out === "not_found") return fail(404, "not_found");
  return out;
}

const slaDue = (waitingSince: string) => new Date(Date.parse(waitingSince) + SLA_MINUTES * 60_000).toISOString();

// ---------- views (what the API returns) ----------
export async function viewCase(store: CaseStore, c: CaseRec, viewer: UserRec): Promise<Case> {
  const owner = await store.getUser(c.userId);
  const profile = (await store.getProfile(c.userId)) as UserProfile;
  const claimer = c.claimedBy ? await store.getUser(c.claimedBy) : null;
  const flags = profile ? runEngine(profile).flags : [];
  const waitingMinutes = Math.max(0, Math.floor((clock.now() - Date.parse(c.waitingSince)) / 60_000));
  const due = slaDue(c.waitingSince);
  const waiting = c.status === "DRAFT_READY" || c.status === "IN_REVIEW";
  const isAdviser = viewer.role === "adviser";
  return {
    id: c.id,
    personaId: (owner?.persona ?? "fresh") as Case["personaId"],
    profile,
    status: c.status,
    urgent: c.urgent,
    plan: c.plan,
    reviews: c.reviews,
    checklist: isAdviser ? c.checklist : {},
    adviserQuestion: c.adviserQuestion ?? undefined,
    userReply: c.userReply ?? undefined,
    copilot: isAdviser ? (c.copilot ?? undefined) : undefined,
    gen: c.gen ?? undefined,
    risk: c.risk,
    consent: c.consent,
    acceptedAt: c.acceptedAt ?? undefined,
    flagged: c.flagged,
    flagNote: c.flagNote ?? undefined,
    planSource: c.planSource ?? undefined,
    planVersion: c.planVersion,
    waitingSince: c.waitingSince,
    slaDueAt: due,
    waitingMinutes,
    overdue: waiting && clock.now() > Date.parse(due),
    claimedBy: claimer ? { id: claimer.id, name: claimer.displayName } : null,
    flags,
    priority: priorityScore(flags, c.urgent),
    version: c.version,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    reviewedAt: c.reviewedAt ?? undefined,
  };
}

/** Customers may read only their own case; advisers may read any. */
export async function caseForViewer(ctx: Ctx, id: string): Promise<CaseRec> {
  const c = await mustCase(ctx, id);
  if (ctx.user.role !== "adviser" && c.userId !== ctx.user.id) return fail(404, "not_found"); // not 403: do not reveal it exists
  return c;
}

/** The adviser's queue: waiting cases first, most urgent first, approved cases last. */
export async function queue(ctx: Ctx): Promise<Case[]> {
  mustAdviser(ctx);
  const views = await Promise.all((await ctx.store.listCases()).filter((c) => c.status !== "INTAKE_DONE").map((c) => viewCase(ctx.store, c, ctx.user)));
  const rank = (c: Case) => (c.status === "APPROVED" ? 2 : c.status === "CHANGES_REQUESTED" ? 1 : 0);
  return views.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      Number(b.overdue) - Number(a.overdue) ||
      (b.priority ?? 0) - (a.priority ?? 0) ||
      Date.parse(a.waitingSince ?? a.createdAt) - Date.parse(b.waitingSince ?? b.createdAt),
  );
}

// ---------- customer steps ----------
export async function saveProfile(ctx: Ctx, profile: UserProfile): Promise<MetricChange[]> {
  mustCustomer(ctx);
  const before = await ctx.store.getProfile(ctx.user.id);
  const next = { ...profile, isSynthetic: true as const };
  await ctx.store.putProfile(ctx.user.id, next, nowIso());
  // savings, income, spending or loans changed: re-run the engine and put BEFORE and AFTER in the audit trail
  const changes = await recordProfileChange(ctx.store, ctx.user, ctx.requestId, before, next);
  await syncActions(ctx.store, ctx.user.id, next);
  await raiseNudges(ctx.store, ctx.user.id, next);
  return changes;
}

/** What the customer must do BEFORE a case can enter the adviser queue: the risk questionnaire and the demo consent. */
export interface Agreement {
  risk?: Record<string, number>;
  consent?: { accepted: boolean; version: string };
}

/** A plan with nothing in it yet: the case exists, the model has not finished. The schema never sees this as a draft. */
const pendingPlan = (lang: Lang): PlanPack => ({ lang, summary: "", priorities: [], items: [], checklist: [], adviserQuestions: [] });

/** How long creating a case waits for a FAST generator before replying. A slow one is left to finish in the background. */
const graceMs = () => {
  const v = Number(process.env.PLAN_GRACE_MS);
  return Number.isFinite(v) && v >= 0 ? v : 400;
};

// Generation runs after the HTTP response (a long-running Node server can do that; a serverless host may not, which
// docs/PRODUCTION_GAP.md says). Tests wait for it with settleGenerations().
const inflight = new Set<Promise<void>>();
export async function settleGenerations(): Promise<void> {
  while (inflight.size) await Promise.allSettled([...inflight]);
}

/** Re-reads the case and applies a change, retrying if something else committed in between. */
async function commitLatest(ctx: Ctx, caseId: string, build: (c: CaseRec) => Omit<CaseChange, "caseId" | "expectedVersion"> | null): Promise<CaseRec | null> {
  for (let i = 0; i < 4; i++) {
    const cur = await ctx.store.getCase(caseId);
    if (!cur) return null;
    const change = build(cur);
    if (!change) return cur;
    const out = await ctx.store.commit({ ...change, caseId, expectedVersion: cur.version, patch: { ...change.patch, updatedAt: nowIso() } });
    if (out !== "conflict" && out !== "not_found") return out;
  }
  return null;
}

/**
 * Prepares the findings, then the plan, for a case. Each section is timed on its own and appears (in the case record)
 * as soon as it is done. When the plan is ready the case enters the adviser's queue and the advisers are told.
 */
async function runGeneration(ctx: Ctx, caseId: string, language: Lang, reason: string): Promise<void> {
  try {
    const profile = await ctx.store.getProfile(ctx.user.id);
    if (!profile) throw new Error("profile_missing");

    // 1. the findings
    const f = await generateFindings(profile, language);
    await commitLatest(ctx, caseId, (c) => ({
      patch: { gen: { ...(c.gen as GenRecord), stage: "plan", findings: f.findings, findingsMs: f.latencyMs, findingsSource: f.source } },
      metrics: [{ kind: "ai_task", at: nowIso(), caseId, task: "explainFindings", valueMs: f.latencyMs, props: { source: f.source, rejected: f.events.some((e) => ["schema_invalid", "numeric_rejected", "guardrail"].includes(e.kind)) } }],
    }));

    // 2. the plan
    const drafted = await generatePlan(profile, language);
    const now = nowIso();
    const rejected = drafted.events.some((e) => ["schema_invalid", "numeric_rejected", "guardrail"].includes(e.kind));
    await commitLatest(ctx, caseId, (c) => ({
      patch: {
        status: "DRAFT_READY",
        plan: drafted.plan,
        planSource: drafted.source,
        waitingSince: now,
        gen: { ...(c.gen as GenRecord), state: "ready", stage: "done", planMs: drafted.latencyMs, planSource: drafted.source },
      },
      audit: [
        auditOf(ctx, caseId, "ai", "draft_generated", {
          after: `${drafted.plan.items.length} items`,
          evidenceRefs: drafted.plan.items.flatMap((i) => i.evidenceRefs).slice(0, 8),
          disclosuresShown: ["not_final", "earn_banner"],
        }),
        ...f.events.map((e) => auditOf(ctx, caseId, "system", `system_${e.kind}`, { after: `findings: ${e.detail}`, disclosuresShown: ["not_final"] })),
        ...drafted.events.map((e) => auditOf(ctx, caseId, "system", `system_${e.kind}`, { after: e.detail, disclosuresShown: ["not_final"] })),
      ],
      notifications: [],
      metrics: [{ kind: "ai_task", at: now, caseId, task: "draftPlanPack", valueMs: drafted.latencyMs, props: { source: drafted.source, rejected } }],
      planVersion: { plan: drafted.plan, source: drafted.source, reason, createdAt: now },
    }));
    // the adviser hears about the case only now that there is a plan to review
    const done = await ctx.store.getCase(caseId);
    if (done) {
      await ctx.store.addNotifications((await advisers(ctx.store)).map((a) => ({ userId: a.id, kind: done.urgent ? "urgent_case" : "new_case", caseId, params: { name: ctx.user.displayName }, createdAt: now })));
    }
  } catch {
    // never echo the error (it can carry request content); record only that preparation failed
    await commitLatest(ctx, caseId, (c) => ({
      patch: { gen: { ...(c.gen as GenRecord), state: "failed" } },
      audit: [auditOf(ctx, caseId, "system", "system_generation_failed", { after: "plan preparation did not finish", disclosuresShown: ["not_final"] })],
      metrics: [{ kind: "generation_failed", at: nowIso(), caseId }],
    }));
  }
}

/** Starts preparation, waits only a short grace period for a fast generator, and leaves a slow one running. */
async function startGeneration(ctx: Ctx, caseId: string, language: Lang, reason: string): Promise<CaseRec> {
  const job = runGeneration(ctx, caseId, language, reason);
  inflight.add(job);
  void job.finally(() => inflight.delete(job));
  await Promise.race([job, new Promise((r) => setTimeout(r, graceMs()))]);
  return (await ctx.store.getCase(caseId)) as CaseRec;
}

async function newCase(ctx: Ctx, urgent: boolean, language: Lang, agreement: Agreement = {}): Promise<CaseRec> {
  const profile = await ctx.store.getProfile(ctx.user.id);
  if (!profile) return fail(409, "profile_missing");
  if (!agreement.consent?.accepted) return fail(409, "consent_required");
  if (agreement.consent.version !== CONSENT_VERSION) return fail(409, "consent_version");
  const answers = agreement.risk as RiskAnswers | undefined;
  if (!riskComplete(answers)) return fail(409, "risk_incomplete");
  const now = nowIso();
  const scored = scoreRisk(answers, profile, runEngine(profile));
  // Anonymous ids look like "user-fresh-<uuid>": slicing the first characters would give every visitor the SAME case id.
  const id = ctx.user.isSeed ? `case-${ctx.user.persona}` : `case-${ctx.user.id.replace(/^user-fresh-/, "").slice(0, 12)}`;
  const audit: AuditInput[] = [
    auditOf(ctx, id, "user", "consent_recorded", { after: `${CONSENT_VERSION} (demo, not an e-signature)`, disclosuresShown: [...CONSENT_SHOWN, "demo_banner", "earn_banner"] }),
    auditOf(ctx, id, "user", "risk_profile_recorded", { after: scored.category, evidenceRefs: Object.keys(answers), disclosuresShown: ["demo_banner"] }),
    auditOf(ctx, id, "user", "plan_requested", { disclosuresShown: ["demo_banner", "earn_banner"] }),
  ];
  if (urgent) audit.push(auditOf(ctx, id, "user", "panic_escalated", { after: "Priority case after a simulated market fall", disclosuresShown: ["demo_banner"] }));
  // The case exists at once, as INTAKE_DONE ("answers received"), with no plan yet. It is not in the adviser's queue
  // until the plan is ready (see runGeneration).
  await ctx.store.createCase(
    {
      id,
      userId: ctx.user.id,
      status: "INTAKE_DONE",
      urgent,
      planSource: null,
      claimedBy: null,
      claimedAt: null,
      plan: pendingPlan(language),
      planVersion: 0,
      reviews: {},
      checklist: {},
      adviserQuestion: null,
      userReply: null,
      copilot: null,
      gen: { state: "generating", stage: "findings", startedAt: now, attempts: 1 },
      risk: { ...scored, answers: { ...answers }, completedAt: now },
      consent: { at: now, version: CONSENT_VERSION, language, shown: [...CONSENT_SHOWN] },
      acceptedAt: null,
      flagged: false,
      flagNote: null,
      createdAt: now,
      updatedAt: now,
      reviewedAt: null,
      waitingSince: now,
    },
    { audit, metrics: [{ kind: "case_submitted", at: now, caseId: id, props: { urgent } }] },
  );
  return startGeneration(ctx, id, language, "first draft");
}

/**
 * "Try again": for a preparation that failed, or a plan that fell back to pre-written text because the model's answer was
 * rejected. Allowed only before an adviser has started, so nobody's decisions are thrown away.
 */
export async function retryGeneration(ctx: Ctx, caseId: string): Promise<CaseRec> {
  mustCustomer(ctx);
  const c = await caseForViewer(ctx, caseId);
  const failed = c.status === "INTAKE_DONE" && c.gen?.state === "failed";
  const fellBack = c.status === "DRAFT_READY" && c.gen?.state === "ready" && c.planSource === "fixture" && !c.claimedBy && Object.keys(c.reviews).length === 0;
  if (!failed && !fellBack) return fail(409, "invalid_transition");
  const now = nowIso();
  const language = (c.plan.lang ?? ctx.user.language) as Lang;
  await apply(ctx, c, {
    patch: { status: "INTAKE_DONE", gen: { state: "generating", stage: "findings", startedAt: now, attempts: (c.gen?.attempts ?? 1) + 1 } },
    audit: [auditOf(ctx, c.id, "user", "generation_retried", { before: failed ? "failed" : "fallback text", disclosuresShown: ["demo_banner"] })],
    metrics: [{ kind: "generation_retried", at: now, caseId: c.id, props: { after: failed ? "failure" : "fallback" } }],
  });
  return startGeneration(ctx, c.id, language, failed ? "retry after a failure" : "retry after fallback text");
}

/** Ask for a review. Idempotent: a customer has one case. */
export async function submitCase(ctx: Ctx, language: Lang, agreement?: Agreement): Promise<CaseRec> {
  mustCustomer(ctx);
  const existing = await ctx.store.getCaseByUser(ctx.user.id);
  return existing ?? newCase(ctx, false, language, agreement);
}

/** "Talk to my adviser" after a simulated market fall: a priority case (created first if there is none). */
export async function escalate(ctx: Ctx, language: Lang, agreement?: Agreement): Promise<CaseRec> {
  mustCustomer(ctx);
  const existing = await ctx.store.getCaseByUser(ctx.user.id);
  if (!existing) return newCase(ctx, true, language, agreement);
  const now = nowIso();
  const notifications = (await advisers(ctx.store)).map((a) => ({ userId: a.id, kind: "urgent_case", caseId: existing.id, params: { name: ctx.user.displayName }, createdAt: now }));
  return apply(ctx, existing, {
    patch: { urgent: true },
    audit: [auditOf(ctx, existing.id, "user", "panic_escalated", { after: "Priority case after a simulated market fall", disclosuresShown: ["demo_banner"] })],
    notifications,
    metrics: [{ kind: "case_escalated", at: now, caseId: existing.id }],
  });
}

export async function userReply(ctx: Ctx, caseId: string, text: string): Promise<CaseRec> {
  mustCustomer(ctx);
  const c = await caseForViewer(ctx, caseId);
  if (c.status !== "CHANGES_REQUESTED") return fail(409, "invalid_transition");
  const reply = text.trim();
  if (!reply) return fail(400, "empty");
  const g = applyGuardrails(reply, ctx.user.language);
  const now = nowIso();
  const notifications = (await advisers(ctx.store)).map((a) => ({ userId: a.id, kind: "user_replied", caseId: c.id, params: { name: ctx.user.displayName }, createdAt: now }));
  return apply(ctx, c, {
    patch: { status: "DRAFT_READY", userReply: g.hits.length ? g.text : reply, claimedBy: null, claimedAt: null, waitingSince: now },
    audit: [auditOf(ctx, c.id, "user", "user_replied", { before: c.adviserQuestion, after: reply.slice(0, 500), disclosuresShown: ["demo_banner"] })],
    notifications,
    metrics: [{ kind: "reply_received", at: now, caseId: c.id }],
  });
}

/**
 * A customer's question, answered on the server from the profile the server holds. Refusals and rejected live
 * answers are recorded as system audit entries on the customer's case (when they have one).
 */
export async function ask(ctx: Ctx, question: string, language: Lang, rateLimited: boolean): Promise<TaskResult> {
  mustCustomer(ctx);
  const profile = await ctx.store.getProfile(ctx.user.id);
  if (!profile) return fail(409, "profile_missing");
  const result = await generateAnswer(profile, language, question, rateLimited);
  const c = await ctx.store.getCaseByUser(ctx.user.id);
  const now = nowIso();
  const rejected = result.events.some((e) => ["schema_invalid", "numeric_rejected", "guardrail"].includes(e.kind));
  await ctx.store.addMetrics([{ kind: "ai_task", at: now, caseId: c?.id ?? null, task: "answerQuestion", valueMs: result.latencyMs, props: { source: result.source, rejected } }]);
  if (c) for (const e of result.events) await ctx.store.appendAudit(auditOf(ctx, c.id, "system", `system_${e.kind}`, { after: e.detail, disclosuresShown: ["not_final"] }));
  return result;
}

/** A few customer-side events the server records for the audit trail (never free text). */
export async function logUserEvent(ctx: Ctx, kind: "cooling_off_shown"): Promise<void> {
  mustCustomer(ctx);
  const c = await ctx.store.getCaseByUser(ctx.user.id);
  if (c) await ctx.store.appendAudit(auditOf(ctx, c.id, "user", kind, { after: "sell_all_tapped", disclosuresShown: ["demo_banner"] }));
}

// ---------- adviser steps ----------
/** Claim a waiting case. Exactly one adviser can win: the update only applies while the case is still unclaimed. */
export async function claim(ctx: Ctx, caseId: string): Promise<CaseRec> {
  mustAdviser(ctx);
  const c = await mustCase(ctx, caseId);
  if (c.status === "IN_REVIEW" && c.claimedBy === ctx.user.id) return c; // idempotent
  if (c.claimedBy && c.claimedBy !== ctx.user.id) return fail(409, "already_claimed");
  if (c.status !== "DRAFT_READY") return fail(409, "invalid_transition");
  const now = nowIso();
  return apply(ctx, c, {
    patch: { status: "IN_REVIEW", claimedBy: ctx.user.id, claimedAt: now },
    audit: [auditOf(ctx, c.id, "adviser", "case_opened", { before: c.status, after: "IN_REVIEW", disclosuresShown: DEMO })],
    notifications: [{ userId: c.userId, kind: "review_started", caseId: c.id, params: {}, createdAt: now }],
    metrics: [{ kind: "review_started", at: now, caseId: c.id, valueMs: clock.now() - Date.parse(c.waitingSince) }],
  });
}

export async function release(ctx: Ctx, caseId: string): Promise<CaseRec> {
  const c = await mustCase(ctx, caseId);
  mustHold(ctx, c);
  return apply(ctx, c, {
    patch: { status: "DRAFT_READY", claimedBy: null, claimedAt: null },
    audit: [auditOf(ctx, c.id, "adviser", "case_released", { before: "IN_REVIEW", after: "DRAFT_READY", disclosuresShown: DEMO })],
  });
}

const DECISIONS: Decision[] = ["pending", "accepted", "rejected", "edited"];

/** The risk profile as the customer answered it, with the adviser's confirmation taken off (a changed case must be confirmed again). */
function withoutConfirmation(r: NonNullable<CaseRec["risk"]>): NonNullable<CaseRec["risk"]> {
  const copy = { ...r };
  delete copy.confirmedBy;
  delete copy.confirmedByName;
  delete copy.confirmedAt;
  return copy;
}

/** Time the adviser had an item open, added to what was already recorded and capped. Never any text. */
const addDwell = (prev: ItemReview | undefined, ms: number | undefined) => (ms === undefined ? prev?.dwellMs : Math.min(MAX_DWELL_MS, (prev?.dwellMs ?? 0) + Math.max(0, Math.round(ms))));

export async function decideItem(ctx: Ctx, caseId: string, itemId: string, decision: Decision, comment?: string, dwellMs?: number): Promise<CaseRec> {
  const c = await mustCase(ctx, caseId);
  mustHold(ctx, c);
  const item = c.plan.items.find((i) => i.id === itemId);
  if (!item) return fail(404, "item_not_found");
  if (!DECISIONS.includes(decision)) return fail(400, "bad_decision");
  const prev = c.reviews[itemId]?.decision ?? "pending";
  // "edited" can only be set by saving an edit; a comment on an already-edited item may repeat it
  if (decision === "edited" && prev !== "edited") return fail(400, "bad_decision");
  const now = nowIso();
  const text = comment?.trim().slice(0, 500);
  return apply(ctx, c, {
    patch: { reviews: { ...c.reviews, [itemId]: { ...c.reviews[itemId], decision, ...(text !== undefined ? { comment: text } : {}), ...(dwellMs !== undefined ? { dwellMs: addDwell(c.reviews[itemId], dwellMs) } : {}) } } },
    audit: [auditOf(ctx, c.id, "adviser", text !== undefined && decision === prev ? "item_comment" : `item_${decision}`, { before: prev, after: text ?? decision, evidenceRefs: [itemId], disclosuresShown: DEMO })],
    metrics: [{ kind: "item_decision", at: now, caseId: c.id, valueMs: dwellMs === undefined ? null : Math.min(MAX_DWELL_MS, Math.round(dwellMs)), props: { topic: item.topic, decision, adviserId: ctx.user.id } }],
  });
}

/** An adviser's edit passes the same guardrails as AI text; a blocked edit is not saved (but the attempt is audited). */
export async function editItem(ctx: Ctx, caseId: string, itemId: string, text: string, lang: Lang, dwellMs?: number): Promise<{ rec: CaseRec; blocked: boolean }> {
  const c = await mustCase(ctx, caseId);
  mustHold(ctx, c);
  const item = c.plan.items.find((i) => i.id === itemId);
  if (!item) return fail(404, "item_not_found");
  const clean = text.trim();
  if (!clean || clean.length > 1200) return fail(400, "bad_text");
  const g = applyGuardrails(clean, lang);
  const now = nowIso();
  if (g.hits.length) {
    const rec = await apply(ctx, c, {
      patch: {},
      audit: [auditOf(ctx, c.id, "system", "system_guardrail", { after: `adviser_edit_blocked:${g.hits.map((h) => h.category).join("+")}`, evidenceRefs: [itemId] })],
    });
    return { rec, blocked: true };
  }
  const before = c.reviews[itemId]?.edit?.rationale ?? item.rationale;
  const rec = await apply(ctx, c, {
    patch: { reviews: { ...c.reviews, [itemId]: { ...c.reviews[itemId], decision: "edited", edit: { rationale: clean, lang }, ...(dwellMs !== undefined ? { dwellMs: addDwell(c.reviews[itemId], dwellMs) } : {}) } } },
    audit: [auditOf(ctx, c.id, "adviser", "item_edited", { before, after: clean, evidenceRefs: [itemId], disclosuresShown: DEMO })],
    metrics: [{ kind: "item_decision", at: now, caseId: c.id, valueMs: dwellMs === undefined ? null : Math.min(MAX_DWELL_MS, Math.round(dwellMs)), props: { topic: item.topic, decision: "edited", adviserId: ctx.user.id } }],
  });
  return { rec, blocked: false };
}

export async function setChecklist(ctx: Ctx, caseId: string, id: string, value: boolean): Promise<CaseRec> {
  const c = await mustCase(ctx, caseId);
  mustHold(ctx, c);
  if (!(CHECKLIST_IDS as readonly string[]).includes(id)) return fail(400, "bad_checklist_item");
  const audit = [auditOf(ctx, c.id, "adviser", "checklist_set", { after: `${id}:${value ? "ticked" : "cleared"}`, disclosuresShown: DEMO })];
  // "Risk profile confirmed" is only true if there IS a risk profile, and ticking it records who confirmed it and when
  if (id === "risk") {
    if (!c.risk) return fail(409, "risk_incomplete");
    const now = nowIso();
    const rest = withoutConfirmation(c.risk);
    audit.push(auditOf(ctx, c.id, "adviser", value ? "risk_profile_confirmed" : "risk_profile_unconfirmed", { after: c.risk.category, disclosuresShown: DEMO }));
    return apply(ctx, c, {
      patch: { checklist: { ...c.checklist, [id]: value }, risk: value ? { ...rest, confirmedBy: ctx.user.id, confirmedByName: ctx.user.displayName, confirmedAt: now } : rest },
      audit,
    });
  }
  return apply(ctx, c, { patch: { checklist: { ...c.checklist, [id]: value } }, audit });
}

export const checklistComplete = (checklist: Record<string, boolean>) => CHECKLIST_IDS.every((id) => checklist[id]);

export async function approve(ctx: Ctx, caseId: string): Promise<CaseRec> {
  const c = await mustCase(ctx, caseId);
  mustHold(ctx, c);
  // approval is impossible until every item is ticked, including acknowledging the unverified assumptions...
  if (!checklistComplete(c.checklist)) return fail(409, "checklist_incomplete");
  // ...the customer has recorded their (demo) consent, and the risk profile is complete and confirmed by this adviser...
  if (!c.consent) return fail(409, "consent_missing");
  if (!c.risk) return fail(409, "risk_incomplete");
  if (!c.risk.confirmedAt) return fail(409, "risk_not_confirmed");
  // ...and the adviser has acted on EVERY plan item. Nothing is accepted on their behalf.
  if (c.plan.items.some((i) => (c.reviews[i.id]?.decision ?? "pending") === "pending")) return fail(409, "items_pending");
  const now = nowIso();
  const reviews = c.reviews;
  const dwells = c.plan.items.map((i) => reviews[i.id]?.dwellMs).filter((x): x is number => typeof x === "number");
  const edited = c.plan.items.filter((i) => reviews[i.id]?.decision === "edited").length;
  const rejected = c.plan.items.filter((i) => reviews[i.id]?.decision === "rejected").length;
  return apply(ctx, c, {
    patch: { status: "APPROVED", reviewedAt: now, adviserQuestion: null, reviews, acceptedAt: null, flagged: false, flagNote: null },
    audit: [auditOf(ctx, c.id, "adviser", "approved_demo", { before: c.status, after: "APPROVED", disclosuresShown: [...DEMO, "adviser_synthetic", "reviewed_demo"] })],
    notifications: [{ userId: c.userId, kind: "approved", caseId: c.id, params: {}, createdAt: now }],
    metrics: [
      {
        kind: "plan_approved",
        at: now,
        caseId: c.id,
        // review time: from the claim to the approval. First-plan time: from the request to the approval.
        valueMs: clock.now() - Date.parse(c.claimedAt ?? c.createdAt),
        props: {
          items: c.plan.items.length,
          edited,
          rejected,
          corrected: edited + rejected > 0,
          sinceRequestMs: clock.now() - Date.parse(c.createdAt),
          source: c.planSource ?? "mock",
          adviserId: ctx.user.id,
          itemsWithDwell: dwells.length,
          totalDwellMs: dwells.reduce((a, b) => a + b, 0),
        },
      },
    ],
  });
}

export async function returnForInfo(ctx: Ctx, caseId: string, question: string): Promise<CaseRec> {
  const c = await mustCase(ctx, caseId);
  mustHold(ctx, c);
  const q = question.trim().slice(0, 500);
  if (!q) return fail(400, "empty");
  const now = nowIso();
  return apply(ctx, c, {
    patch: { status: "CHANGES_REQUESTED", adviserQuestion: q, claimedBy: null, claimedAt: null },
    audit: [auditOf(ctx, c.id, "adviser", "changes_requested", { before: c.status, after: q, disclosuresShown: DEMO })],
    notifications: [{ userId: c.userId, kind: "changes_requested", caseId: c.id, params: { question: q }, createdAt: now }],
    metrics: [{ kind: "changes_requested", at: now, caseId: c.id, props: { adviserId: ctx.user.id } }],
  });
}

/** The customer accepts the final reviewed plan. Until then it is "Reviewed, awaiting your acceptance". */
export async function acceptPlan(ctx: Ctx, caseId: string): Promise<CaseRec> {
  mustCustomer(ctx);
  const c = await caseForViewer(ctx, caseId);
  if (c.status !== "APPROVED") return fail(409, "invalid_transition");
  if (c.acceptedAt) return c; // idempotent
  const now = nowIso();
  return apply(ctx, c, {
    patch: { acceptedAt: now },
    audit: [auditOf(ctx, c.id, "user", "plan_accepted", { before: "awaiting acceptance", after: "accepted (demo)", disclosuresShown: ["demo_banner", "reviewed_demo"] })],
    notifications: (await advisers(ctx.store)).map((a) => ({ userId: a.id, kind: "plan_accepted", caseId: c.id, params: { name: ctx.user.displayName }, createdAt: now })),
    metrics: [{ kind: "plan_accepted", at: now, caseId: c.id, valueMs: c.reviewedAt ? clock.now() - Date.parse(c.reviewedAt) : null }],
  });
}

/**
 * "Report an error in this plan": the case goes back to an adviser, flagged and urgent, with the customer's note.
 * An approved plan loses its approval (it must be reviewed again); the earlier approval stays in the audit trail.
 */
export async function reportError(ctx: Ctx, caseId: string, note: string): Promise<CaseRec> {
  mustCustomer(ctx);
  const c = await caseForViewer(ctx, caseId);
  const text = note.trim();
  if (!text) return fail(400, "empty");
  const g = applyGuardrails(text, ctx.user.language);
  const clean = (g.hits.length ? g.text : text).slice(0, 500);
  const now = nowIso();
  const wasApproved = c.status === "APPROVED";
  return apply(ctx, c, {
    patch: {
      flagged: true,
      flagNote: clean,
      urgent: true,
      ...(wasApproved
        ? { status: "DRAFT_READY" as const, reviewedAt: null, acceptedAt: null, claimedBy: null, claimedAt: null, reviews: {}, checklist: {}, waitingSince: now, risk: c.risk ? withoutConfirmation(c.risk) : null }
        : {}),
    },
    audit: [auditOf(ctx, c.id, "user", "error_reported", { before: c.status, after: clean, disclosuresShown: ["demo_banner"] })],
    notifications: (await advisers(ctx.store)).map((a) => ({ userId: a.id, kind: "error_reported", caseId: c.id, params: { name: ctx.user.displayName }, createdAt: now })),
    metrics: [{ kind: "error_reported", at: now, caseId: c.id, props: { afterApproval: wasApproved } }],
  });
}

export async function setCopilot(ctx: Ctx, caseId: string, out: CopilotOut): Promise<CaseRec> {
  const c = await mustCase(ctx, caseId);
  mustHold(ctx, c);
  return apply(ctx, c, { patch: { copilot: out } });
}

// ---------- assumption reviews (adviser marks an assumption as reviewed; a demo workflow, not a regulatory approval) ----------
export async function reviewAssumption(ctx: Ctx, assumptionId: string, known: (id: string) => boolean): Promise<void> {
  mustAdviser(ctx);
  if (!known(assumptionId)) fail(404, "unknown_assumption");
  const now = nowIso();
  await ctx.store.upsertAssumptionReview({ assumptionId, byUserId: ctx.user.id, byName: ctx.user.displayName, on: now.slice(0, 10) });
  await ctx.store.appendAudit(auditOf(ctx, null, "adviser", "assumption_reviewed", { chainId: "global:assumptions", after: assumptionId, disclosuresShown: [...DEMO, "adviser_synthetic"] }));
  await ctx.store.addMetrics([{ kind: "assumption_reviewed", at: now, props: { assumptionId } }]);
}

export const STATUS_ORDER: CaseStatus[] = ["INTAKE_DONE", "DRAFT_READY", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"];
