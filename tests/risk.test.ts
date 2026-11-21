// The demo risk profile: a label for discussion that follows the LOWER of capacity and willingness, and that a short
// horizon or no experience can only pull down. Never a suitability finding.
import { describe, expect, it } from "vitest";
import { ANITA, PRIYA, RAMESH } from "@/data/personas";
import { runEngine } from "@/lib/engine";
import { RISK_CATEGORIES, RISK_OPTIONS, RISK_QUESTIONS, riskComplete, scoreRisk, type RiskAnswers } from "@/lib/risk";
import type { UserProfile } from "@/types";

const all = (n: number): Required<RiskAnswers> => ({ cushion: n, fall: n, swing: n, horizon: n, years: n, past: n });
const score = (a: Required<RiskAnswers>, p: UserProfile = ANITA) => scoreRisk(a, p, runEngine(p));

describe("completeness", () => {
  it("needs all six answers, each a valid option", () => {
    expect(riskComplete(all(1))).toBe(true);
    expect(riskComplete({ ...all(1), past: undefined })).toBe(false);
    expect(riskComplete({ ...all(1), fall: RISK_OPTIONS })).toBe(false);
    expect(riskComplete({ ...all(1), fall: -1 })).toBe(false);
    expect(riskComplete(null)).toBe(false);
    expect(RISK_QUESTIONS).toHaveLength(6);
  });
  it("covers capacity, willingness, horizon and experience", () => {
    expect(new Set(RISK_QUESTIONS.map((q) => q.group))).toEqual(new Set(["capacity", "willingness", "horizon", "experience"]));
  });
});

describe("the category follows the lower of what can be lost and what is willingly borne", () => {
  it("a person who says they can take anything but whose numbers show a thin reserve is not 'growth'", () => {
    const r = score(all(3), RAMESH);
    expect(r.scores.capacity).toBeLessThan(3);
    expect(r.category).not.toBe("growth");
    expect(r.checks).toContain("cushion_vs_numbers");
  });
  it("capacity comes from the numbers when they are lower than the answer, and the answer when it is lower", () => {
    expect(score({ ...all(3), cushion: 0 }, ANITA).scores.capacity).toBe(0);
    expect(score(all(3), ANITA).scores.capacity).toBeGreaterThanOrEqual(2);
  });
  it("willingness is the lower of the two answers (rounded down)", () => {
    expect(score({ ...all(3), fall: 0, swing: 1 }).scores.willingness).toBe(0);
    expect(score({ ...all(3), fall: 3, swing: 2 }).scores.willingness).toBe(2);
  });
  it("a short horizon pulls the category down, and no experience caps it below the top", () => {
    expect(score({ ...all(3), horizon: 0 }).category).toBe("cautious");
    expect(score({ ...all(3), years: 0, past: 0 }).category).not.toBe("growth");
  });
  it("only a well-covered, willing, long-horizon, experienced person reaches the top category", () => {
    expect(score(all(3), ANITA).category).toBe("growth");
    expect(RISK_CATEGORIES).toEqual(["cautious", "moderate", "balanced", "growth"]);
  });
  it("is monotone: raising any answer never lowers the category", () => {
    const rank = (a: Required<RiskAnswers>) => RISK_CATEGORIES.indexOf(score(a).category);
    for (const q of RISK_QUESTIONS) for (let v = 0; v < RISK_OPTIONS - 1; v++) expect(rank({ ...all(2), [q.id]: v + 1 })).toBeGreaterThanOrEqual(rank({ ...all(2), [q.id]: v }));
  });
});

describe("answers that do not fit are flagged for the adviser, not silently accepted", () => {
  it("calm in a fall but sold in a past fall", () => {
    expect(score({ ...all(2), fall: 2, past: 1 }).checks).toContain("fall_vs_history");
  });
  it("a far horizon but a goal under three years away", () => {
    expect(score({ ...all(2), horizon: 3 }, PRIYA).checks).toContain("horizon_vs_goals"); // Priya has a 2-year goal
    expect(score({ ...all(2), horizon: 0 }, PRIYA).checks).not.toContain("horizon_vs_goals");
  });
});
