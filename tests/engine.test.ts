import { describe, expect, it } from "vitest";
import {
  commissionDrag,
  concentration,
  emergencyFundMonths,
  emergencyFundTarget,
  goalFeasibility,
  healthInsurance,
  highCostDebt,
  impliedAnnual,
  marketFall,
  runEngine,
  savingsRate,
  termInsurance,
} from "@/lib/engine";
import { ANITA, PRIYA, RAMESH } from "@/data/personas";
import { groupIndian, inr } from "@/lib/format";

describe("engine shapes", () => {
  it("every result has id, value, unit, formula, inputs, assumptions", () => {
    for (const p of [PRIYA, RAMESH, ANITA]) {
      for (const r of runEngine(p).results) {
        expect(r.id).toBeTruthy();
        expect(["number", "object"]).toContain(typeof r.value);
        expect(r.unit).toBeTruthy();
        expect(r.formula.length).toBeGreaterThan(3);
        expect(typeof r.inputs).toBe("object");
        expect(Array.isArray(r.assumptions)).toBe(true);
      }
    }
  });
});

describe("emergency fund", () => {
  it("Priya has 1.8 months (demo script)", () => {
    expect(emergencyFundMonths(PRIYA).value).toBeCloseTo(1.8, 5);
  });
  it("target is 6 for stable and 9 for irregular income", () => {
    expect(emergencyFundTarget(PRIYA).value).toBe(6);
    expect(emergencyFundTarget(RAMESH).value).toBe(9);
  });
  it("gap flows into flat values", () => {
    expect(runEngine(PRIYA).flat["ef.gap"]).toBe(6 * 25000 - 45000);
  });
});

describe("insurance", () => {
  it("term multiple rises with dependents and is capped", () => {
    const r = termInsurance(RAMESH).value as Record<string, number>;
    expect(r.needed).toBe(55000 * 12 * 12);
    expect(r.gap).toBe(r.needed - 500000);
    const many = termInsurance({ ...RAMESH, dependents: 20 }).value as Record<string, number>;
    expect(many.needed).toBe(55000 * 12 * 15);
  });
  it("health baseline uses family size and city tier", () => {
    const r = healthInsurance(RAMESH).value as Record<string, number>;
    expect(r.needed).toBe(700000 + 200000 * 3);
    expect(r.gap).toBe(r.needed - 200000);
  });
});

describe("debt and savings", () => {
  it("flags only debts above 12%", () => {
    const v = highCostDebt(RAMESH).value as Record<string, number>;
    expect(v.count).toBe(2);
    expect(v.rate).toBe(36);
    expect((highCostDebt(ANITA).value as Record<string, number>).count).toBe(0);
  });
  it("savings rate", () => {
    const v = savingsRate(PRIYA).value as Record<string, number>;
    expect(v.monthly).toBe(10000);
    expect(v.rate).toBeCloseTo(22.22, 1);
  });
});

describe("goals", () => {
  it("SIP range is ordered pessimistic > base > optimistic (the independent simulation is in golden-goals.test.ts)", () => {
    const v = goalFeasibility({ id: "g", targetAmount: 1000000, years: 10 }).value as Record<string, number>;
    expect(v.low).toBeGreaterThan(v.base);
    expect(v.base).toBeGreaterThan(v.high);
  });
  it("existing savings lower the monthly amount", () => {
    const none = goalFeasibility({ id: "g", targetAmount: 1000000, years: 10 }).value as Record<string, number>;
    const some = goalFeasibility({ id: "g", targetAmount: 1000000, years: 10, savedSoFar: 200000 }).value as Record<string, number>;
    expect(some.base).toBeLessThan(none.base);
  });
});

describe("portfolio", () => {
  it("finds sector concentration and fund overlap for Anita", () => {
    const v = concentration(ANITA.holdings).value as Record<string, number>;
    expect(v.topSector).toBeGreaterThan(40);
    expect(v.overlap).toBeGreaterThan(50);
    expect(v.topHolding).toBeGreaterThan(25);
  });
  it("is zero with no holdings", () => {
    expect(concentration([]).value).toEqual({ topSector: 0, topHolding: 0, overlap: 0 });
  });
});

describe("education + scenarios", () => {
  it("regular plan ends lower than direct", () => {
    const v = commissionDrag({ corpus: 1000000, years: 20, returnPct: 11, regularExpensePct: 1.6, directExpensePct: 0.6 }).value as Record<string, number>;
    expect(v.direct).toBeGreaterThan(v.regular);
    expect(v.diff).toBeCloseTo(v.direct - v.regular, 5);
  });
  it("3% a month is about 42.6% a year", () => {
    expect((impliedAnnual(3).value as Record<string, number>).annual).toBeCloseTo(42.58, 1);
  });
  it("market fall is a fixed 12% scenario", () => {
    const v = marketFall([{ amount: 50000 }]).value as Record<string, number>;
    expect(v).toMatchObject({ before: 50000, after: 44000, loss: 6000, drop: 12 });
  });
});

describe("flags and format", () => {
  it("personas raise the expected flags", () => {
    const ids = (p: typeof PRIYA) => runEngine(p).flags.map((f) => f.id);
    expect(ids(PRIYA)).toEqual(expect.arrayContaining(["ef_low", "tip_following"]));
    expect(ids(RAMESH)).toEqual(expect.arrayContaining(["ef_low", "high_cost_debt", "term_gap", "health_gap"]));
    expect(ids(ANITA)).toEqual(expect.arrayContaining(["concentration", "overlap_high"]));
  });
  it("Indian digit grouping", () => {
    expect(groupIndian(120000)).toBe("1,20,000");
    expect(groupIndian(12345678)).toBe("1,23,45,678");
    expect(groupIndian(999)).toBe("999");
    expect(inr(45000)).toBe("₹45,000");
  });
});
