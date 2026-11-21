// "Improve": after the plan, what should the person do next? Rule-based and deterministic.
//  * An ACTION is a planning to-do for one finding, written from a template with figures from the engine. It is a
//    step to plan ("decide a monthly amount"), never an instruction to buy or sell a product, and no model writes it.
//  * When the person updates savings, income, spending or loans, the engine is re-run and the BEFORE and AFTER of the
//    key metrics are written to the audit trail.
//  * Nudges are in-app notifications only. Nothing is sent by email, SMS or WhatsApp.
import { av } from "@/config/assumptions";
import { nudgeRules, runEngine } from "@/lib/engine";
import { formatValue, inr } from "@/lib/format";
import type { EngineFlag, EngineResult, UserProfile } from "@/types";
import { clock, nowIso } from "./config";
import type { ActionRec, ActionStatus, AuditInput, CaseStore, UserRec } from "./store/types";
import { WorkflowError } from "./errors";

const pct = (v: number) => formatValue(v, "percent");
const months = (v: number) => formatValue(v, "months");

type Params = Record<string, string>;
const FLAG_ACTIONS: Record<EngineFlag["id"], (e: EngineResult) => Params> = {
  cash_shortfall: (e) => ({ gap: inr(e.flat["cash.shortfall"]), emi: inr(e.flat["cash.emi"]), income: inr(e.flat["cash.income"]) }),
  cash_tight: (e) => ({ surplus: inr(e.flat["cash.surplus"]), income: inr(e.flat["cash.income"]) }),
  bad_month_stress: (e) => ({ drain: inr(e.flat["inc.badDrain"]), months: months(e.flat["inc.survivableMonths"]), reserve: inr(e.flat["inc.minReserve"]) }),
  ef_low: (e) => ({ gap: inr(e.flat["ef.gap"]), target: months(e.flat["ef.target"]), have: months(e.flat["ef.months"]) }),
  term_gap: (e) => ({ needed: inr(e.flat["ins.term.needed"]), cover: inr(e.flat["ins.term.cover"]) }),
  health_gap: (e) => ({ needed: inr(e.flat["ins.health.needed"]), cover: inr(e.flat["ins.health.cover"]) }),
  high_cost_debt: (e) => ({ rate: pct(e.flat["debt.highCost.rate"]), threshold: pct(e.flat["debt.highCost.threshold"]) }),
  dti_high: (e) => ({ dti: pct(e.flat["debt.dti"]) }),
  savings_low: (e) => ({ rate: pct(e.flat["save.rate"]), target: pct(av("savings.rate_target")) }),
  concentration: (e) => ({ share: pct(e.flat["conc.topSector"]) }),
  overlap_high: (e) => ({ overlap: pct(e.flat["conc.overlap"]) }),
  tip_following: () => ({}),
  irregular_income: () => ({}),
  panic_sell: () => ({}),
};
const RANK = { high: 0, medium: 1, low: 2 } as const;
const MAX_ACTIONS = 6;

export const actionIdFor = (userId: string, findingId: string) => `act-${userId}-${findingId}`;

/** The top findings, most severe first. */
export function topFindings(engine: EngineResult): EngineFlag[] {
  return [...engine.flags].sort((a, b) => RANK[a.severity] - RANK[b.severity]).slice(0, MAX_ACTIONS);
}

/**
 * Makes sure every top finding has an action, and that an action whose finding no longer applies is marked inactive
 * ("resolved by your update"), without losing what the person decided.
 */
export async function syncActions(store: CaseStore, userId: string, profile: UserProfile): Promise<ActionRec[]> {
  const engine = runEngine(profile);
  const top = topFindings(engine);
  const have = new Map((await store.listActions(userId)).map((a) => [a.findingId, a]));
  const now = nowIso();
  const live = new Set<string>(top.map((f) => f.id));
  for (const f of top) {
    const params = FLAG_ACTIONS[f.id](engine);
    const was = have.get(f.id);
    await store.upsertAction({
      id: actionIdFor(userId, f.id),
      userId,
      findingId: f.id,
      severity: f.severity,
      textKey: `act.${f.id}`,
      params,
      status: was?.status ?? "suggested",
      followupOn: was?.followupOn ?? null,
      active: true,
      createdAt: was?.createdAt ?? now,
      updatedAt: was && JSON.stringify(was.params) === JSON.stringify(params) && was.active && was.severity === f.severity ? was.updatedAt : now,
    });
  }
  for (const [id, a] of have) if (!live.has(id) && a.active) await store.upsertAction({ ...a, active: false, updatedAt: now });
  return store.listActions(userId);
}

// ---------- before / after ----------
const KEY_METRICS = ["ef.months", "save.rate", "debt.dti", "health.score"] as const;
export interface MetricChange {
  key: string;
  before: string;
  after: string;
}

const describe = (e: EngineResult) => Object.fromEntries(KEY_METRICS.map((k) => [k, formatValue(e.flat[k], e.units[k])])) as Record<(typeof KEY_METRICS)[number], string>;

