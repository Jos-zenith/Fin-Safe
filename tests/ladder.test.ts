// The financial-priority ladder: cash flow, then the reserve, then loans, then cover, and only then goal investing.
// A plan must not lead with a goal amount for someone whose month does not add up (or who is blocked at any earlier
// step), in any language, and no part of the system (fixture, live model, nudge) may slip a goal amount through.
import { describe, expect, it } from "vitest";
import { av } from "@/config/assumptions";
import { PRIYA } from "@/data/personas";
import { checkGuardrails } from "@/lib/ai/guardrails";
import { runTask } from "@/lib/ai/run";
import { localFixture } from "@/lib/ai/run";
import type { PlanPack } from "@/lib/ai/schemas";
import type { LLM } from "@/lib/ai/providers";
import { LADDER_ORDER, runEngine } from "@/lib/engine";
import { inr } from "@/lib/format";
import type { Lang, LadderStepId, UserProfile } from "@/types";

const LANGS: Lang[] = ["en", "hi", "ta"];

/** A comfortable salaried baseline; each test changes only what it is about. */
const base = (o: Partial<UserProfile> = {}): UserProfile => ({
  ...structuredClone(PRIYA),
  id: "t",
  name: "Test",
  age: 35,
  incomeStable: true,
  monthlyIncome: 100_000,
  essentialExpenses: 30_000,
  otherExpenses: 10_000,
  dependents: 0,
  familySize: 1,
  liquidSavings: 300_000,
  goals: [{ id: "g1", kind: "home", targetAmount: 2_000_000, years: 10 }],
  debts: [],
  insurance: [{ id: "i1", kind: "health", cover: 1_000_000 }],
  holdings: [],
  risk: { onFall: "wait", followsTips: false },
  ...o,
});
const debt = (ratePct: number, emi: number, outstanding = 400_000) => ({ id: "d1", label: "Loan", outstanding, ratePct, emi });

const GOAL_TOPICS = ["goal_short", "goal_mid", "goal_long"];
const plan = (p: UserProfile, lang: Lang = "en") => localFixture({ task: "draftPlanPack", language: lang, profile: p }) as PlanPack;
const status = (e: ReturnType<typeof runEngine>, id: LadderStepId) => e.ladder.steps.find((s) => s.id === id)!;

interface Case {
  name: string;
  profile: UserProfile;
  blocker: LadderStepId | null;
  reason?: string;
  /** The first plan item must be this topic (the headline is the first step that needs work, never a goal). */
  headline?: string;
}

const CASES: Case[] = [
  { name: "healthy salaried", profile: base(), blocker: null },
  { name: "shortfall (25,000 income, 18,000 essentials, 10,000 EMIs)", profile: base({ monthlyIncome: 25_000, essentialExpenses: 18_000, otherExpenses: 0, liquidSavings: 40_000, debts: [debt(11, 10_000)], insurance: [] }), blocker: "cash_flow", reason: "shortfall", headline: "cash_flow" },
  { name: "near-zero surplus", profile: base({ monthlyIncome: 40_000, essentialExpenses: 25_000, otherExpenses: 10_000, debts: [debt(10, 4_000, 300_000)] }), blocker: "cash_flow", reason: "near_zero", headline: "cash_tight" },
  { name: "heavy EMIs", profile: base({ monthlyIncome: 100_000, essentialExpenses: 20_000, otherExpenses: 5_000, liquidSavings: 400_000, debts: [debt(9, 45_000, 3_000_000)] }), blocker: "debt", reason: "heavy", headline: "loan_load" },
  { name: "no emergency fund but healthy income", profile: base({ monthlyIncome: 80_000, liquidSavings: 10_000 }), blocker: "liquidity", reason: "severe", headline: "emergency_reserve" },
  { name: "high-cost debt plus savings", profile: base({ monthlyIncome: 90_000, debts: [debt(24, 8_000)] }), blocker: "debt", reason: "high_cost", headline: "high_cost_debt" },
  { name: "irregular income, reserve below the longer target", profile: base({ incomeStable: false, monthlyIncome: 80_000, liquidSavings: 150_000 }), blocker: null, headline: "emergency_reserve" },
  { name: "already-met goal", profile: base({ goals: [{ id: "g1", kind: "home", targetAmount: 1_000_000, years: 5, savedSoFar: 5_000_000 }] }), blocker: null },
  { name: "dependents with almost no term cover", profile: base({ dependents: 2, familySize: 3, insurance: [{ id: "i1", kind: "health", cover: 1_600_000 }, { id: "i2", kind: "term", cover: 500_000 }] }), blocker: "protection", reason: "term_gap", headline: "term_cover" },
];

