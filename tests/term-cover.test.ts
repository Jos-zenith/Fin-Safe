// Term cover: an income multiple AND what is owed plus years of support for dependents, with optional employer cover
// that is UNKNOWN (not zero) until it is entered. Both parts are shown with their formula.
import { describe, expect, it } from "vitest";
import { av } from "@/config/assumptions";
import { RAMESH, ANITA, PRIYA } from "@/data/personas";
import { localFixture } from "@/lib/ai/run";
import type { PlanPack } from "@/lib/ai/schemas";
import { findResult, runEngine, termInsurance } from "@/lib/engine";
import type { UserProfile } from "@/types";

const p = (o: Partial<UserProfile>): UserProfile => ({ ...structuredClone(RAMESH), id: "t", insurance: [{ id: "i1", kind: "term", cover: 1_000_000 }], ...o });
const t = (x: UserProfile) => termInsurance(x).value as Record<string, number>;

describe("liabilities-aware term cover", () => {
  it("a heavy loan makes the needs-based view the larger one", () => {
    const x = t(p({ monthlyIncome: 25_000, essentialExpenses: 18_000, dependents: 2, debts: [{ id: "d", label: "Loan", outstanding: 4_000_000, ratePct: 9, emi: 5_000 }] }));
    expect(x.byIncome).toBe(25_000 * 12 * 11); // 10 for the first dependent, one more for the second
    expect(x.debts).toBe(4_000_000);
    expect(x.support).toBe(av("insurance.term.support_years") * 12 * 18_000);
    expect(x.byNeeds).toBe(x.debts + x.support);
    expect(x.byNeeds).toBeGreaterThan(x.byIncome);
    expect(x.needed).toBe(x.byNeeds);
  });

  it("with no loans and a high income, the income multiple stays the larger one", () => {
    const x = t(p({ monthlyIncome: 200_000, essentialExpenses: 40_000, dependents: 1, debts: [] }));
    expect(x.needed).toBe(x.byIncome);
  });

  it("with nobody depending on the income, neither view asks for cover", () => {
    const x = t(p({ dependents: 0, debts: [{ id: "d", label: "Loan", outstanding: 9_000_000, ratePct: 9, emi: 5_000 }] }));
    expect(x).toMatchObject({ byIncome: 0, byNeeds: 0, needed: 0, gap: 0 });
  });

  it("the three demo personas keep the figures they had before the change", () => {
    for (const persona of [PRIYA, RAMESH, ANITA]) {
      const x = t(persona);
      const multiple = persona.dependents === 0 ? 0 : Math.min(av("insurance.term.multiple_cap"), av("insurance.term.multiple_base") + (persona.dependents - 1) * av("insurance.term.multiple_per_dependent"));
      expect(x.needed, persona.id).toBe(persona.monthlyIncome * 12 * multiple);
    }
  });

  it("shows both parts, each with its formula, in the evidence", () => {
    const r = termInsurance(p({ dependents: 2 }));
    expect(r.formula).toMatch(/\(a\).*income.*multiple/i);
    expect(r.formula).toMatch(/\(b\).*outstanding loans.*years of support/i);
    expect(r.assumptionIds).toContain("insurance.term.support_years");
    const e = runEngine(p({ dependents: 2 }));
    for (const k of ["ins.term.byIncome", "ins.term.byNeeds", "ins.term.debts", "ins.term.support"]) expect(e.flat[k], k).toBeDefined();
    expect(findResult(e, "ins.term.byNeeds")?.id).toBe("ins.term");
  });

  it("the plan text cites both parts (English, Hindi, Tamil)", () => {
    const x = p({ dependents: 2, insurance: [], goals: [] });
    for (const lang of ["en", "hi", "ta"] as const) {
      const item = (localFixture({ task: "draftPlanPack", language: lang, profile: x }) as PlanPack).items.find((i) => i.topic === "term_cover")!;
      expect(item, lang).toBeTruthy();
      expect(item.evidenceRefs).toEqual(expect.arrayContaining(["ins.term.byIncome", "ins.term.byNeeds"]));
    }
  });
});

describe("employer-provided cover is optional, and unknown is not zero", () => {
  const dep = { dependents: 2, insurance: [{ id: "i1", kind: "term" as const, cover: 1_000_000 }] };

  it("unknown: counted as zero for the gap, and the result says it is unknown", () => {
    const r = termInsurance(p(dep));
    expect(r.inputs.employerCoverKnown).toBe(false);
    expect(r.assumptions.join(" ")).toMatch(/UNKNOWN/);
    expect((r.value as Record<string, number>).employer).toBe(0);
  });

  it("entered: added to the cover and the gap shrinks", () => {
    const unknown = t(p(dep));
    const known = t(p({ ...dep, employerTermCover: 3_000_000 }));
    expect(known.cover).toBe(unknown.cover + 3_000_000);
    expect(known.gap).toBeLessThan(unknown.gap);
    expect(termInsurance(p({ ...dep, employerTermCover: 3_000_000 })).assumptions.join(" ")).toMatch(/Includes the employer cover/);
  });

  it("entering zero is a statement that there is none (different from unknown)", () => {
    expect(termInsurance(p({ ...dep, employerTermCover: 0 })).inputs.employerCoverKnown).toBe(true);
  });
});
