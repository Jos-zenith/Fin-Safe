// Phase H: the composite score never stands without the numbers behind it, and every screen that shows an unreviewed
// plan carries the DRAFT mark (and the print rules that keep it on paper).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ANITA, PRIYA, RAMESH, emptyProfile } from "@/data/personas";
import { runEngine } from "@/lib/engine";
import { mockAnswer } from "@/lib/ai/mock";
import type { Lang, UserProfile } from "@/types";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
const LANGS: Lang[] = ["en", "hi", "ta"];
const QUESTIONS: Record<Lang, string> = { en: "What is my score?", hi: "मेरा स्कोर क्या है?", ta: "என் ஸ்கோர் என்ன?" };

/** A profile with every check comfortably met, so the "weakest area" branch has nothing to say. */
const SOUND: UserProfile = {
  ...PRIYA,
  monthlyIncome: 100000,
  essentialExpenses: 20000,
  liquidSavings: 400000,
  otherExpenses: 10000,
  debts: [],
  dependents: 0,
  familySize: 1,
  insurance: [{ id: "h1", kind: "health", cover: 1000000 }],
  holdings: [],
  goals: [],
};

describe("the composite score is never given on its own", () => {
  for (const [name, p] of Object.entries({ PRIYA, RAMESH, ANITA, SOUND, EMPTY: emptyProfile("en") })) {
    for (const lang of LANGS) {
      it(`${name} / ${lang}: an answer that quotes the score also quotes at least one underlying number`, () => {
        const profile = { ...p, language: lang };
        const a = mockAnswer(QUESTIONS[lang], lang, profile, runEngine(profile));
        if (a.refused || !a.answer.includes("{{health.score}}")) return;
        const others = [...a.answer.matchAll(/\{\{([a-zA-Z0-9_.]+)\}\}/g)].map((m) => m[1]).filter((k) => k !== "health.score");
        expect(others.length, a.answer).toBeGreaterThan(0);
      });
    }
  }
});

describe("the DRAFT mark", () => {
  // every screen that shows a plan which has not been approved
  const SCREENS = ["src/app/advice/[caseId]/page.tsx", "src/app/adviser/case/[caseId]/page.tsx", "src/app/actions/page.tsx", "src/app/case/[caseId]/audit/page.tsx"];
  for (const file of SCREENS) {
    it(`${file} shows the watermark and only while the plan is not approved`, () => {
      const src = read(file);
      expect(src).toContain("<DraftWatermark />");
      expect(src).toMatch(/!approved && <DraftWatermark \/>|!w\.approved && <DraftWatermark|!approved\s*&&\s*<DraftWatermark|status !== "APPROVED" && <DraftWatermark|<DraftWatermark \/>\s*\{\/\*/);
    });
  }

  it("the component is not clickable, is hidden from screen readers and prints a banner", () => {
    const src = read("src/components/Watermark.tsx");
    expect(src).toContain("pointer-events-none");
    expect(src).toContain("aria-hidden");
    expect(src).toContain("print:block");
    expect(src).toContain('data-testid="draft-watermark"');
  });

  it("the stylesheet keeps colours when printing, repeats the mark on every page and leaves the navigation out", () => {
    const css = read("src/app/globals.css");
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toContain("print-color-adjust: exact");
    expect(print).toMatch(/\.draft-watermark\s*\{[^}]*position:\s*fixed/);
    expect(print).toMatch(/header,[\s\S]*display:\s*none/);
  });

  it("the print banner and the watermark are worded in all three languages", () => {
    for (const lang of LANGS) {
      const dict = JSON.parse(read(`src/i18n/${lang}.json`)) as Record<string, string>;
      expect(dict["draft.watermark"], `${lang} draft.watermark`).toBeTruthy();
      expect(dict["draft.print"], `${lang} draft.print`).toBeTruthy();
    }
  });
});

describe("the dashboard's first view", () => {
  const dash = read("src/app/dashboard/page.tsx");
  it("shows the lead step and no more than three findings, with a way to see everything", () => {
    expect(dash).toContain("engine.flags.filter((x) => x.severity !== \"low\").slice(0, 3)");
    expect(dash).toContain('data-testid="home-first"');
    expect(dash).toContain('data-testid={showAll ? "show-fewer" : "see-all"}');
  });
  it("keeps the composite score summary out of the first view", () => {
    const first = dash.slice(dash.indexOf('data-testid="home-first"'), dash.indexOf("showAll && ("));
    expect(first).not.toContain("<WhereYouStand");
    expect(first).not.toContain("ScoreRing");
  });
  it("the adviser snapshot has no bare score cell", () => {
    const adviser = read("src/app/adviser/case/[caseId]/page.tsx");
    expect(adviser).not.toMatch(/\[t\("snap\.score"\), String\(f\["health\.score"\]\)\]/);
    expect(adviser).toContain('data-testid="adviser-score"');
  });
});
