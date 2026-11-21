// Plan generation is asynchronous: creating a case answers at once, the findings appear first and the plan second, each
// is timed on its own, the case is not in the adviser's queue until the plan is ready, and a failure or a fallback to
// pre-written text offers a retry. Nothing here needs a real model: slow and failing generators stand in for one.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aiStats, RECENT_N } from "@/lib/ai/stats";
import { localFixture } from "@/lib/ai/run";
import { setFindingsGeneratorForTests, setPlanGeneratorForTests } from "@/server/plan";
import { setStoreForTests } from "@/server/store";
import { settleGenerations } from "@/server/workflow";
import type { UserProfile } from "@/types";
import { expectOk, makeApp, submitBody } from "./server-helpers";

let app: Awaited<ReturnType<typeof makeApp>>;
const caseId = "case-priya";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  process.env.PLAN_GRACE_MS = "10"; // a generator slower than this is left to finish in the background
  app = await makeApp();
  aiStats.reset();
});
afterEach(async () => {
  await settleGenerations();
  setPlanGeneratorForTests(null);
  setFindingsGeneratorForTests(null);
  delete process.env.PLAN_GRACE_MS;
  setStoreForTests(null);
});

const slowPlan = (ms: number, source: "mock" | "provider" | "fixture" = "provider") => async (profile: UserProfile, language: "en" | "hi" | "ta") => {
  await sleep(ms);
  return { plan: localFixture({ task: "draftPlanPack", language, profile }) as never, source, latencyMs: ms, events: [] };
};
const slowFindings = (ms: number) => async (profile: UserProfile, language: "en" | "hi" | "ta") => {
  await sleep(ms);
  const f = localFixture({ task: "explainFindings", language, profile }) as { findings: Record<string, string> };
  return { findings: f.findings, source: "provider" as const, latencyMs: ms, events: [] };
};

describe("a fast generator: the case is ready when the reply comes back", () => {
  it("returns a prepared case with the findings, the plan and a timing for each section", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    await settleGenerations(); // the grace window is short on purpose; wait for the background work explicitly
    const c = (await priya.get("me")).body.case;
    expect(c.status).toBe("DRAFT_READY");
    expect(c.gen).toMatchObject({ state: "ready", stage: "done", attempts: 1, findingsSource: "mock", planSource: "mock" });
    expect(c.gen.findings.ef).toBeTruthy(); // the findings are stored with the case
    expect(typeof c.gen.findingsMs).toBe("number");
    expect(typeof c.gen.planMs).toBe("number");
    expect(c.plan.items.length).toBeGreaterThan(0);
    expect(c.planVersion).toBe(1);
    const tasks = (await app.store.listMetrics()).filter((e) => e.kind === "ai_task").map((e) => e.task);
    expect(tasks).toEqual(expect.arrayContaining(["explainFindings", "draftPlanPack"]));
    expect((await app.store.listMetrics()).filter((e) => e.kind === "ai_task").every((e) => typeof e.valueMs === "number")).toBe(true);
  });
});