/** Savings, income, spending and loans are the inputs the "before / after" is about. */
function moved(a: UserProfile, b: UserProfile): boolean {
  const debt = (p: UserProfile) => JSON.stringify(p.debts.map((d) => [d.outstanding, d.ratePct, d.emi]));
  return a.liquidSavings !== b.liquidSavings || a.monthlyIncome !== b.monthlyIncome || a.essentialExpenses !== b.essentialExpenses || a.otherExpenses !== b.otherExpenses || debt(a) !== debt(b);
}

export async function recordProfileChange(store: CaseStore, user: UserRec, requestId: string, before: UserProfile | null, after: UserProfile): Promise<MetricChange[]> {
  if (!before || !moved(before, after)) return [];
  const b = describe(runEngine(before));
  const a = describe(runEngine(after));
  const changes = KEY_METRICS.filter((k) => a[k] !== b[k]).map((k) => ({ key: k, before: b[k], after: a[k] }));
  const c = await store.getCaseByUser(user.id);
  const entry: AuditInput = {
    chainId: c ? c.id : `user:${user.id}`,
    caseId: c?.id ?? null,
    actorId: user.id,
    actorRole: "customer",
    actor: "user",
    requestId,
    action: "profile_updated",
    before: KEY_METRICS.map((k) => `${k} ${b[k]}`).join("; "),
    after: KEY_METRICS.map((k) => `${k} ${a[k]}`).join("; "),
    disclosuresShown: ["demo_banner"],
    ts: nowIso(),
  };
  await store.appendAudit(entry);
  return changes;
}

// ---------- nudges (in-app notifications only) ----------
const NUDGE_PARAMS: Record<string, (e: EngineResult) => Params> = {
  cash_flow: (e) => ({ gap: inr(e.flat["cash.shortfall"]), surplus: inr(Math.max(0, e.flat["cash.surplus"])) }),
  ef_low: (e) => ({ have: months(e.flat["ef.months"]), target: months(e.flat["ef.target"]) }),
  insurance_gap: () => ({}),
  sip_review: () => ({}),
  rebalance: (e) => ({ share: pct(e.flat["conc.topSector"]) }),
};

/** A nudge for a rule is raised once per 24 hours, and only as a notification inside the app. */
export async function raiseNudges(store: CaseStore, userId: string, profile: UserProfile): Promise<void> {
  const engine = runEngine(profile);
  const recent = await store.listNotifications(userId, 50);
  const day = 24 * 3_600_000;
  const fresh: Parameters<CaseStore["addNotifications"]>[0] = [];
  for (const r of nudgeRules(profile, engine)) {
    const kind = `nudge_${r.ruleId}`;
    if (recent.some((n) => n.kind === kind && clock.now() - Date.parse(n.createdAt) < day)) continue;
    fresh.push({ userId, kind, caseId: null, params: NUDGE_PARAMS[r.ruleId](engine), createdAt: nowIso() });
  }
  if (fresh.length) await store.addNotifications(fresh);
}

// ---------- the person's own step on an action ----------
const STATUSES: ActionStatus[] = ["suggested", "planned", "done", "skipped"];
const dayMs = 86_400_000;

export function validFollowup(v: string, now = clock.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== v) return false;
  return t >= now - 2 * dayMs && t <= now + 2 * 365 * dayMs;
}

export async function updateAction(store: CaseStore, user: UserRec, requestId: string, id: string, patch: { status?: ActionStatus; followupOn?: string | null }): Promise<ActionRec> {
  const a = (await store.listActions(user.id)).find((x) => x.id === id);
  if (!a) throw new WorkflowError(404, "not_found"); // never reveal another person's action
  if (patch.status && !STATUSES.includes(patch.status)) throw new WorkflowError(400, "bad_status");
  if (patch.followupOn && !validFollowup(patch.followupOn)) throw new WorkflowError(400, "bad_date");
  const next: ActionRec = { ...a, status: patch.status ?? a.status, followupOn: patch.followupOn === undefined ? a.followupOn : patch.followupOn, updatedAt: nowIso() };
  // planning a step without a date gives it a default follow-up two weeks out
  if (next.status === "planned" && !next.followupOn) next.followupOn = new Date(clock.now() + 14 * dayMs).toISOString().slice(0, 10);
  await store.upsertAction(next);
  const c = await store.getCaseByUser(user.id);
  await store.appendAudit({
    chainId: c ? c.id : `user:${user.id}`,
    caseId: c?.id ?? null,
    actorId: user.id,
    actorRole: "customer",
    actor: "user",
    requestId,
    action: "action_updated",
    before: `${a.findingId}: ${a.status}${a.followupOn ? ` (follow up ${a.followupOn})` : ""}`,
    after: `${a.findingId}: ${next.status}${next.followupOn ? ` (follow up ${next.followupOn})` : ""}`,
    disclosuresShown: ["demo_banner"],
    ts: nowIso(),
  });
  return next;
}
