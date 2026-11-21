// View helpers over a case, and the demo-persona wording. The case LIFECYCLE (claim, decide, approve, return, reply)
// is enforced on the server and tested in tests/workflow-api.test.ts.
import { describe, expect, it } from "vitest";
import { ADVISER, ADVISER_CARD_SENTENCE, DEMO_WORKFLOW_SENTENCE, NO_REGISTRATION, REVIEWED_SENTENCE, ACK_SENTENCE } from "@/data/adviser";
import { PRIYA } from "@/data/personas";
import { localFixture } from "@/lib/ai/run";
import type { PlanPack } from "@/lib/ai/schemas";
import { CHECKLIST_IDS, checklistComplete, reviewedItems, statusForUser, wordDiff } from "@/lib/cases";
import { en, hi, ta } from "./helpers";
import type { Case } from "@/types";

const plan = () => localFixture({ task: "draftPlanPack", language: "en", profile: PRIYA }) as PlanPack;

describe("view helpers", () => {
  it("the checklist has seven items and approval needs all of them, including the assumptions acknowledgement", () => {
    expect(CHECKLIST_IDS).toEqual(["suitability", "risk", "conflicts", "fee", "language", "assumptions", "demo_ack"]);
    const all = Object.fromEntries(CHECKLIST_IDS.map((id) => [id, true]));
    expect(checklistComplete({ checklist: all })).toBe(true);
    expect(checklistComplete({ checklist: { ...all, assumptions: false } })).toBe(false);
    expect(checklistComplete({ checklist: { ...all, demo_ack: false } })).toBe(false);
    expect(checklistComplete({ checklist: {} })).toBe(false);
  });
  it("reviewedItems shows the adviser's edit while the AI draft itself stays frozen", () => {
    const p = plan();
    const id = p.items[0].id;
    const c = { plan: p, reviews: { [id]: { decision: "edited" as const, edit: { rationale: "A calmer rationale.", lang: "en" as const } }, [p.items[1].id]: { decision: "rejected" as const, comment: "n/a" } } } as Pick<Case, "plan" | "reviews">;
    const rows = reviewedItems(c);
    expect(rows[0].edited).toBe(true);
    expect(rows[0].rationale).toBe("A calmer rationale.");
    expect(rows[0].item.rationale).toBe(p.items[0].rationale);
    expect(rows[1].decision).toBe("rejected");
    expect(rows[2].decision).toBe("pending");
  });
  it("statusForUser orders the five steps", () => {
    expect(["INTAKE_DONE", "DRAFT_READY", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"].map((s) => statusForUser(s as never))).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("draft vs reviewed diff", () => {
  it("shows additions and deletions between the AI draft and the edit", () => {
    const parts = wordDiff("Consider building a reserve now", "Consider building a small reserve soon");
    expect(parts.some((p) => p.t === "add" && p.s.includes("small"))).toBe(true);
    expect(parts.some((p) => p.t === "del" && p.s.includes("now"))).toBe(true);
    expect(parts.filter((p) => p.t === "same").map((p) => p.s).join(" ")).toContain("Consider building");
  });
});

describe("persona / demo-workflow wording", () => {
  it("adviser has no registration field, only the demo-persona text", () => {
    expect(ADVISER.isSynthetic).toBe(true);
    expect(Object.keys(ADVISER).join()).not.toMatch(/regist|license|ina|inh|inp/i);
    expect(NO_REGISTRATION).toBe("No registration (demo persona)");
  });
  it("required English sentences are exact in the UI dictionary", () => {
    expect(en["legal.demoWorkflow"]).toBe(DEMO_WORKFLOW_SENTENCE);
    expect(en["legal.reviewed"]).toBe(REVIEWED_SENTENCE);
    expect(en["legal.adviserCard"]).toBe(ADVISER_CARD_SENTENCE);
    expect(en["legal.noReg"]).toBe(NO_REGISTRATION);
    expect(en["legal.ack"]).toBe(ACK_SENTENCE);
    expect(en["adv.approve"]).toBe("Approve (demo)");
  });
  it("no INA / INH / INP shaped number exists in any dictionary", () => {
    for (const d of [en, hi, ta]) expect(JSON.stringify(d)).not.toMatch(/\bIN[AHP]\d{6,}\b/);
  });
});
