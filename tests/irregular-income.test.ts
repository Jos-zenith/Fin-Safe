// Irregular income: good, typical and bad months change the reserve target, show how long savings last in a bad month,
// and are clearly labelled as defaults when the person has only said "irregular".
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { av } from "@/config/assumptions";
import { RequestSchema } from "@/lib/ai/request";
import { localFixture } from "@/lib/ai/run";
import type { PlanPack } from "@/lib/ai/schemas";
import { parseMonths } from "@/components/IntakeInput";
import { PRIYA } from "@/data/personas";
import { runEngine } from "@/lib/engine";
import { setStoreForTests } from "@/server/store";
import type { UserProfile } from "@/types";
import { expectOk, makeApp } from "./server-helpers";

const base = (o: Partial<UserProfile> = {}): UserProfile => ({
  ...structuredClone(PRIYA),
  id: "t",
  incomeStable: false,
  monthlyIncome: 60_000,
  essentialExpenses: 30_000,
  otherExpenses: 5_000,
  dependents: 0,
  familySize: 1,
  liquidSavings: 100_000,
  goals: [],
  debts: [{ id: "d1", label: "Loan", outstanding: 800_000, ratePct: 9, emi: 20_000 }],
  insurance: [{ id: "i1", kind: "health", cover: 1_000_000 }],
  holdings: [],
  ...o,
});
const inc = (p: UserProfile) => runEngine(p).results.find((r) => r.id === "inc")!;
const v = (p: UserProfile) => inc(p).value as Record<string, number>;

describe("what 'irregular' means without figures: stated defaults, labelled as defaults", () => {
  it("steady income has no spread", () => {
    const x = v(base({ incomeStable: true }));
    expect(x.good).toBe(x.bad);
    expect(runEngine(base({ incomeStable: true })).flat["ef.target"]).toBe(av("ef.months.stable"));
  });

  it("irregular with no figures keeps the longer default target, and says the months are defaults", () => {
    const p = base();
    const e = runEngine(p);
    expect(e.flat["ef.target"]).toBe(av("ef.months.irregular"));
    expect(e.flat["inc.entered"]).toBe(0);
    expect(v(p).bad).toBeCloseTo((p.monthlyIncome * (100 - av("income.bad_drop_pct"))) / 100);
    expect(v(p).good).toBeCloseTo((p.monthlyIncome * (100 + av("income.good_uplift_pct"))) / 100);
    expect(inc(p).assumptions.join(" ")).toMatch(/NOT entered: these are stated defaults/);
    expect(inc(p).assumptionIds).toEqual(expect.arrayContaining(["income.bad_drop_pct", "income.good_uplift_pct", "income.bad_run_months"]));
  });
});

