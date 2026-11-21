// The suitability gate of the demo workflow: consent and a risk profile BEFORE a case enters the queue; every plan item
// acted on, and the risk profile confirmed by the adviser, BEFORE approval; the customer accepts the reviewed plan or
// reports an error; the metrics page can warn about rubber-stamping. All of it is a demo workflow, not a regulated process.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONSENT_VERSION, MAX_DWELL_MS, RUBBER_STAMP_MEDIAN_MS } from "@/config/workflow";
import { changeSummary } from "@/lib/cases";
import { summariseMetrics } from "@/server/metrics";
import { setStoreForTests } from "@/server/store";
import type { MetricRec } from "@/server/store/types";
import { actOnAll, ALL_CHECKLIST, expectOk, makeApp, readyToApprove, submitBody, type Client } from "./server-helpers";

let app: Awaited<ReturnType<typeof makeApp>>;
beforeEach(async () => {
  app = await makeApp();
});
afterEach(() => setStoreForTests(null));

const caseId = "case-priya";

describe("consent and the risk questionnaire come before a case can exist", () => {
  it("refuses a case without consent, with the wrong version, or with an incomplete questionnaire, and creates nothing", async () => {
    const priya = await app.priya();
    const ok = submitBody();
    const cases: [string, unknown, string][] = [
      ["no agreement at all", { language: "en" }, "consent_required"],
      ["consent not accepted", { ...ok, consent: { accepted: false, version: CONSENT_VERSION } }, "consent_required"],
      ["an old consent version", { ...ok, consent: { accepted: true, version: "demo-0" } }, "consent_version"],
      ["no questionnaire", { language: "en", consent: ok.consent }, "risk_incomplete"],
      ["five of six answers", { ...ok, risk: { cushion: 1, fall: 1, swing: 1, horizon: 1, years: 1 } }, "risk_incomplete"],
    ];
    for (const [label, body, error] of cases) {
      const r = await priya.post("cases", body);
      expect(r.status, label).toBe(409);
      expect(r.body.error, label).toBe(error);
    }
    expect((await priya.get("me")).body.case).toBeNull();
    // out-of-range or unknown answers never even reach the workflow
    expect((await priya.post("cases", { ...ok, risk: { ...ok.risk, cushion: 7 } })).status).toBe(400);
    expect((await priya.post("cases", { ...ok, consent: { ...ok.consent, signature: "x" } })).status).toBe(400);
  });

  it("records the consent and the profile with the case, and both are in the audit chain before the draft", async () => {
    const priya = await app.priya();
    const made = await priya.post("cases", submitBody());
    expect(made.status).toBe(200);
    const c = made.body.case;
    expect(c.consent).toMatchObject({ version: CONSENT_VERSION, language: "en" });
    expect(c.consent.shown).toEqual(expect.arrayContaining(["fee", "conflicts", "demo", "no_esign", "data"]));
    expect(c.risk.category).toBeTruthy();
    expect(c.risk.answers).toEqual(submitBody().risk);
    expect(c.risk.confirmedAt).toBeUndefined();

    const detail = (await priya.get(`cases/${caseId}`)).body;
    const actions = detail.audit.map((a: { action: string }) => a.action);
    expect(actions.indexOf("consent_recorded")).toBeGreaterThanOrEqual(0);
    expect(actions.indexOf("consent_recorded")).toBeLessThan(actions.indexOf("draft_generated"));
    expect(actions).toEqual(expect.arrayContaining(["risk_profile_recorded", "plan_requested"]));
    expect(detail.audit.find((a: { action: string }) => a.action === "consent_recorded").after).toMatch(/not an e-signature/);
    expect(detail.chain.ok).toBe(true);
  });

  it("a priority case from the market-fall screen needs the same agreement; an existing case does not", async () => {
    const priya = await app.priya();
    expect((await priya.post("cases/escalate", { language: "en" })).body.error).toBe("consent_required");
    expect((await priya.post("cases/escalate", submitBody())).status).toBe(200);
    // already has a case: just flags it as urgent
    expect((await priya.post("cases/escalate", { language: "en" })).status).toBe(200);
  });

  it("the seeded waiting cases carry a risk profile and consent that say nobody gave them", async () => {
    const adviser = await app.as("adviser");
    for (const id of ["case-ramesh", "case-anita"]) {
      const c = (await adviser.get(`cases/${id}`)).body.case;
      expect(c.risk.seeded).toBe(true);
      expect(c.consent.seeded).toBe(true);
    }
  });
});

