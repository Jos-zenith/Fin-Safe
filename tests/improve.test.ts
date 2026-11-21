// "Improve": actions per finding, follow-up dates, before/after with audit, and in-app nudges.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PRIYA } from "@/data/personas";
import { checkGuardrails } from "@/lib/ai/guardrails";
import { runEngine } from "@/lib/engine";
import { clock } from "@/server/config";
import { setStoreForTests } from "@/server/store";
import { validFollowup } from "@/server/improve";
import { expectOk, makeApp, submitBody } from "./server-helpers";
import { en, hi, ta } from "./helpers";

let app: Awaited<ReturnType<typeof makeApp>>;
const realNow = clock.now;
beforeEach(async () => {
  clock.now = realNow;
  app = await makeApp();
});
afterEach(() => {
  clock.now = realNow;
  setStoreForTests(null);
});

const FLAG_IDS = ["ef_low", "term_gap", "health_gap", "high_cost_debt", "dti_high", "savings_low", "concentration", "overlap_high", "tip_following", "irregular_income", "panic_sell"];

describe("action text is a planning step with engine figures, never a product instruction", () => {
  for (const [name, d] of [["en", en], ["hi", hi], ["ta", ta]] as const) {
    it(`${name}: every flag has a template, no literal numbers, nothing the guardrails would block`, () => {
      const dict = d as unknown as Record<string, string>;
      for (const id of FLAG_IDS) {
        const t = dict[`act.${id}`];
        expect(t, `${name} act.${id}`).toBeTruthy();
        expect(t.replace(/\{\w+\}/g, ""), `${name} act.${id} has a digit`).not.toMatch(/[0-9०-९௦-௯]/);
        // fill the placeholders with plain figures and run the safety rules
        const filled = t.replace(/\{\w+\}/g, "₹1,000");
        expect(checkGuardrails(filled), `${name} act.${id}`).toEqual([]);
      }
    });
  }
});

describe("actions per finding", () => {
  it("are created from the top findings, with figures taken from the engine, and start as 'suggested'", async () => {
    const priya = await app.priya();
    const { actions } = (await priya.get("me/actions")).body;
    const engine = runEngine(PRIYA);
    const top = engine.flags.filter((f) => f.severity !== "low").map((f) => f.id);
    for (const id of top) expect(actions.map((a: { findingId: string }) => a.findingId)).toContain(id);
    expect(actions.length).toBeLessThanOrEqual(6);
    const ef = actions.find((a: { findingId: string }) => a.findingId === "ef_low");
    expect(ef.status).toBe("suggested");
    expect(ef.textKey).toBe("act.ef_low");
    expect(ef.params.have).toBe("1.8"); // the engine's 1.8 months
    expect(ef.params.gap).toMatch(/^₹[\d,]+$/);
    expect(ef.followupOn).toBeNull();
    expect(ef.active).toBe(true);
    // stored on the server, not in the browser
    expect((await app.store.listActions("user-priya")).length).toBe(actions.length);
  });

  it("a customer plans, completes and skips steps; a plan gets a default follow-up date; everything is audited", async () => {
    const priya = await app.priya();
    const [first, second] = (await priya.get("me/actions")).body.actions;
    const t0 = realNow() + 3 * 3_600_000; // within the session
    clock.now = () => t0;
    const day = (n: number) => new Date(t0 + n * 86_400_000).toISOString().slice(0, 10);
    const planned = (await priya.post(`me/actions/${first.id}`, { status: "planned" })).body.action;
    expect(planned.status).toBe("planned");
    expect(planned.followupOn).toBe(day(14)); // two weeks out
    expect((await priya.post(`me/actions/${first.id}`, { followupOn: day(30) })).body.action.followupOn).toBe(day(30));
    expect((await priya.post(`me/actions/${first.id}`, { status: "done" })).body.action.status).toBe("done");
    expect((await priya.post(`me/actions/${second.id}`, { status: "skipped" })).body.action.status).toBe("skipped");
    const { changes } = (await priya.get("me/actions")).body;
    expect(changes.filter((c: { action: string }) => c.action === "action_updated").length).toBe(4);
    expect((await app.store.verifyChain("user:user-priya")).ok).toBe(true);
  });

  it("rejects an unknown status, a malformed or far-off date, another person's action, and an adviser", async () => {
    const priya = await app.priya();
    const anita = await app.as("anita");
    await anita.put("me/profile", (await app.store.getProfile("user-anita"))!);
    const id = (await priya.get("me/actions")).body.actions[0].id;
    expect((await priya.post(`me/actions/${id}`, { status: "finished" })).status).toBe(400);
    expect((await priya.post(`me/actions/${id}`, { followupOn: "tomorrow" })).status).toBe(400);
    expect((await priya.post(`me/actions/${id}`, { followupOn: "2999-01-01" })).status).toBe(400);
    expect((await priya.post(`me/actions/${id}`, { followupOn: "2026-02-30" })).status).toBe(400);
    expect((await priya.post(`me/actions/${id}`, { extra: 1 })).status).toBe(400);
    expect((await anita.post(`me/actions/${id}`, { status: "done" })).status).toBe(404); // not revealed
    const adviser = await app.as("adviser");
    expect((await adviser.post(`me/actions/${id}`, { status: "done" })).status).toBe(403);
    expect((await adviser.get("me/actions")).status).toBe(403);
    expect((await app.client("anon").get("me/actions")).status).toBe(401);
    expect(validFollowup("2026-03-01", Date.UTC(2026, 2, 1))).toBe(true);
    expect(validFollowup("2026-02-27", Date.UTC(2026, 2, 1))).toBe(true); // up to a day or two back is fine
    expect(validFollowup("2020-01-01", Date.UTC(2026, 2, 1))).toBe(false);
  });
});