describe("which step is the first blocker (8+ profiles)", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const e = runEngine(c.profile);
      expect(e.ladder.firstBlocker, JSON.stringify(e.ladder.steps.map((s) => [s.id, s.status, s.reason]))).toBe(c.blocker);
      expect(e.ladder.goalsLater).toBe(c.blocker !== null);
      if (c.blocker && c.reason) expect(status(e, c.blocker).reason).toBe(c.reason);

      // every language: the plan opens with the first step that needs work, never with a goal
      for (const lang of LANGS) {
        const p = plan(c.profile, lang);
        const topics = p.items.map((i) => i.topic);
        if (c.headline) expect(topics[0], `${lang}: ${topics.join(",")}`).toBe(c.headline);
        if (e.ladder.firstOpen) expect(GOAL_TOPICS, `${lang}: a goal must not be the headline`).not.toContain(topics[0]);

        if (c.blocker) {
          // blocked: no goal item carries an amount; each goal is a "later" item
          expect(topics.filter((t) => GOAL_TOPICS.includes(t)), `${lang}: no goal amount item while blocked`).toEqual([]);
          expect(topics.filter((t) => t === "goals_later")).toHaveLength(c.profile.goals.length);
          expect(topics[topics.length - 1]).toBe("goals_later");
          const text = JSON.stringify(p);
          for (const k of ["low", "base", "high"]) expect(text, `${lang}: SIP ${k} leaked`).not.toContain(inr(e.flat[`goal.g1.sip.${k}`]));
          expect(text).not.toContain("{{");
        } else {
          expect(topics.filter((t) => t === "goals_later")).toEqual([]);
        }
      }
    });
  }

  it("a profile with nothing blocked shows the monthly goal range as before", () => {
    const e = runEngine(CASES[0].profile);
    const goal = plan(CASES[0].profile).items.find((i) => GOAL_TOPICS.includes(i.topic))!;
    expect(goal.rangeNote).toContain(inr(e.flat["goal.g1.sip.base"] * 0 + e.flat["goal.g1.sip.high"]));
  });

  it("an already-met goal needs no monthly amount, and the ladder does not hold it back", () => {
    const e = runEngine(CASES[7].profile);
    expect(e.flat["goal.g1.sip.base"]).toBe(0);
    expect(status(e, "goals").status).toBe("ok");
  });

  it("irregular income raises the reserve target, and the shortfall in reserve is attention, not a blocker", () => {
    const e = runEngine(CASES[6].profile);
    expect(e.flat["ef.target"]).toBe(av("ef.months.irregular"));
    expect(status(e, "liquidity").status).toBe("attention");
    expect(e.ladder.goalsLater).toBe(false);
  });
});

describe("the ladder never turns into an instruction about a named product", () => {
  const strings = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
    else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
    return out;
  };
  for (const c of CASES) {
    for (const lang of LANGS) {
      it(`${c.name} / ${lang}: no guardrail hit in the plan or the findings`, () => {
        const texts = [...strings(plan(c.profile, lang)), ...strings(localFixture({ task: "explainFindings", language: lang, profile: c.profile }))];
        expect(texts.length).toBeGreaterThan(0);
        for (const t of texts) expect(checkGuardrails(t), t).toEqual([]);
      });
    }
  }
});

