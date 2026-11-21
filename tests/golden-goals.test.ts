// GOLDEN TESTS for the goal engine. Every expected value is worked out by a MONTH-BY-MONTH simulation
// (a plain loop), not by the closed-form formula the engine uses, and compared within a stated tolerance.
import { describe, expect, it } from "vitest";
import { av } from "@/config/assumptions";
import { goalFeasibility, goalFuture, inflate, scenarioParams, sipFor, type Scenario } from "@/lib/engine";

const TOLERANCE_INR = 1; // rupees: the loop and the closed form agree far inside this

// ---------- independent reference implementation (loops only) ----------
/** Value at month n of depositing 1 at the end of every month, month by month. */
function annuityFactor(months: number, monthlyRate: number): number {
  let balance = 0;
  for (let m = 0; m < months; m++) balance = balance * (1 + monthlyRate) + 1;
  return balance;
}
/** A lump sum grown month by month. */
function growMonthByMonth(lump: number, months: number, monthlyRate: number): number {
  let balance = lump;
  for (let m = 0; m < months; m++) balance *= 1 + monthlyRate;
  return balance;
}
/** Prices raised one year at a time. */
function inflateYearByYear(today: number, years: number, inflationPct: number): number {
  let amount = today;
  for (let y = 0; y < years; y++) amount *= 1 + inflationPct / 100;
  return amount;
}
/** Required monthly amount: (target - grown lump) / (value of 1 a month). Verified by a forward simulation below. */
function referenceSip(todayTarget: number, years: number, saved: number, s: Scenario, inflationOn = true): number {
  const p = scenarioParams(s);
  const rate = (p.grossReturnPct - av("fee.expense_ratio")) / 100 / 12;
  const target = inflationOn ? inflateYearByYear(todayTarget, years, p.inflationPct) : todayTarget;
  const months = years * 12;
  const need = target - growMonthByMonth(saved, months, rate);
  return need <= 0 ? 0 : need / annuityFactor(months, rate);
}
/** Forward simulation: deposit `sip` each month, return the balance at the end. */
function forward(sip: number, years: number, saved: number, s: Scenario): number {
  const rate = (scenarioParams(s).grossReturnPct - av("fee.expense_ratio")) / 100 / 12;
  let balance = saved;
  for (let m = 0; m < years * 12; m++) balance = balance * (1 + rate) + sip;
  return balance;
}

const scenarios: { name: string; target: number; years: number; saved: number; s: Scenario }[] = [
  { name: "short horizon, no savings, base", target: 100000, years: 2, saved: 0, s: "base" },
  { name: "one year, no savings, base", target: 60000, years: 1, saved: 0, s: "base" },
  { name: "ten years, no savings, base", target: 1000000, years: 10, saved: 0, s: "base" },
  { name: "ten years, with existing savings, base", target: 1000000, years: 10, saved: 100000, s: "base" },
  { name: "long horizon (27 years), no savings, base", target: 30000000, years: 27, saved: 0, s: "base" },
  { name: "long horizon with large existing savings", target: 30000000, years: 27, saved: 900000, s: "base" },
  { name: "pessimistic scenario (low return, high inflation)", target: 800000, years: 7, saved: 0, s: "low" },
  { name: "optimistic scenario (high return, low inflation)", target: 800000, years: 7, saved: 0, s: "high" },
  { name: "very high goal (5 crore, 30 years)", target: 50000000, years: 30, saved: 250000, s: "base" },
  { name: "goal already met by existing savings", target: 200000, years: 5, saved: 1000000, s: "base" },
  { name: "existing savings exactly cover it", target: 100000, years: 3, saved: 0, s: "base" },
];