describe("the adviser confirms the risk profile, and cannot approve without it", () => {
  async function claimed() {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    return { priya, adviser };
  }

  it("ticking 'risk profile confirmed' records who and when; clearing it removes the confirmation", async () => {
    const { adviser } = await claimed();
    const ticked = await adviser.post(`cases/${caseId}/checklist`, { id: "risk", value: true });
    expect(ticked.body.case.risk.confirmedAt).toBeTruthy();
    expect(ticked.body.case.risk.confirmedByName).toMatch(/adviser/i);
    const cleared = await adviser.post(`cases/${caseId}/checklist`, { id: "risk", value: false });
    expect(cleared.body.case.risk.confirmedAt).toBeUndefined();
    const actions = (await adviser.get(`cases/${caseId}`)).body.audit.map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["risk_profile_confirmed", "risk_profile_unconfirmed"]));
  });

  it("approval is refused when there is no risk profile or no consent, even with a full checklist", async () => {
    const { adviser } = await claimed();
    await actOnAll(adviser, caseId);
    for (const id of ALL_CHECKLIST) expectOk(await adviser.post(`cases/${caseId}/checklist`, { id, value: true }));
    const rec = (await app.store.getCase(caseId))!;

    await app.store.commit({ caseId, expectedVersion: rec.version, patch: { risk: null } });
    expect((await adviser.post(`cases/${caseId}/approve`)).body.error).toBe("risk_incomplete");

    const again = (await app.store.getCase(caseId))!;
    await app.store.commit({ caseId, expectedVersion: again.version, patch: { risk: rec.risk, consent: null } });
    expect((await adviser.post(`cases/${caseId}/approve`)).body.error).toBe("consent_missing");

    // risk present but never confirmed by the adviser (the checklist box says ticked, the record says otherwise)
    const third = (await app.store.getCase(caseId))!;
    const { confirmedAt, ...unconfirmed } = rec.risk!;
    void confirmedAt;
    await app.store.commit({ caseId, expectedVersion: third.version, patch: { risk: unconfirmed, consent: rec.consent } });
    expect((await adviser.post(`cases/${caseId}/approve`)).body.error).toBe("risk_not_confirmed");
  });

  it("a risk confirmation can only be set where there is a risk profile", async () => {
    const { adviser } = await claimed();
    const rec = (await app.store.getCase(caseId))!;
    await app.store.commit({ caseId, expectedVersion: rec.version, patch: { risk: null } });
    expect((await adviser.post(`cases/${caseId}/checklist`, { id: "risk", value: true })).body.error).toBe("risk_incomplete");
  });
});

describe("every plan item needs a decision, and the time spent on it is recorded as a number only", () => {
  it("does not accept items on the adviser's behalf", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    for (const id of ALL_CHECKLIST) expectOk(await adviser.post(`cases/${caseId}/checklist`, { id, value: true }));
    const r = await adviser.post(`cases/${caseId}/approve`);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("items_pending");
    const c = (await adviser.get(`cases/${caseId}`)).body.case;
    expect(Object.values(c.reviews).every((x) => (x as { decision: string }).decision === "pending" || x === undefined)).toBe(true);
  });

  it("records dwell on a decision and on an edit, capped, and in the metrics as valueMs", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    const [a, b] = (await adviser.get(`cases/${caseId}`)).body.case.plan.items;

    const d = await adviser.post(`cases/${caseId}/items/${a.id}/decide`, { decision: "accepted", dwellMs: 12_000 });
    expect(d.body.case.reviews[a.id].dwellMs).toBe(12_000);
    const e = await adviser.post(`cases/${caseId}/items/${b.id}/edit`, { text: "Build the reserve first, in liquid options, for discussion.", lang: "en", dwellMs: 99_999_999 });
    expect(e.status).toBe(400); // beyond what one request may claim
    const e2 = await adviser.post(`cases/${caseId}/items/${b.id}/edit`, { text: "Build the reserve first, in liquid options, for discussion.", lang: "en", dwellMs: 3_000_000 });
    expect(e2.body.case.reviews[b.id].dwellMs).toBe(MAX_DWELL_MS); // 50 minutes is credited as the cap
    expect((await adviser.post(`cases/${caseId}/items/${a.id}/decide`, { decision: "accepted", dwellMs: -5 })).status).toBe(400);

    const events = (await app.store.listMetrics()).filter((x) => x.kind === "item_decision");
    expect(events.map((x) => x.valueMs)).toEqual(expect.arrayContaining([12_000, MAX_DWELL_MS]));
    expect(JSON.stringify(events)).not.toMatch(/Build the reserve|Priya/); // numbers only, never text
  });

  it("approval time and total dwell reach the metrics event", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    await readyToApprove(adviser, caseId);
    expectOk(await adviser.post(`cases/${caseId}/approve`));
    const ev = (await app.store.listMetrics()).find((x) => x.kind === "plan_approved")!;
    expect(ev.valueMs).toBeGreaterThanOrEqual(0);
    expect(ev.props.itemsWithDwell).toBeGreaterThan(0);
    expect(ev.props.totalDwellMs).toBeGreaterThan(0);
  });
});

