// Input quality: what is missing or implausible is listed before results are relied on; every metric carries a
// confidence label derived from completeness and unreviewed assumptions; a missing KEY input produces "Cannot calculate
// reliably", never a confident number; and the adviser can see which answers the customer never ticked.
import { describe, expect, it } from "vitest";
import { ASSUMPTIONS, type Reviews } from "@/config/assumptions";
import { ANITA, PRIYA, RAMESH } from "@/data/personas";
import { localFixture } from "@/lib/ai/run";
import type { Findings, PlanPack } from "@/lib/ai/schemas";
import { runEngine } from "@/lib/engine";
import { inr } from "@/lib/format";
import { assessProfile, CONFIRM_FIELDS, unconfirmed, type IssueCode } from "@/lib/quality";
import type { Lang, UserProfile } from "@/types";

const LANGS: Lang[] = ["en", "hi", "ta"];
const base = (o: Partial<UserProfile> = {}): UserProfile => ({
  ...structuredClone(ANITA),
  id: "t",
  monthlyIncome: 87_000,
  essentialExpenses: 31_000,
  otherExpenses: 12_000,
  liquidSavings: 430_000,
  dependents: 1,
  familySize: 2,
  debts: [],
  insurance: [{ id: "i1", kind: "health", cover: 1_000_000 }, { id: "i2", kind: "term", cover: 12_000_000 }],
  goals: [{ id: "g1", kind: "home", targetAmount: 2_700_000, years: 9 }],
  holdings: [],
  employerTermCover: 0,
  ...o,
});
const ALL_STEPS = new Set(["goalSaved", "incomeMonths", "name", "city", "income", "other", "term", "employer", "health", "holdings", "risk1", "risk2"]);
const codes = (p: UserProfile, answered?: ReadonlySet<string>) => assessProfile(p, runEngine(p), { answered }).issues.map((i) => i.code);
const has = (p: UserProfile, c: IssueCode) => codes(p, ALL_STEPS).includes(c);

describe("what is flagged as missing or implausible", () => {
  it("a complete, sensible profile has nothing serious to say", () => {
    expect(codes(base(), ALL_STEPS).filter((c) => c !== "defaults_used")).toEqual([]);
  });
  it("no income, no essential spending", () => {
    expect(has(base({ monthlyIncome: 0 }), "income_missing")).toBe(true);
    expect(has(base({ essentialExpenses: 0 }), "essentials_missing")).toBe(true);
  });
  it("no insurance entered at all", () => {
    expect(has(base({ insurance: [] }), "no_insurance")).toBe(true);
  });
  it("income below essentials", () => {
    expect(has(base({ monthlyIncome: 20_000 }), "income_below_essentials")).toBe(true);
  });
  it("EMIs above income", () => {
    expect(has(base({ monthlyIncome: 30_000, debts: [{ id: "d", label: "Loan", outstanding: 1_000_000, ratePct: 9, emi: 35_000 }] }), "emi_above_income")).toBe(true);
  });
  it("zero dependents with a family size above one", () => {
    expect(has(base({ dependents: 0, familySize: 3 }), "family_mismatch")).toBe(true);
    expect(has(base({ dependents: 0, familySize: 1 }), "family_mismatch")).toBe(false);
  });
  it("a goal in the past", () => {
    expect(has(base({ goals: [{ id: "g1", kind: "home", targetAmount: 1_000_000, years: 0 }] }), "goal_in_past")).toBe(true);
  });
  it("round placeholder values (two or more of income, essentials and savings)", () => {
    expect(has(base({ monthlyIncome: 100_000, essentialExpenses: 50_000, liquidSavings: 430_000 }), "round_values")).toBe(true);
    expect(has(base({ monthlyIncome: 100_000, essentialExpenses: 31_000, liquidSavings: 430_000 }), "round_values")).toBe(false);
  });
  it("employer cover that is unknown, when somebody depends on the income", () => {
    expect(has(base({ employerTermCover: undefined }), "employer_unknown")).toBe(true);
    expect(has(base({ employerTermCover: undefined, dependents: 0, familySize: 1 }), "employer_unknown")).toBe(false);
  });
  it("optional answers still on a default are listed only when the browser knows what was answered", () => {
    const p = base();
    expect(codes(p, new Set())).toContain("defaults_used");
    expect(codes(p)).not.toContain("defaults_used"); // the adviser's side cannot tell
  });
  it("irregular income with no good or bad month is a default, wherever it is viewed", () => {
    const issue = assessProfile(base({ incomeStable: false }), runEngine(base({ incomeStable: false })), { answered: ALL_STEPS }).issues.find((i) => i.code === "defaults_used");
    expect(issue?.fields).toContain("incomeMonths");
  });
  it("the three demo personas get no 'missing key input' verdict", () => {
    for (const p of [PRIYA, RAMESH, ANITA]) expect(assessProfile(p, runEngine(p), { answered: ALL_STEPS }).incomplete, p.id).toBe(false);
  });
});