describe("a slow generator: the reply is immediate and the plan arrives in the background", () => {
  it("answers at once with a case that is still being prepared and is not in the adviser's queue", async () => {
    setFindingsGeneratorForTests(slowFindings(120));
    setPlanGeneratorForTests(slowPlan(120));
    const priya = await app.priya();
    const adviser = await app.as("adviser");
    const t0 = Date.now();
    const r = await priya.post("cases", submitBody());
    expect(Date.now() - t0).toBeLessThan(200); // it did not wait for the 240 ms of generation
    const c = r.body.case;
    expect(c.status).toBe("INTAKE_DONE");
    expect(c.gen).toMatchObject({ state: "generating", stage: "findings" });
    expect(c.plan.items).toHaveLength(0);

    // the adviser neither sees it in the queue nor can claim it, and nothing has been announced to them yet
    expect((await adviser.get("cases")).body.queue.map((x: { id: string }) => x.id)).not.toContain(caseId);
    expect((await adviser.post(`cases/${caseId}/claim`)).status).toBe(409);
    expect((await adviser.get("notifications")).body.notifications.map((n: { kind: string }) => n.kind)).not.toContain("new_case");
    // the customer can see their own case while it is being prepared
    expect((await priya.get("me")).body.case.gen.state).toBe("generating");
  });

  it("the findings appear before the plan, then the case enters the queue and the adviser is told", async () => {
    setFindingsGeneratorForTests(slowFindings(60));
    setPlanGeneratorForTests(slowPlan(260));
    const priya = await app.priya();
    const adviser = await app.as("adviser");
    expectOk(await priya.post("cases", submitBody()));
    await sleep(140); // the findings (60 ms) are done, the plan (260 ms) is not
    const mid = (await priya.get("me")).body.case;
    expect(mid.gen).toMatchObject({ state: "generating", stage: "plan", findingsSource: "provider" });
    expect(mid.gen.findings.ef).toBeTruthy();
    expect(mid.plan.items).toHaveLength(0);
    expect(mid.status).toBe("INTAKE_DONE");

    await settleGenerations();
    const done = (await priya.get("me")).body.case;
    expect(done).toMatchObject({ status: "DRAFT_READY", planSource: "provider" });
    expect(done.gen).toMatchObject({ state: "ready", stage: "done", findingsMs: 60, planMs: 260 });
    expect(done.plan.items.length).toBeGreaterThan(0);
    expect((await adviser.get("cases")).body.queue.map((x: { id: string }) => x.id)).toContain(caseId);
    expect((await adviser.get("notifications")).body.notifications.map((n: { kind: string }) => n.kind)).toContain("new_case");
    const audit = (await priya.get(`cases/${caseId}`)).body.audit.map((a: { action: string }) => a.action);
    expect(audit).toEqual(expect.arrayContaining(["consent_recorded", "plan_requested", "draft_generated"]));
  });

  it("the waiting time (and so the SLA clock) starts when the plan is ready, not when it was asked for", async () => {
    setFindingsGeneratorForTests(slowFindings(10));
    setPlanGeneratorForTests(slowPlan(200));
    const priya = await app.priya();
    const r = await priya.post("cases", submitBody());
    const asked = r.body.case.createdAt;
    await settleGenerations();
    const done = (await priya.get("me")).body.case;
    expect(Date.parse(done.waitingSince)).toBeGreaterThan(Date.parse(asked));
  });
});

