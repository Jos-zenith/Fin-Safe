import { describe, expect, it } from "vitest";
import { corpusAt, corpusSeries, costOfDelay, exploreGoal, futureTarget, roundTo, sipValue } from "@/lib/engine/explore";
import { goalFeasibility, scenarioParams } from "@/lib/engine";

const net = (s: "low" | "base" | "high") => scenarioParams(s).netReturnPct;

describe("goal explorer maths", () => {
  it("saving exactly the required base-case amount reaches the goal-date target in the base case", () => {
    const g = { id: "g1", targetAmount: 800000, years: 7 };
    const base = (goalFeasibility(g).value as Record<string, number>).base;
    const r = exploreGoal(g, base).value as Record<string, number>;
    expect(r.base).toBeCloseTo(r.target, 0);
    expect(r.shortfallBase).toBeCloseTo(0, 0);
    expect(r.low).toBeLessThan(r.base);
    expect(r.high).toBeGreaterThan(r.base);
  });

  it("the goal-date target is the inflation-adjusted amount, and today's-money value is lower than the nominal outcome", () => {
    const g = { id: "g", targetAmount: 500000, years: 10 };
    const r = exploreGoal(g, 5000).value as Record<string, number>;
    expect(r.today).toBe(500000);
    expect(r.target).toBeGreaterThan(r.today);
    expect(r.target).toBeCloseTo(futureTarget(g, "base"), 6);
    expect(r.baseInTodaysMoney).toBeLessThan(r.base);
  });

  it("existing savings raise every outcome and are counted with growth", () => {
    const without = exploreGoal({ id: "g", targetAmount: 500000, years: 8 }, 4000).value as Record<string, number>;
    const withSaved = exploreGoal({ id: "g", targetAmount: 500000, years: 8, savedSoFar: 100000 }, 4000).value as Record<string, number>;
    expect(withSaved.base).toBeGreaterThan(without.base + 100000);
    expect(withSaved.shortfallBase).toBeLessThan(without.shortfallBase);
  });

  it("the three scenarios are always ordered and a bigger monthly amount never lowers any of them", () => {
    const g = { id: "g", targetAmount: 500000, years: 5 };
    let prev = exploreGoal(g, 0).value as Record<string, number>;
    for (let m = 500; m <= 20000; m += 500) {
      const v = exploreGoal(g, m).value as Record<string, number>;
      expect(v.low).toBeLessThan(v.base);
      expect(v.base).toBeLessThan(v.high);
      expect(v.base).toBeGreaterThan(prev.base);
      prev = v;
    }
  });

  it("zero saved and no savings means zero outcome and the whole inflated target as shortfall", () => {
    const g = { id: "g", targetAmount: 100000, years: 3 };
    const v = exploreGoal(g, 0).value as Record<string, number>;
    expect(v.low).toBe(0);
    expect(v.base).toBe(0);
    expect(v.high).toBe(0);
    expect(v.shortfallBase).toBeCloseTo(futureTarget(g, "base"), 6);
  });

  it("the yearly series starts at the existing savings, rises, and ends at the full value", () => {
    const g = { targetAmount: 100000, years: 10, savedSoFar: 20000 };
    const s = corpusSeries(g, 5000, net("base"));
    expect(s).toHaveLength(11);
    expect(s[0]).toBe(20000);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
    expect(s[10]).toBeCloseTo(corpusAt(g, 5000, 10, net("base")), 6);
  });

  it("sipValue with a delay equals the same deposits over fewer months", () => {
    expect(sipValue(5000, 10, net("base"), 1)).toBeCloseTo(sipValue(5000, 9, net("base")), 6);
  });

  it("waiting costs more every month, longer waiting costs more, and a delay that uses the whole horizon returns null", () => {
    const g = { targetAmount: 800000, years: 7 };
    const d = costOfDelay(g, 1)!;
    expect(d.later).toBeGreaterThan(d.now);
    expect(d.extra).toBeCloseTo(d.later - d.now, 6);
    expect(costOfDelay(g, 2)!.extra).toBeGreaterThan(d.extra);
    expect(costOfDelay({ targetAmount: 1000, years: 1 }, 1)).toBeNull();
  });

  it("every explorer result carries formula, inputs, assumptions and assumption ids", () => {
    const r = exploreGoal({ id: "g1", targetAmount: 800000, years: 7 }, 5000);
    expect(r.id).toBe("explore.g1");
    expect(r.formula.length).toBeGreaterThan(10);
    expect(r.inputs.monthly).toBe(5000);
    const text = r.assumptions.join(" ");
    expect(text).toMatch(/never a promise/);
    expect(text).toMatch(/Taxes are not included/);
    expect(text).toMatch(/inflation/);
    expect(r.assumptionIds).toContain("tax.not_modelled");
  });

  it("rounds to slider steps", () => {
    expect(roundTo(7687, 500)).toBe(7500);
    expect(roundTo(7800, 500)).toBe(8000);
  });
});