describe("entered good / typical / bad months change the reserve target and show the stress", () => {
  it("a bad month of nothing makes the target LONGER than the default, and savings last only a couple of months", () => {
    const p = base({ incomeMonths: { good: 90_000, bad: 0 } });
    const x = v(p);
    expect(x.bad).toBe(0);
    expect(x.badDrain).toBe(50_000); // essentials 30,000 + EMIs 20,000, with no income
    expect(x.minReserve).toBe(50_000 * av("income.bad_run_months"));
    expect(x.survivableMonths).toBeCloseTo(2); // 1,00,000 / 50,000
    const target = runEngine(p).flat["ef.target"];
    expect(target).toBeCloseTo(300_000 / 30_000);
    expect(target).toBeGreaterThan(av("ef.months.irregular"));
  });

  it("a mild bad month makes it SHORTER than the blunt default, never below the steady-income months", () => {
    const p = base({ incomeMonths: { good: 70_000, bad: 50_000 } });
    expect(v(p).badDrain).toBe(0); // 50,000 covers essentials and EMIs
    expect(runEngine(p).flat["ef.target"]).toBe(av("ef.months.stable"));
  });

  it("the target is not a fixed number: it moves with the bad month", () => {
    const targets = [0, 10_000, 20_000, 30_000].map((bad) => runEngine(base({ incomeMonths: { good: 90_000, bad } })).flat["ef.target"]);
    for (let i = 1; i < targets.length; i++) expect(targets[i]).toBeLessThanOrEqual(targets[i - 1]);
    expect(new Set(targets).size).toBeGreaterThan(1);
  });

  it("a pasted list of recent months gives the good and bad month", () => {
    const h = parseMonths("42000, 18000 55000\n30000 61000 25000");
    expect(h).toEqual([42000, 18000, 55000, 30000, 61000, 25000]);
    const p = base({ incomeMonths: { good: Math.max(...h), bad: Math.min(...h), history: h } });
    expect(v(p).good).toBe(61_000);
    expect(v(p).bad).toBe(18_000);
    expect(inc(p).inputs.source).toBe("history");
    expect(v(p).entered).toBe(1);
  });

  it("flags a bad month the reserve cannot bridge, and not a steady income", () => {
    expect(runEngine(base({ incomeMonths: { good: 90_000, bad: 0 } })).flags.map((f) => f.id)).toContain("bad_month_stress");
    expect(runEngine(base({ incomeStable: true })).flags.map((f) => f.id)).not.toContain("bad_month_stress");
    expect(runEngine(base({ incomeMonths: { good: 90_000, bad: 0 }, liquidSavings: 400_000 })).flags.map((f) => f.id)).not.toContain("bad_month_stress");
  });

  it("the plan text a person sees changes with the figures (the reserve target is in it)", () => {
    const plan = (p: UserProfile) => (localFixture({ task: "draftPlanPack", language: "en", profile: p }) as PlanPack).items.find((i) => i.topic === "emergency_reserve")!;
    const dflt = plan(base());
    const entered = plan(base({ incomeMonths: { good: 90_000, bad: 0 } }));
    expect(dflt.rationale).toContain(" 9 months");
    expect(entered.rationale).toContain(" 10 months");
    expect(entered.rationale).not.toBe(dflt.rationale);
  });

  it("every result carries formula, inputs and registry ids", () => {
    const r = inc(base({ incomeMonths: { good: 90_000, bad: 10_000 } }));
    expect(r.formula).toMatch(/badDrain/);
    expect(r.inputs.badIncome).toBe(10_000);
    for (const id of r.assumptionIds) expect(() => av(id)).not.toThrow();
  });
});

describe("the new inputs survive both API schemas", () => {
  let app: Awaited<ReturnType<typeof makeApp>>;
  beforeEach(async () => {
    app = await makeApp();
  });
  afterEach(() => setStoreForTests(null));

  it("the workflow API stores incomeMonths, employer cover and the confirmed list", async () => {
    const c = await app.as("fresh");
    const p = base({ incomeMonths: { good: 90_000, bad: 10_000, history: [90_000, 10_000, 40_000] }, employerTermCover: 2_000_000, confirmed: ["monthlyIncome", "liquidSavings"] });
    expectOk(await c.put("me/profile", p));
    const back = (await c.get("me")).body.profile as UserProfile;
    expect(back.incomeMonths).toEqual(p.incomeMonths);
    expect(back.employerTermCover).toBe(2_000_000);
    expect(back.confirmed).toEqual(["monthlyIncome", "liquidSavings"]);
  });

  it("the workflow API still refuses unknown fields", async () => {
    const c = await app.as("fresh");
    expect((await c.put("me/profile", { ...base(), surprise: 1 })).status).toBe(400);
  });

  it("/api/ai keeps them too, so it computes the same numbers", () => {
    const p = base({ incomeMonths: { good: 90_000, bad: 0 }, employerTermCover: 1_000_000 });
    const parsed = RequestSchema.parse({ task: "explainFindings", language: "en", profile: p });
    expect(parsed.profile?.incomeMonths).toEqual({ good: 90_000, bad: 0 });
    expect(parsed.profile?.employerTermCover).toBe(1_000_000);
  });
});