describe("a failure, and a fallback to pre-written text, offer a retry", () => {
  it("a failed preparation is recorded without echoing the error, and Try again recovers it", async () => {
    setPlanGeneratorForTests(async () => {
      throw new Error("secret zebra content from the profile");
    });
    const priya = await app.priya();
    const r = await priya.post("cases", submitBody());
    expect(r.status).toBe(200);
    await settleGenerations();
    const failed = (await priya.get("me")).body.case;
    expect(failed.gen.state).toBe("failed");
    expect(failed.status).toBe("INTAKE_DONE");
    expect(JSON.stringify([r.body, failed])).not.toMatch(/zebra/);
    expect(JSON.stringify(await app.store.listMetrics())).not.toMatch(/zebra/);

    setPlanGeneratorForTests(null);
    expectOk(await priya.post(`cases/${caseId}/retry`));
    await settleGenerations();
    const again = (await priya.get("me")).body.case;
    expect(again.status).toBe("DRAFT_READY");
    expect(again.gen).toMatchObject({ state: "ready", attempts: 2 });
    const audit = (await priya.get(`cases/${caseId}`)).body.audit.map((a: { action: string }) => a.action);
    expect(audit).toEqual(expect.arrayContaining(["system_generation_failed", "generation_retried"]));
    const m = (await (await app.as("adviser")).get("metrics")).body;
    expect(m.generationFailures).toBe(1);
    expect(m.generationRetries).toBe(1);
  });

  it("a plan that fell back to pre-written text can be retried until an adviser starts, and the retry is a new plan version", async () => {
    setPlanGeneratorForTests(slowPlan(0, "fixture"));
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    await settleGenerations(); // the grace window is short on purpose; wait for the background work explicitly
    const first = (await priya.get("me")).body.case;
    expect(first.planSource).toBe("fixture");
    expect(first.planVersion).toBe(1);

    setPlanGeneratorForTests(null);
    expectOk(await priya.post(`cases/${caseId}/retry`));
    await settleGenerations();
    const again = (await priya.get("me")).body.case;
    expect(again.planSource).toBe("mock");
    expect(again.planVersion).toBe(2);
    expect((await app.store.listPlanVersions(caseId)).map((v) => v.reason)).toEqual(["first draft", "retry after fallback text"]);
  });

  it("nothing to retry when the plan came from a template, and not once an adviser has started", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    await settleGenerations();
    expect((await priya.post(`cases/${caseId}/retry`)).status).toBe(409); // a template needs no retry

    // fallback, but an adviser has claimed it: their review must not be thrown away
    setPlanGeneratorForTests(slowPlan(0, "fixture"));
    const other = await app.as("fresh");
    expectOk(await other.put("me/profile", (await priya.get("me")).body.profile));
    expectOk(await other.post("cases", submitBody()));
    await settleGenerations();
    const made = (await other.get("me")).body.case;
    expect(made.planSource).toBe("fixture");
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${made.id}/claim`));
    expect((await other.post(`cases/${made.id}/retry`)).status).toBe(409);
  });

  it("only the customer who owns the case can retry it", async () => {
    setPlanGeneratorForTests(slowPlan(0, "fixture"));
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    await settleGenerations();
    const adviser = await app.as("adviser");
    expect((await adviser.post(`cases/${caseId}/retry`)).status).toBe(403);
    const stranger = await app.as("fresh");
    expect((await stranger.post(`cases/${caseId}/retry`)).status).toBe(404);
  });
});

describe("time to produce each section is measured and shown to advisers", () => {
  it("the metrics report the median and the slowest time per task", async () => {
    setFindingsGeneratorForTests(slowFindings(30));
    setPlanGeneratorForTests(slowPlan(90));
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    await settleGenerations();
    const m = (await (await app.as("adviser")).get("metrics")).body;
    const by = Object.fromEntries(m.generation.map((g: { task: string }) => [g.task, g]));
    expect(by.explainFindings).toMatchObject({ n: 1, medianMs: 30, maxMs: 30 });
    expect(by.draftPlanPack).toMatchObject({ n: 1, medianMs: 90, maxMs: 90 });
  });
});

describe("the AI status line says exactly which of the last outputs were live, template or fallback", () => {
  it("counts template outputs, and nothing is live without a model", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    await settleGenerations();
    const s = (await priya.get("ai/status")).body;
    expect(s.mode).toBe("mock");
    expect(s.last).toMatchObject({ n: 2, size: RECENT_N, live: 0, template: 2, fallback: 0 });
  });

  it("separates live from fallback, keeps only the last N, and holds counts only", async () => {
    aiStats.reset();
    for (let i = 0; i < 25; i++) aiStats.record({ task: "nudgeCopy", source: i % 5 === 0 ? "fixture" : i % 2 ? "provider" : "mock", latencyMs: 1, events: [] });
    const r = aiStats.recent();
    expect(r.n).toBe(RECENT_N);
    expect(r.live + r.template + r.fallback).toBe(RECENT_N);
    expect(JSON.stringify(r)).not.toMatch(/nudgeCopy|text/);
    const priya = await app.priya();
    expect((await priya.get("ai/status")).body.last.n).toBe(RECENT_N);
  });

  it("is available only to a signed-in person", async () => {
    expect((await app.client("anon").get("ai/status")).status).toBe(401);
  });
});
