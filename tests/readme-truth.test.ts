// The README and docs must not contradict the implementation. This test fails if a statement that was true of an
// earlier build (and false now) comes back, and it pins the README's numbers to the constants in code.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { av } from "@/config/assumptions";
import { CHECKLIST_IDS, POLL_MS_DEFAULT, RETENTION_HOURS, SLA_MINUTES } from "@/config/workflow";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const docs = ["README.md", ...readdirSync(path.join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)];

/** Statements that were removed because the server workflow, the registry and the goal maths made them false. */
export const REMOVED_PHRASES: RegExp[] = [
  /There is no backend state/i,
  /two views of one browser tab/i,
  /Not multi-party\./,
  /Goal SIPs start from zero/i,
  /existing goal savings are not counted/i,
  /do not adjust the target for inflation/i,
  /Users type 16 answers/i,
  /Server: no database/i,
  /all six checklist items/i,
  /constants\.ts \(TO_VERIFY figures\)/i,
  /the human-in-the-loop is simulated\. A real version needs authentication, a database/i,
];

describe("no document says what an earlier build did", () => {
  for (const file of docs) {
    it(`${file} has none of the removed statements`, () => {
      const text = read(file);
      for (const p of REMOVED_PHRASES) expect(text, `${file} still says ${p}`).not.toMatch(p);
    });
  }

  it("the check itself works: it would catch the old README line", () => {
    const old = "There is no backend state. The customer and the adviser console are two views of one browser tab's sessionStorage";
    expect(REMOVED_PHRASES.some((p) => p.test(old))).toBe(true);
  });
});

describe("the README agrees with the code", () => {
  const readme = read("README.md");
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

  it("has exactly one 'What is real, simulated and not built' table", () => {
    expect(readme.match(/^## What is real, simulated and not built/gm)).toHaveLength(1);
    expect(readme.match(/^\| Area \| Status \| Honest detail \|/gm)).toHaveLength(1);
  });

  it("names the right number of checklist items", () => {
    const m = /all (\w+) checklist items/.exec(readme);
    expect(m, "README says how many checklist items approval needs").toBeTruthy();
    expect(WORDS.indexOf(m![1])).toBe(CHECKLIST_IDS.length);
  });

  it("states the SLA, the poll interval and the retention hours that the code uses", () => {
    expect(readme).toContain(`SLA (${SLA_MINUTES} minutes`);
    expect(readme).toContain(`(${POLL_MS_DEFAULT / 1000} s;`);
    expect(readme).toContain(`idle for ${RETENTION_HOURS} hours`);
  });

  it("says existing goal savings ARE counted, in the README and in the assumptions doc alike", () => {
    expect(readme).toMatch(/savings already set aside for a goal are counted with growth/i);
    expect(read("docs/ASSUMPTIONS.md")).toMatch(/Savings already set aside for the goal are counted/);
  });

  it("the README's AI status names the Settings line, and says no output was live unless a live run is recorded", () => {
    expect(readme).toMatch(/Last N AI outputs on this server/);
    expect(readme).toMatch(/GET \/api\/v1\/ai\/status/);
    const ran = existsSync(path.join(root, "docs/live-smoke.md"));
    if (!ran) expect(readme).toMatch(/none were live/);
    else expect(readme).not.toMatch(/none were live/);
  });

  it("the README's npm audit story matches the package and says what is not known", () => {
    const pkg = JSON.parse(read("package.json")) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies.vitest).toMatch(/^\^5\./);
    expect(read("vitest.config.mts")).toMatch(/root cause not found/i);
    expect(readme).toMatch(/\*\*3\*\* \(1 moderate, 2 critical\)/);
    expect(readme).toMatch(/now report \*\*0\*\* vulnerabilities/);
    expect(readme).toMatch(/root cause was not found/i);
  });

  it("the README describes the dashboard's short first view and the draft mark the code has", () => {
    expect(readme).toMatch(/the first thing to fix \(the current step on the financial ladder\)/i);
    expect(readme).toContain("See all measures");
    expect(readme).toMatch(/DRAFT · NOT FINAL/);
    expect(readme).toMatch(/DRAFT, printed copy/);
    const en = JSON.parse(read("src/i18n/en.json")) as Record<string, string>;
    expect(en["dash.prio.all"]).toBe("See all {n} measures");
    expect(en["draft.watermark"]).toBe("DRAFT · NOT FINAL");
    expect(en["draft.print"]).toMatch(/^DRAFT, printed copy/);
  });

  it("every file the README names in its architecture block exists", () => {
    const block = /```\nsrc\/config[\s\S]*?```/.exec(readme)?.[0] ?? "";
    expect(block).not.toBe("");
    for (const f of ["assumptions.ts", "workflow.ts", "brand.ts", "economics.ts", "constants.ts"]) expect(existsSync(path.join(root, "src/config", f)), f).toBe(true);
    for (const f of ["api.ts", "auth.ts", "workflow.ts", "improve.ts", "metrics.ts", "retention.ts"]) expect(existsSync(path.join(root, "src/server", f)), f).toBe(true);
  });
});

describe("threshold tables in the docs agree with the registry", () => {
  for (const file of ["docs/FINANCIAL_LADDER.md", "docs/INPUT_QUALITY.md"]) {
    const doc = read(file);
    const rows = [...doc.matchAll(/^\| `([a-z_.0-9]+)` \| ([\d.]+) \|/gm)];

    it(`${file}: lists its thresholds, and every value equals the registry value`, () => {
      expect(rows.length).toBeGreaterThanOrEqual(6);
      for (const [, id, value] of rows) expect(av(id), `${file} ${id}`).toBe(Number(value));
    });

    it(`${file}: says plainly that the constants are unverified placeholders`, () => {
      expect(doc).toMatch(/unverified demo placeholder/);
    });
  }

  it("FINANCIAL_LADDER.md says it is not an instruction, and records the before and after of the shortfall scenario", () => {
    const doc = read("docs/FINANCIAL_LADDER.md");
    expect(doc).toMatch(/not\*\* an instruction to buy, sell or repay/);
    expect(doc).toMatch(/\*\*Before\*\*/);
    expect(doc).toMatch(/\*\*After\*\*/);
    expect(doc).toContain("cash_shortfall:high");
  });

  it("INPUT_QUALITY.md says no metric can read High while assumptions are unreviewed, and lists what is not modelled", () => {
    const doc = read("docs/INPUT_QUALITY.md");
    expect(doc).toMatch(/no metric can show High in the demo/);
    expect(doc).toMatch(/room-rent limits/);
    expect(read("docs/ASSUMPTIONS.md")).toMatch(/health\.room_rent\.not_modelled/);
    expect(read("docs/ASSUMPTIONS.md")).toMatch(/health\.hospital_costs\.not_modelled/);
    expect(read("docs/ASSUMPTIONS.md")).toMatch(/health\.exclusions\.not_modelled/);
  });
});
