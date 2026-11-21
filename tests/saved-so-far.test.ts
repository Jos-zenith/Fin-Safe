// "Savings already set aside for a goal" is counted end to end: the intake can collect it, both API schemas keep it,
// the engine deducts it (with growth), and the figure the person SEES (plan text, findings) changes with it.
//
// A reviewer said the AI request schema lacked savedSoFar. That was true of /api/ai (src/lib/ai/request.ts), whose
// Zod object silently stripped the field, and false of the workflow API (src/server/api.ts). Both are pinned here.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PRIYA } from "@/data/personas";
import { OPTIONAL_STEPS } from "@/components/IntakeInput";
import { goalFeasibility } from "@/lib/engine";
import { RequestSchema } from "@/lib/ai/request";
import { POST as aiRoute } from "@/app/api/ai/route";
import { setStoreForTests } from "@/server/store";
import type { UserProfile } from "@/types";
import { expectOk, makeApp, submitBody } from "./server-helpers";

let app: Awaited<ReturnType<typeof makeApp>>;
beforeEach(async () => {
  app = await makeApp();
});
afterEach(() => setStoreForTests(null));

const withSaved = (saved: number): UserProfile => ({
  ...structuredClone(PRIYA),
  id: "fresh",
  goals: [{ id: "g1", kind: "home", targetAmount: 2_000_000, years: 10, savedSoFar: saved }],
});
const amounts = (s: string) => [...s.matchAll(/₹([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));

describe("existing goal savings reach the screen", () => {
  it("the intake offers it as an optional 'Improve accuracy' question", () => {
    expect(OPTIONAL_STEPS).toContain("goalSaved");
  });

  it("the engine: more saved means a smaller monthly amount, and the saved amount is carried in the evidence", () => {
    const none = goalFeasibility({ id: "g", targetAmount: 2_000_000, years: 10, savedSoFar: 0 });
    const some = goalFeasibility({ id: "g", targetAmount: 2_000_000, years: 10, savedSoFar: 500_000 });
    for (const k of ["low", "base", "high"]) expect((some.value as Record<string, number>)[k]).toBeLessThan((none.value as Record<string, number>)[k]);
    expect(some.inputs.savedSoFar).toBe(500_000);
  });

  it("the workflow API keeps savedSoFar and the plan text a customer sees shows a lower monthly amount", async () => {
    const shown: Record<string, number[]> = {};
    for (const [label, saved] of [["none", 0], ["some", 500_000]] as const) {
      const c = await app.as("fresh");
      expectOk(await c.put("me/profile", withSaved(saved)));
      const stored = await c.get("me");
      expect(stored.body.profile.goals[0].savedSoFar).toBe(saved);
      const made = await c.post("cases", submitBody());
      expect(made.status).toBe(200);
      const item = made.body.case.plan.items.find((i: { goalRef?: string }) => i.goalRef === "g1");
      expect(item, "a goal item exists").toBeTruthy();
      shown[label] = amounts(`${item.rationale} ${item.rangeNote ?? ""}`);
    }
    // "from {high-return monthly amount} to {low-return monthly amount}": the first two figures in the range note
    expect(shown.none.length).toBeGreaterThan(1);
    expect(shown.some.length).toBeGreaterThan(1);
    expect(shown.some[0]).toBeLessThan(shown.none[0]);
    expect(shown.some[1]).toBeLessThan(shown.none[1]);
  });

  it("two anonymous visitors can each get a case (their case ids must not collide)", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const c = await app.as("fresh");
      expectOk(await c.put("me/profile", withSaved(0)));
      const made = await c.post("cases", submitBody());
      expect(made.status).toBe(200);
      ids.push(made.body.case.id);
    }
    expect(new Set(ids).size).toBe(2);
  });

  it("/api/ai keeps savedSoFar instead of stripping it (the reviewer's point was right for this schema)", async () => {
    const parsed = RequestSchema.parse({ task: "explainFindings", language: "en", profile: withSaved(500_000) });
    expect(parsed.profile?.goals[0].savedSoFar).toBe(500_000);

    const ask = async (saved: number) => {
      const res = await aiRoute(new Request("http://localhost/api/ai", { method: "POST", body: JSON.stringify({ task: "explainFindings", language: "en", profile: withSaved(saved) }) }));
      expect(res.status).toBe(200);
      return amounts(((await res.json()) as { data: { findings: { goals?: string } } }).data.findings.goals ?? "");
    };
    const none = await ask(0);
    const some = await ask(500_000);
    expect(none.length).toBeGreaterThan(1);
    expect(some[0]).toBeLessThan(none[0]);
  });
});
