// Adviser metrics (events only, labelled "Demo data. Not evidence.") and the illustrative unit-economics calculator.
import { afterEach, describe, expect, it } from "vitest";
import { localFixture } from "@/lib/ai/run";
import { DEFAULT_INPUTS, unitEconomics } from "@/lib/unitEconomics";
import { setPlanGeneratorForTests } from "@/server/plan";
import { summariseMetrics } from "@/server/metrics";
import { setStoreForTests } from "@/server/store";
import type { MetricRec } from "@/server/store/types";
import { en, hi, ta } from "./helpers";
import { expectOk, makeApp, readyToApprove, submitBody } from "./server-helpers";

afterEach(() => {
  setPlanGeneratorForTests(null);
  setStoreForTests(null);
});

let n = 0;
const ev = (kind: string, extra: Partial<MetricRec> = {}): MetricRec => ({ id: `e${n++}`, at: "2030-01-01T00:00:00Z", kind, caseId: null, task: null, valueMs: null, props: {}, ...extra });
const MIN = 60_000;

describe("summariseMetrics", () => {
  it("carries the banner and the number of events behind every figure", () => {
    const m = summariseMetrics([], 0, "2030-01-01T00:00:00Z");
    expect(m.banner).toBe("Demo data. Not evidence.");
    expect(m.review).toEqual({ n: 0, medianMinutes: null });
    expect(m.draftsNeedingCorrection).toEqual({ n: 0, share: null });
    expect(m.source.liveShare).toBeNull();
    expect(m.validationRejection).toEqual([]);
    expect(m.editRateByTopic).toEqual([]);
  });

  it("computes medians, shares, edit rate per topic and the live-vs-template share", () => {
    const events = [
      ev("plan_approved", { valueMs: 10 * MIN, props: { corrected: true, sinceRequestMs: 60 * MIN } }),
      ev("plan_approved", { valueMs: 20 * MIN, props: { corrected: false, sinceRequestMs: 100 * MIN } }),
      ev("plan_approved", { valueMs: 30 * MIN, props: { corrected: true, sinceRequestMs: 200 * MIN } }),
      ev("review_started", { valueMs: 5 * MIN }),
      ev("review_started", { valueMs: 15 * MIN }),
      ev("item_decision", { props: { topic: "emergency_reserve", decision: "edited" } }),
      ev("item_decision", { props: { topic: "emergency_reserve", decision: "accepted" } }),
      ev("item_decision", { props: { topic: "goal_long", decision: "rejected" } }),
      ev("case_submitted"),
      ev("case_submitted"),
      ev("ai_task", { task: "draftPlanPack", props: { source: "mock", rejected: false } }),
      ev("ai_task", { task: "draftPlanPack", props: { source: "provider", rejected: false } }),
      ev("ai_task", { task: "draftPlanPack", props: { source: "fixture", rejected: true } }),
      ev("ai_task", { task: "answerQuestion", props: { source: "provider", rejected: false } }),
    ];
    const m = summariseMetrics(events, 2, "2030-01-01T00:00:00Z");
    expect(m.review).toEqual({ n: 3, medianMinutes: 20 });
    expect(m.firstReviewedPlan.medianMinutes).toBe(100);
    expect(m.waitBeforeReview.medianMinutes).toBe(10); // median of 5 and 15
    expect(m.draftsNeedingCorrection.share).toBeCloseTo(2 / 3);
    expect(m.editRateByTopic).toEqual([
      { topic: "emergency_reserve", decisions: 2, edited: 1, rate: 0.5 },
      { topic: "goal_long", decisions: 1, edited: 0, rate: 0 },
    ]);
    expect(m.source).toMatchObject({ n: 4, live: 2, template: 1, fallback: 1 });
    expect(m.source.liveShare).toBe(0.5);
    // only requests that reached a model can be rejected; the mock one is not counted
    expect(m.validationRejection).toEqual([
      { task: "answerQuestion", liveRequests: 1, rejected: 0, rate: 0 },
      { task: "draftPlanPack", liveRequests: 2, rejected: 1, rate: 0.5 },
    ]);
    expect(m.overdueCases).toBe(2);
    expect(m.casesSubmitted).toBe(2);
    expect(m.casesApproved).toBe(3);
  });

  it("with only mock answers there is NO rejection rate (not a flattering 0%)", () => {
    const m = summariseMetrics([ev("ai_task", { task: "draftPlanPack", props: { source: "mock", rejected: false } })], 0, "now");
    // a row may exist for the task, but it has no live requests and no rate
    expect(m.validationRejection.filter((r) => r.liveRequests > 0)).toEqual([]);
    expect(m.validationRejection.every((r) => r.rate === null)).toBe(true);
    expect(m.source.liveShare).toBe(0);
  });
});