describe("a metric whose key input is missing says so instead of showing a number", () => {
  const noIncome = base({ monthlyIncome: 0 });
  const q = assessProfile(noIncome, runEngine(noIncome), { answered: ALL_STEPS });

  it("cannot-calculate and low confidence for every metric that needs income", () => {
    for (const m of ["cash", "term", "debt", "savings", "goal"] as const) {
      expect(q.metrics[m].cannot, m).toBe(true);
      expect(q.metrics[m].level, m).toBe("low");
      expect(q.metrics[m].missing, m).toContain("monthlyIncome");
    }
    expect(q.incomplete).toBe(true);
    // a metric that does not need income is still computable
    expect(q.metrics.ef.cannot).toBe(false);
  });

  for (const lang of LANGS) {
    it(`${lang}: the plan and the findings carry no figure, and the plan says it cannot calculate reliably`, () => {
      const plan = localFixture({ task: "draftPlanPack", language: lang, profile: noIncome }) as PlanPack;
      expect(plan.items[0].topic).toBe("inputs_missing");
      expect(plan.items.slice(1).every((i) => i.topic === "goals_later")).toBe(true);
      // the only rupee figure allowed is the person's OWN goal target (an input); nothing calculated, and no percentage
      expect(JSON.stringify(plan).replaceAll(inr(2_700_000), "")).not.toMatch(/₹|%/);
      const findings = localFixture({ task: "explainFindings", language: lang, profile: noIncome }) as Findings;
      expect(Object.keys(findings.findings)).toEqual(["cash"]);
      if (lang === "en") {
        expect(plan.items[0].rationale.startsWith("Cannot calculate reliably:")).toBe(true);
        expect(findings.findings.cash!.startsWith("Cannot calculate reliably:")).toBe(true);
      }
    });
  }

  it("the ladder holds goals back and names the missing answer as the blocker", () => {
    const e = runEngine(noIncome);
    expect(e.ladder.goalsLater).toBe(true);
    expect(e.ladder.steps.find((s) => s.id === e.ladder.firstBlocker)?.reason).toBe("no_income");
  });
});

describe("confidence is derived from completeness and from unreviewed assumptions", () => {
  const p = base();
  const e = runEngine(p);
  const allReviewed: Reviews = Object.fromEntries(ASSUMPTIONS.map((a) => [a.id, { by: "Test", on: "2026-01-01" }]));

  it("never 'high' while any assumption behind the metric is unreviewed, even with every input present", () => {
    const q = assessProfile(p, e, { answered: ALL_STEPS });
    for (const m of ["cash", "ef", "term", "health", "debt", "savings", "goal"] as const) {
      expect(q.metrics[m].unverified.length, m).toBeGreaterThan(0);
      expect(q.metrics[m].level, m).not.toBe("high");
    }
  });

  it("'high' is reachable only when inputs are complete AND the assumptions are reviewed", () => {
    const q = assessProfile(p, e, { answered: ALL_STEPS, reviews: allReviewed });
    expect(q.metrics.cash.level).toBe("high");
    expect(q.metrics.term.level).toBe("high");
    // reviewed assumptions do not rescue a metric with a default behind it
    const irregular = base({ incomeStable: false });
    expect(assessProfile(irregular, runEngine(irregular), { answered: ALL_STEPS, reviews: allReviewed }).metrics.ef.level).toBe("medium");
  });

  it("a default drops the metric to medium and says which field", () => {
    const q = assessProfile(p, e, { answered: new Set() });
    expect(q.metrics.health.level).toBe("medium");
    expect(q.metrics.health.defaults).toEqual(expect.arrayContaining(["health", "city"]));
  });

  it("an implausible answer drops the metrics it touches to medium", () => {
    const odd = base({ monthlyIncome: 20_000 });
    const q = assessProfile(odd, runEngine(odd), { answered: ALL_STEPS, reviews: allReviewed });
    expect(q.metrics.cash.level).toBe("medium");
    expect(q.metrics.cash.implausible).toContain("monthlyIncome");
  });
});

describe("what the adviser can see", () => {
  it("lists every answer the customer did not tick, and none once they all are", () => {
    const p = base();
    expect(unconfirmed(p)).toEqual(CONFIRM_FIELDS); // confirmed is absent: nothing was ticked
    expect(unconfirmed({ ...p, confirmed: ["monthlyIncome", "liquidSavings"] })).not.toContain("monthlyIncome");
    expect(unconfirmed({ ...p, confirmed: [...CONFIRM_FIELDS] })).toEqual([]);
  });
});