describe("golden goal scenarios (month-by-month simulation)", () => {
  for (const sc of scenarios) {
    it(`${sc.name}: engine matches the simulation within ₹${TOLERANCE_INR}`, () => {
      const engine = (goalFeasibility({ id: "g", targetAmount: sc.target, years: sc.years, savedSoFar: sc.saved }).value as Record<string, number>)[sc.s];
      expect(Math.abs(engine - referenceSip(sc.target, sc.years, sc.saved, sc.s))).toBeLessThanOrEqual(TOLERANCE_INR);
    });
    it(`${sc.name}: saving that amount month by month really reaches the target`, () => {
      const sip = referenceSip(sc.target, sc.years, sc.saved, sc.s);
      const p = scenarioParams(sc.s);
      const target = inflateYearByYear(sc.target, sc.years, p.inflationPct);
      const reached = forward(sip, sc.years, sc.saved, sc.s);
      if (sip > 0) expect(Math.abs(reached - target)).toBeLessThanOrEqual(TOLERANCE_INR);
      else expect(reached).toBeGreaterThanOrEqual(target - TOLERANCE_INR);
    });
  }

  it("a goal already met needs no monthly amount at all", () => {
    const v = goalFeasibility({ id: "g", targetAmount: 200000, years: 5, savedSoFar: 1000000 }).value as Record<string, number>;
    expect(v).toEqual({ low: 0, base: 0, high: 0 });
  });

  it("inflation OFF: the same engine call with an un-inflated target matches a zero-inflation simulation", () => {
    const engine = sipFor(1000000, 10, scenarioParams("base").netReturnPct, 0);
    expect(Math.abs(engine - referenceSip(1000000, 10, 0, "base", false))).toBeLessThanOrEqual(TOLERANCE_INR);
  });

  it("inflation ON costs more than inflation OFF", () => {
    const on = referenceSip(1000000, 10, 0, "base", true);
    const off = referenceSip(1000000, 10, 0, "base", false);
    expect(on).toBeGreaterThan(off);
  });

  it("the goal at the goal date equals today's amount raised year by year", () => {
    const f = goalFuture({ id: "g", targetAmount: 800000, years: 7 }).value as Record<string, number>;
    expect(f.today).toBe(800000);
    expect(Math.abs(f.base - inflateYearByYear(800000, 7, av("inflation.base")))).toBeLessThan(0.01);
    expect(f.atHighInflation).toBeGreaterThan(f.base);
    expect(f.atLowInflation).toBeLessThan(f.base);
    expect(inflate(800000, 7, av("inflation.base"))).toBeCloseTo(f.base, 6);
  });

  it("existing savings are grown, not just subtracted", () => {
    const f = goalFuture({ id: "g", targetAmount: 800000, years: 10, savedSoFar: 100000 }).value as Record<string, number>;
    const rate = scenarioParams("base").netReturnPct / 100 / 12;
    expect(Math.abs(f.savedGrown - growMonthByMonth(100000, 120, rate))).toBeLessThan(0.01);
    expect(f.savedGrown).toBeGreaterThan(100000);
  });

  it("the range is ordered: pessimistic needs the most, optimistic the least", () => {
    for (const sc of scenarios.filter((x) => x.s === "base" && x.saved === 0)) {
      const v = goalFeasibility({ id: "g", targetAmount: sc.target, years: sc.years }).value as Record<string, number>;
      expect(v.low).toBeGreaterThan(v.base);
      expect(v.base).toBeGreaterThan(v.high);
    }
  });

  it("states that taxes are not included, and lists the assumptions it used", () => {
    const r = goalFeasibility({ id: "g", targetAmount: 100000, years: 3 });
    expect(r.assumptions.join(" ")).toMatch(/Taxes are not included/);
    for (const id of ["return.low", "return.base", "return.high", "inflation.low", "inflation.base", "inflation.high", "fee.expense_ratio", "tax.not_modelled"]) expect(r.assumptionIds).toContain(id);
  });
});

describe("property tests (deterministic grid)", () => {
  const base = (over: Partial<{ target: number; years: number; saved: number }> = {}, s: Scenario = "base") =>
    (goalFeasibility({ id: "g", targetAmount: over.target ?? 1000000, years: over.years ?? 10, savedSoFar: over.saved ?? 0 }).value as Record<string, number>)[s];

  it("more years never raises the required monthly amount", () => {
    for (const target of [50000, 800000, 20000000]) {
      for (const saved of [0, 25000, 400000]) {
        let prev = Infinity;
        for (let years = 1; years <= 40; years++) {
          const v = base({ target, years, saved });
          expect(v, `${target}/${saved}/${years}`).toBeLessThanOrEqual(prev + 1e-6);
          prev = v;
        }
      }
    }
  });

  it("more existing savings never raises it", () => {
    for (const years of [1, 5, 15, 30]) {
      let prev = Infinity;
      for (let saved = 0; saved <= 3000000; saved += 100000) {
        const v = base({ years, saved });
        expect(v).toBeLessThanOrEqual(prev + 1e-6);
        prev = v;
      }
    }
  });

  it("a higher return never raises it (optimistic <= base <= pessimistic)", () => {
    for (const years of [1, 3, 10, 25]) for (const saved of [0, 200000]) {
      expect(base({ years, saved }, "high")).toBeLessThanOrEqual(base({ years, saved }, "base"));
      expect(base({ years, saved }, "base")).toBeLessThanOrEqual(base({ years, saved }, "low"));
    }
  });

  it("a bigger goal never lowers it", () => {
    let prev = -1;
    for (let target = 0; target <= 5000000; target += 250000) {
      const v = base({ target });
      expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = v;
    }
  });

  it("the required amount is never negative or NaN", () => {
    for (const years of [1, 2, 7, 30]) for (const saved of [0, 1e9]) for (const target of [0, 1, 1e9]) {
      for (const s of ["low", "base", "high"] as const) {
        const v = base({ target, years, saved }, s);
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