describe("GET /api/v1/metrics", () => {
  it("is for advisers only", async () => {
    const app = await makeApp();
    expect((await app.client("anon").get("metrics")).status).toBe(401);
    expect((await (await app.as("priya")).get("metrics")).status).toBe(403);
    expect((await (await app.as("adviser")).get("metrics")).status).toBe(200);
  });

  it("reflects a real run through the workflow, with no profile content in it", async () => {
    const app = await makeApp();
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post("cases/case-priya/claim"));
    const item = (await adviser.get("cases/case-priya")).body.case.plan.items[0];
    expectOk(await adviser.post(`cases/case-priya/items/${item.id}/edit`, { text: "Build the reserve first.", lang: "en" }));
    await readyToApprove(adviser, "case-priya");
    expectOk(await adviser.post("cases/case-priya/approve"));

    const m = (await adviser.get("metrics")).body;
    expect(m.banner).toBe("Demo data. Not evidence.");
    expect(m.review.n).toBe(1);
    expect(m.draftsNeedingCorrection).toEqual({ n: 1, share: 1 });
    expect(m.editRateByTopic.some((r: { edited: number }) => r.edited >= 1)).toBe(true);
    expect(m.casesSubmitted).toBeGreaterThanOrEqual(1);
    expect(m.casesApproved).toBe(1);
    expect(m.source).toMatchObject({ template: 2, live: 0, fallback: 0 }); // the findings and the plan are two outputs per case
    expect(m.generation.map((g: { task: string; n: number }) => [g.task, g.n]).sort()).toEqual([["draftPlanPack", 1], ["explainFindings", 1]]);
    expect(m.generationRetries).toBe(0);
    expect(m.validationRejection.every((r: { liveRequests: number; rate: number | null }) => r.liveRequests === 0 && r.rate === null)).toBe(true); // mock mode: nothing live, so no rate
    expect(m.overdueCases).toBeGreaterThanOrEqual(1); // the seeded Ramesh case is past its SLA
    expect(JSON.stringify(m)).not.toMatch(/Priya|Chennai|45000|Build the reserve|rent/);
  });

  it("counts a live draft that was rejected and replaced, as a rejection", async () => {
    const app = await makeApp();
    setPlanGeneratorForTests(async (profile, language) => ({
      plan: localFixture({ task: "draftPlanPack", language, profile }) as never,
      source: "fixture",
      latencyMs: 20,
      events: [{ kind: "numeric_rejected", detail: "pre: 12" }, { kind: "fallback", detail: "validated mock fixture used" }],
    }));
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const m = (await (await app.as("adviser")).get("metrics")).body;
    expect(m.validationRejection.find((r: { task: string }) => r.task === "draftPlanPack")).toEqual({ task: "draftPlanPack", liveRequests: 1, rejected: 1, rate: 1 });
    expect(m.source.fallback).toBe(1);
  });
});

describe("unit economics (illustrative)", () => {
  it("matches the arithmetic by hand", () => {
    const o = unitEconomics({ ...DEFAULT_INPUTS });
    // 15 + 20% x 15 = 18 minutes; 18/60 x 1000 + 20 = 320 per plan; x2 plans + 500 = 1140 per client; 3000 - 1140 = 1860
    expect(o.expectedMinutesPerPlan).toBeCloseTo(18);
    expect(o.costPerReviewedPlan).toBeCloseTo(320);
    expect(o.costPerClientPerYear).toBeCloseTo(1140);
    expect(o.marginPerClientPerYear).toBeCloseTo(1860);
    expect(o.marginPercent).toBeCloseTo(62);
    expect(o.plansPerAdviserDay).toBeCloseTo(300 / 18);
    expect(o.clientsPerAdviser).toBeCloseTo(((300 / 18) * 220) / 2);
    expect(o.breakEvenPricePerClient).toBeCloseTo(1140);
  });
  it("margin = price - cost, cost rises with review minutes and with rework, and zero inputs do not divide by zero", () => {
    for (const minutes of [5, 15, 40]) {
      const o = unitEconomics({ ...DEFAULT_INPUTS, minutesPerReview: minutes });
      expect(o.marginPerClientPerYear).toBeCloseTo(DEFAULT_INPUTS.pricePerClientPerYear - o.costPerClientPerYear);
    }
    expect(unitEconomics({ ...DEFAULT_INPUTS, minutesPerReview: 40 }).costPerReviewedPlan).toBeGreaterThan(unitEconomics({ ...DEFAULT_INPUTS, minutesPerReview: 10 }).costPerReviewedPlan);
    expect(unitEconomics({ ...DEFAULT_INPUTS, reworkPercent: 80 }).costPerReviewedPlan).toBeGreaterThan(unitEconomics({ ...DEFAULT_INPUTS, reworkPercent: 0 }).costPerReviewedPlan);
    const z = unitEconomics({ ...DEFAULT_INPUTS, minutesPerReview: 0, reworkPercent: 0, pricePerClientPerYear: 0, plansPerClientPerYear: 0 });
    expect(z.plansPerAdviserDay).toBe(0);
    expect(z.marginPercent).toBeNull();
    expect(z.clientsPerAdviser).toBe(0);
    for (const v of Object.values(z)) expect(v === null || Number.isFinite(v as number)).toBe(true);
  });
  it("the page says the numbers are made up, in every language", () => {
    for (const d of [en, hi, ta] as unknown as Record<string, string>[]) {
      expect(d["ue.banner"]).toBeTruthy();
      expect(d["met.banner"]).toBeTruthy();
    }
    expect((en as Record<string, string>)["ue.banner"]).toMatch(/made-up defaults, not data and not a forecast/);
    expect((en as Record<string, string>)["met.banner"]).toBe("Demo data. Not evidence.");
  });
});