describe("the customer accepts the reviewed plan, or reports an error in it", () => {
  async function approved() {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    await readyToApprove(adviser, caseId);
    expectOk(await adviser.post(`cases/${caseId}/approve`));
    return { priya, adviser };
  }

  it("is 'awaiting acceptance' until the customer accepts, once, and the adviser is told", async () => {
    const { priya, adviser } = await approved();
    const before = (await priya.get("me")).body.case;
    expect(before.status).toBe("APPROVED");
    expect(before.acceptedAt).toBeUndefined();

    const accepted = await priya.post(`cases/${caseId}/accept`);
    expect(accepted.body.case.acceptedAt).toBeTruthy();
    const first = accepted.body.case.acceptedAt;
    expect((await priya.post(`cases/${caseId}/accept`)).body.case.acceptedAt).toBe(first); // idempotent
    const kinds = (await adviser.get("notifications")).body.notifications.map((n: { kind: string }) => n.kind);
    expect(kinds).toContain("plan_accepted");
    const actions = (await priya.get(`cases/${caseId}`)).body.audit.map((a: { action: string }) => a.action);
    expect(actions).toContain("plan_accepted");
  });

  it("only the owner accepts, and only an approved plan", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    expect((await priya.post(`cases/${caseId}/accept`)).status).toBe(409); // not reviewed yet
    const adviser = await app.as("adviser");
    expect((await adviser.post(`cases/${caseId}/accept`)).status).toBe(403);
    const other = await app.as("fresh");
    expect((await other.post(`cases/${caseId}/accept`)).status).toBe(404);
  });

  it("'Report an error' puts the plan back with an adviser, flagged, with an audit entry, and a fresh review is needed", async () => {
    const { priya, adviser } = await approved();
    expectOk(await priya.post(`cases/${caseId}/accept`));
    const r = await priya.post(`cases/${caseId}/report-error`, { note: "My rent is not in the essential costs." });
    expect(r.status).toBe(200);
    const c = r.body.case;
    expect(c).toMatchObject({ status: "DRAFT_READY", flagged: true, urgent: true });
    expect(c.flagNote).toMatch(/rent/);
    expect(c.acceptedAt).toBeUndefined();
    expect(c.reviewedAt).toBeUndefined();
    expect(c.risk.confirmedAt).toBeUndefined(); // the adviser must confirm again
    expect(Object.keys(c.reviews)).toHaveLength(0);

    const audit = (await priya.get(`cases/${caseId}`)).body;
    const entry = audit.audit.find((a: { action: string }) => a.action === "error_reported");
    expect(entry.after).toMatch(/rent/);
    expect(audit.audit.some((a: { action: string }) => a.action === "approved_demo")).toBe(true); // the earlier approval is still on record
    expect(audit.chain.ok).toBe(true);
    expect((await adviser.get("notifications")).body.notifications.map((n: { kind: string }) => n.kind)).toContain("error_reported");
    expect((await adviser.get("cases")).body.queue.find((x: { id: string }) => x.id === caseId).flagged).toBe(true);

    // the adviser reviews again, and the flag clears on the new approval
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    expect((await adviser.post(`cases/${caseId}/approve`)).status).toBe(409); // nothing carried over
    await readyToApprove(adviser, caseId);
    const again = await adviser.post(`cases/${caseId}/approve`);
    expect(again.body.case).toMatchObject({ status: "APPROVED", flagged: false });
  });

  it("an empty note is refused, and a stock tip in the note is replaced by the guardrail", async () => {
    const { priya } = await approved();
    expect((await priya.post(`cases/${caseId}/report-error`, { note: "   " })).status).toBe(400);
    const r = await priya.post(`cases/${caseId}/report-error`, { note: "Please buy HDFC Bank shares now, guaranteed returns" });
    expect(r.status).toBe(200);
    expect(r.body.case.flagNote).not.toMatch(/guaranteed returns|HDFC/i);
  });

  it("a customer cannot report an error on someone else's case", async () => {
    await approved();
    const other = await app.as("fresh");
    expect((await other.post(`cases/${caseId}/report-error`, { note: "x" })).status).toBe(404);
  });
});