describe("before and after when the person updates savings or loans", () => {
  it("re-runs the engine, returns the before/after, writes both to the audit trail, and keeps the chain valid", async () => {
    const priya = await app.priya();
    const profile = (await app.store.getProfile("user-priya"))!;
    const r = await priya.put("me/profile", { ...profile, liquidSavings: 300000 });
    expect(r.status).toBe(200);
    const ef = r.body.changes.find((c: { key: string }) => c.key === "ef.months");
    expect(ef.before).toBe("1.8");
    expect(Number(ef.after)).toBeGreaterThan(Number(ef.before));
    const { changes } = (await priya.get("me/actions")).body;
    const entry = changes.find((c: { action: string }) => c.action === "profile_updated");
    expect(entry.before).toMatch(/ef\.months 1\.8/);
    expect(entry.after).toMatch(/ef\.months/);
    expect(entry.actorRole).toBe("customer");
    expect((await app.store.verifyChain("user:user-priya")).ok).toBe(true);
  });

  it("goes to the case's chain once there is a case, and a finding that no longer applies becomes inactive", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const profile = (await app.store.getProfile("user-priya"))!;
    expectOk(await priya.put("me/profile", { ...profile, liquidSavings: 900000 }));
    const audit = await app.store.listAudit("case-priya");
    expect(audit.map((a) => a.action)).toContain("profile_updated");
    expect((await app.store.verifyChain("case-priya")).ok).toBe(true);
    const { actions } = (await priya.get("me/actions")).body;
    expect(actions.find((a: { findingId: string }) => a.findingId === "ef_low").active).toBe(false);
  });

  it("does nothing (and writes no audit) when an unrelated field changes", async () => {
    const priya = await app.priya();
    const profile = (await app.store.getProfile("user-priya"))!;
    const before = (await app.store.listAudit("user:user-priya")).length;
    expectOk(await priya.put("me/profile", { ...profile, name: "Someone else", city: "Pune" }));
    expect((await app.store.listAudit("user:user-priya")).length).toBe(before);
  });
});

describe("nudges are in-app notifications only", () => {
  it("are raised from rules when the profile is saved, once a day, and never through any other channel", async () => {
    const priya = await app.priya();
    const kinds = () => app.store.listNotifications("user-priya", 50).then((n) => n.map((x) => x.kind));
    const first = await kinds();
    expect(first).toEqual(expect.arrayContaining(["nudge_ef_low", "nudge_insurance_gap"]));
    const count = first.length;
    expectOk(await priya.put("me/profile", (await app.store.getProfile("user-priya"))!));
    expect((await kinds()).length).toBe(count); // not repeated within the day
    clock.now = () => realNow() + 25 * 3_600_000;
    await priya.signIn("priya"); // the old session has expired by now
    expectOk(await priya.put("me/profile", (await app.store.getProfile("user-priya"))!));
    expect((await kinds()).length).toBeGreaterThan(count);
    // the text lives in the UI dictionary; the notification carries only figures
    const n = (await app.store.listNotifications("user-priya", 5))[0];
    expect(n.kind).toMatch(/^nudge_/);
    for (const d of [en, hi, ta] as unknown as Record<string, string>[]) expect(d[`notif.${n.kind}`], n.kind).toBeTruthy();
  });

  it("every nudge kind has text in every language, with no literal numbers", () => {
    for (const rule of ["ef_low", "insurance_gap", "sip_review", "rebalance"]) {
      for (const d of [en, hi, ta] as unknown as Record<string, string>[]) {
        const t = d[`notif.nudge_${rule}`];
        expect(t, rule).toBeTruthy();
        expect(t.replace(/\{\w+\}/g, "")).not.toMatch(/[0-9०-९௦-௯]/);
      }
    }
  });
});

describe("deleting or resetting removes the person's actions and their own audit chain", () => {
  it("'Delete my demo data' leaves no action rows or user-chain entries", async () => {
    const fresh = app.client("fresh");
    await fresh.signIn("fresh");
    const me = (await fresh.get("me")).body.user;
    expectOk(await fresh.put("me/profile", { ...PRIYA, id: me.id }));
    await fresh.get("me/actions");
    expect((await app.store.listActions(me.id)).length).toBeGreaterThan(0);
    expectOk(await fresh.post("me/delete"));
    expect(await app.store.listActions(me.id)).toEqual([]);
    expect(await app.store.listAudit(`user:${me.id}`)).toEqual([]);
  });
});
