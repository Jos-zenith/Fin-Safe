import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ASSUMPTIONS, assumption, av, statusOf, unverifiedIn } from "@/config/assumptions";
import { ANITA, PRIYA, RAMESH, emptyProfile } from "@/data/personas";
import { assumptionIdsFor, impliedAnnual, marketFall, runEngine } from "@/lib/engine";
import { exploreGoal } from "@/lib/engine/explore";

describe("assumption registry", () => {
  it("has unique ids and every field the spec requires", () => {
    const ids = ASSUMPTIONS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of ASSUMPTIONS) {
      expect(x.id, x.id).toMatch(/^[a-z_.0-9]+$/);
      expect(typeof x.value).toBe("number");
      expect(x.unit).toBeTruthy();
      expect(x.description.length, x.id).toBeGreaterThan(10);
      expect(x.source.length).toBeGreaterThan(0);
      expect(x.asOf.length).toBeGreaterThan(0);
      expect(x.applicability.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(x.confidence);
      expect(["unverified", "reviewed"]).toContain(x.reviewStatus);
    }
  });

  it("nothing is pre-marked reviewed, and no source is invented", () => {
    for (const x of ASSUMPTIONS) {
      expect(x.reviewStatus, x.id).toBe("unverified");
      expect(x.reviewedBy).toBeUndefined();
      expect(x.reviewedOn).toBeUndefined();
      expect(x.source, x.id).toBe("demo placeholder, TO_VERIFY");
      expect(x.confidence).toBe("low");
    }
  });

  it("taxes are listed as NOT modelled", () => {
    expect(assumption("tax.not_modelled").notModelled).toBe(true);
  });

  it("an adviser review changes the effective status but never the code default", () => {
    expect(statusOf("return.base")).toBe("unverified");
    expect(statusOf("return.base", { "return.base": { by: "Dr. Demo", on: "2026-11-20" } })).toBe("reviewed");
    expect(statusOf("return.low", { "return.base": { by: "x", on: "y" } })).toBe("unverified");
    expect(unverifiedIn(["return.base", "return.low"], { "return.base": { by: "x", on: "y" } })).toEqual(["return.low"]);
  });

  it("'not modelled' entries are never reported as unverified numbers", () => {
    expect(unverifiedIn(["tax.not_modelled", "return.base"])).toEqual(["return.base"]);
  });

  it("an unknown id is an error, not a silent zero", () => {
    expect(() => av("no.such.thing")).toThrow(/unknown assumption/);
  });
});

describe("the engine reads only from the registry", () => {
  const dir = path.resolve(__dirname, "../src/lib/engine");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));

  /** Remove comments, strings and template text so only code is left. */
  const code = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/`(?:\\.|[^`\\])*`/g, "``")
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''");

  // 0, 1, 2 (arithmetic), 12 (months in a year) and 100 (percent) are unit conversions, not financial constants.
  const ALLOWED = new Set(["0", "1", "2", "12", "100"]);

  for (const f of files) {
    it(`${f} has no hardcoded financial constants`, () => {
      const src = code(readFileSync(path.join(dir, f), "utf8"));
      const literals = [...src.matchAll(/(?<![\w.$])(\d+(?:\.\d+)?)(?![\w.])/g)].map((m) => m[1]).filter((n) => !ALLOWED.has(n));
      expect(literals, `${f}: move these to src/config/assumptions.ts`).toEqual([]);
    });
    it(`${f} does not import the legacy constants module`, () => {
      expect(readFileSync(path.join(dir, f), "utf8")).not.toMatch(/config\/constants/);
    });
  }
});

describe("every engine result lists the assumptions it used", () => {
  const profiles = [PRIYA, RAMESH, ANITA, emptyProfile("en")];
  it("all results carry at least one id, and every id exists in the registry", () => {
    for (const p of profiles) {
      for (const r of runEngine(p).results) {
        expect(Array.isArray(r.assumptionIds), `${p.id} ${r.id}`).toBe(true);
        expect(r.assumptionIds.length, `${p.id} ${r.id}`).toBeGreaterThan(0);
        for (const id of r.assumptionIds) expect(() => assumption(id), `${r.id} -> ${id}`).not.toThrow();
      }
    }
  });
  it("explorer, market fall and the implied-rate helper list ids that exist (or none)", () => {
    for (const r of [exploreGoal({ id: "g", targetAmount: 1, years: 2 }, 1), marketFall([{ amount: 1 }]), impliedAnnual(3)]) {
      for (const id of r.assumptionIds) expect(() => assumption(id)).not.toThrow();
    }
  });
  it("goal results depend on inflation, fees and the return scenarios, and say taxes are not modelled", () => {
    const e = runEngine(PRIYA);
    const ids = assumptionIdsFor(e, ["goal.g1.sip"]);
    for (const id of ["inflation.base", "inflation.high", "inflation.low", "fee.expense_ratio", "return.base", "tax.not_modelled"]) expect(ids).toContain(id);
  });
  it("by default every result is built on unverified assumptions", () => {
    const e = runEngine(PRIYA);
    for (const r of e.results) expect(unverifiedIn(r.assumptionIds).length, r.id).toBeGreaterThan(0);
  });
});