describe("the rubber-stamping heuristic (a demo heuristic, stated and arguable)", () => {
  const T0 = "2026-01-01T00:00:00.000Z";
  const approvedBy = (id: string, ms: number): MetricRec => ({ id: Math.random().toString(), kind: "plan_approved", at: T0, caseId: null, task: null, valueMs: ms, props: { adviserId: id } });
  const returnedBy = (id: string): MetricRec => ({ id: Math.random().toString(), kind: "changes_requested", at: T0, caseId: null, task: null, valueMs: null, props: { adviserId: id } });
  const run = (e: MetricRec[]) => summariseMetrics(e, 0, T0).rubberStamp;

  it("flags many fast approvals and nothing returned", () => {
    const r = run(Array.from({ length: 6 }, () => approvedBy("a", 30_000)));
    expect(r.flagged).toBe(true);
    expect(r.advisers[0]).toMatchObject({ decisions: 6, approvalRate: 1, flagged: true });
    expect(r.rule).toMatchObject({ approvalRate: 0.95, minDecisions: 5 });
  });

  it("does not flag a small sample, slow reviews, or an adviser who returns cases", () => {
    expect(run(Array.from({ length: 4 }, () => approvedBy("a", 30_000))).flagged).toBe(false); // under the minimum number of decisions
    expect(run(Array.from({ length: 8 }, () => approvedBy("a", RUBBER_STAMP_MEDIAN_MS + 60_000))).flagged).toBe(false); // slow enough
    const mixed = [...Array.from({ length: 9 }, () => approvedBy("a", 30_000)), returnedBy("a")]; // 90% approved
    expect(run(mixed).flagged).toBe(false);
  });

  it("judges each adviser separately and labels them without names", () => {
    const r = run([...Array.from({ length: 6 }, () => approvedBy("a", 30_000)), ...Array.from({ length: 6 }, () => approvedBy("b", 600_000))]);
    expect(r.advisers.map((x) => x.flagged)).toEqual([true, false]);
    expect(r.advisers.map((x) => x.label)).toEqual(["Adviser 1", "Adviser 2"]);
  });

  it("reaches the adviser-only metrics endpoint, with the dwell and acceptance figures", async () => {
    const adviser = await app.as("adviser");
    const m = (await adviser.get("metrics")).body;
    expect(m.rubberStamp.rule.approvalRate).toBe(0.95);
    expect(m.itemDwell).toBeDefined();
    expect(m.acceptance).toMatchObject({ approved: 0, accepted: 0, errorsReported: 0 });
    expect((await (await app.as("priya")).get("metrics")).status).toBe(403);
  });
});

describe("'What the adviser changed' in plain language", () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
  const plan = (n: number) => ({ items: items(n) }) as never;

  it("counts changed and removed items out of the total", () => {
    const reviews = { p0: { decision: "edited" }, p1: { decision: "edited" }, p2: { decision: "rejected" }, p3: { decision: "accepted" } } as never;
    expect(changeSummary({ plan: plan(7), reviews })).toEqual({ total: 7, changed: 2, removed: 1 });
  });
  it("says nothing changed when everything was accepted", () => {
    const reviews = Object.fromEntries(items(3).map((i) => [i.id, { decision: "accepted" }])) as never;
    expect(changeSummary({ plan: plan(3), reviews })).toEqual({ total: 3, changed: 0, removed: 0 });
  });
});

describe("a client can act as itself only", () => {
  it("the adviser helper signs in as the adviser", async () => {
    const adviser: Client = await app.as("adviser");
    expect((await adviser.get("me")).body.user.role).toBe("adviser");
  });
});