describe("the shortfall scenario: income 25,000, essentials 18,000, EMIs 10,000", () => {
  const p = CASES[1].profile;
  const e = runEngine(p);

  it("shows a monthly gap of 3,000 and a cash-flow flag (the old engine said 28% saved)", () => {
    expect(e.flat["cash.surplus"]).toBe(-3_000);
    expect(e.flat["cash.shortfall"]).toBe(3_000);
    expect(e.flags.map((f) => f.id)).toContain("cash_shortfall");
    expect(e.flat["save.monthly"]).toBe(0);
  });

  for (const lang of LANGS) {
    it(`${lang}: cash-flow-first plan, goals only as "later", no headline SIP`, () => {
      const out = plan(p, lang);
      expect(out.items[0].topic).toBe("cash_flow");
      expect(out.priorities[0]).toBe("p-cash_flow");
      expect(out.items.find((i) => i.topic === "goals_later")?.rangeNote).toBeTruthy();
      const text = JSON.stringify(out);
      expect(text).toContain(inr(3_000)); // the gap is stated
      expect(text).not.toMatch(/sip/i);
      const findings = localFixture({ task: "explainFindings", language: lang, profile: p }) as { findings: Record<string, string> };
      expect(findings.findings.cash).toContain(inr(3_000));
      expect(findings.findings.savings).toBeUndefined(); // "you save X a month" would be false
      expect(JSON.stringify(findings)).not.toContain(inr(e.flat["goal.g1.sip.base"]));
    });
  }
});

describe("nothing can slip a goal amount through while a step is blocked", () => {
  const blocked = CASES[1].profile;
  const live = (payload: unknown): LLM => ({ name: "anthropic", generate: async () => JSON.stringify(payload) });

  it("a live plan that cites a goal SIP is rejected and replaced by the validated fixture", async () => {
    const cheating: PlanPack = {
      lang: "en",
      summary: "Draft plan, not final.",
      priorities: ["p-goal"],
      items: [{ id: "p-goal", topic: "goal_long", assetClass: "equity", goalRef: "g1", title: "Plan for your home goal", rationale: "The monthly amount may be {{goal.g1.sip.base}}.", risks: "Returns are not promised.", evidenceRefs: ["goal.g1.sip"] }],
      checklist: [],
      adviserQuestions: [],
    };
    const r = await runTask({ task: "draftPlanPack", language: "en", profile: blocked }, { llm: live(cheating) });
    expect(r.source).toBe("fixture");
    expect(r.events.some((x) => x.kind === "numeric_rejected" && /ladder/.test(x.detail))).toBe(true);
    expect((r.data as PlanPack).items[0].topic).toBe("cash_flow");
  });

  it("the same plan is accepted when nothing is blocked", async () => {
    const ok = base();
    const fine: PlanPack = {
      lang: "en",
      summary: "Draft plan, not final.",
      priorities: ["p-goal"],
      items: [{ id: "p-goal", topic: "goal_long", assetClass: "equity", goalRef: "g1", title: "Plan for your home goal", rationale: "The monthly amount may be {{goal.g1.sip.base}}.", risks: "Returns are not promised.", evidenceRefs: ["goal.g1.sip"] }],
      checklist: [],
      adviserQuestions: [],
    };
    const r = await runTask({ task: "draftPlanPack", language: "en", profile: ok }, { llm: live(fine) });
    expect(r.source).toBe("provider");
  });

  it("the goal-SIP nudge turns into a 'later' sentence, and the cash-flow nudge replaces it", async () => {
    for (const lang of LANGS) {
      const r = await runTask({ task: "nudgeCopy", language: lang, profile: blocked, nudge: { ruleId: "sip_review", goalId: "g1" } });
      expect(r.events).toEqual([]);
      expect((r.data as { text: string }).text).not.toMatch(/₹/);
    }
    const e = runEngine(blocked);
    const { nudgeRules } = await import("@/lib/engine");
    const rules = nudgeRules(blocked, e).map((x) => x.ruleId);
    expect(rules[0]).toBe("cash_flow");
    expect(rules).not.toContain("sip_review");
  });
});

describe("the ladder is part of the numeric ground truth, built from the registry", () => {
  const e = runEngine(CASES[1].profile);

  it("cash-flow and ladder values are in the flattened set the validator uses", () => {
    for (const k of ["cash.income", "cash.essential", "cash.other", "cash.emi", "cash.surplus", "cash.shortfall", "cash.surplusPct", "ladder.blockedCount", "ladder.firstBlockerStep", "ladder.goalsLater", "debt.dtiMark"]) {
      expect(e.flat[k], k).toBeDefined();
      expect(e.units[k], k).toBeDefined();
    }
    expect(e.flat["ladder.firstBlockerStep"]).toBe(1);
    expect(e.flat["ladder.goalsLater"]).toBe(1);
  });

  it("each new result carries { value, formula, inputs, assumptions } and only registry ids", () => {
    for (const id of ["cash", "ladder", "debt.dtiMark"]) {
      const r = e.results.find((x) => x.id === id)!;
      expect(r, id).toBeTruthy();
      expect(r.formula.length).toBeGreaterThan(10);
      expect(r.inputs).toBeTruthy();
      expect(Array.isArray(r.assumptions)).toBe(true);
      for (const a of r.assumptionIds) expect(() => av(a), `${id} -> ${a}`).not.toThrow();
    }
    expect(e.results.find((x) => x.id === "cash")!.assumptionIds).toContain("cashflow.near_zero_pct");
  });

  it("every ladder step names real assumption ids", () => {
    for (const s of e.ladder.steps) for (const a of s.assumptionIds) expect(() => av(a), `${s.id} -> ${a}`).not.toThrow();
    expect(e.ladder.steps.map((s) => s.id)).toEqual([...LADDER_ORDER]);
  });
});

describe("invariants over 300 random profiles", () => {
  // a small seeded generator, so a failure is reproducible
  let seed = 20260101;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const profiles: UserProfile[] = Array.from({ length: 300 }, () => {
    const income = pick([0, 15_000, 25_000, 40_000, 70_000, 120_000, 250_000]);
    const emi = rnd() < 0.5 ? 0 : Math.round(income * rnd() * 0.8);
    return base({
      incomeStable: rnd() < 0.6,
      monthlyIncome: income,
      essentialExpenses: Math.round(income * (0.2 + rnd() * 0.7)),
      otherExpenses: Math.round(income * rnd() * 0.3),
      liquidSavings: Math.round(income * rnd() * 14),
      dependents: pick([0, 1, 2, 3]),
      familySize: pick([1, 2, 3, 4]),
      debts: emi ? [debt(pick([8, 12, 14, 24]), emi, emi * 40)] : [],
      insurance: rnd() < 0.5 ? [] : [{ id: "i1", kind: "health", cover: pick([200_000, 1_000_000, 2_000_000]) }, { id: "i2", kind: "term", cover: pick([0, 1_000_000, 20_000_000]) }],
      goals: rnd() < 0.8 ? [{ id: "g1", kind: "home", targetAmount: pick([300_000, 2_000_000, 9_000_000]), years: pick([2, 7, 15]), savedSoFar: pick([0, 100_000]) }] : [],
    });
  });

  it("goals are held back exactly when an earlier step is blocked, and a goal is never the headline then", () => {
    for (const p of profiles) {
      const e = runEngine(p);
      const anyBlocked = e.ladder.steps.filter((s) => s.id !== "goals").some((s) => s.status === "blocked");
      expect(e.ladder.goalsLater).toBe(anyBlocked);
      expect(status(e, "goals").status).toBe(anyBlocked ? "later" : "ok");
      const out = plan(p);
      const topics = out.items.map((i) => i.topic);
      if (anyBlocked) {
        expect(topics.some((t) => GOAL_TOPICS.includes(t)), JSON.stringify(p)).toBe(false);
        expect(JSON.stringify(out)).not.toMatch(/\{\{goal/);
      }
      if (e.ladder.firstOpen) expect(GOAL_TOPICS).not.toContain(topics[0]);
    }
  });

  it("more EMIs never make the cash-flow step better", () => {
    const rank = { ok: 0, attention: 1, blocked: 2, later: 3 } as const;
    for (const p of profiles.slice(0, 100)) {
      const more = { ...p, debts: [debt(12, p.debts.reduce((a, d) => a + d.emi, 0) + 5_000)] };
      expect(rank[status(runEngine(more), "cash_flow").status]).toBeGreaterThanOrEqual(rank[status(runEngine(p), "cash_flow").status]);
    }
  });
});
