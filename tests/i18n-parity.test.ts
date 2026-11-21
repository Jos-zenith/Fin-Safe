// Hindi and Tamil must carry the SAME numbers and placeholders as English for every string, and every
// non-English string must be marked as awaiting native-speaker review until a named person signs it off.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderTranslationDoc, updateReviewStatus, type ReviewStatus } from "@/lib/translation";
import { en, hi, ta } from "./helpers";

const root = path.resolve(__dirname, "..");
const D = { en, hi, ta } as unknown as Record<"en" | "hi" | "ta", Record<string, string>>;
const EN = en as unknown as Record<string, string>;
const status = JSON.parse(readFileSync(path.join(root, "src/i18n/review-status.json"), "utf8")) as ReviewStatus;

/** Numbers as written, with the {placeholders} removed first; native digits are folded to ASCII. */
const FOLD: Record<string, string> = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9", "௦": "0", "௧": "1", "௨": "2", "௩": "3", "௪": "4", "௫": "5", "௬": "6", "௭": "7", "௮": "8", "௯": "9" };
const numbers = (s: string) =>
  s
    .replace(/\{\w+\}/g, " ")
    .replace(/[०-९௦-௯]/g, (c) => FOLD[c])
    .match(/\d+(?:[.,]\d+)*/g)
    ?.map((n) => n.replace(/,/g, ""))
    .sort()
    .join("|") ?? "";
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

describe("every language says the same numbers and uses the same placeholders", () => {
  for (const lang of ["hi", "ta"] as const) {
    it(`${lang}: same keys, same placeholders, same numbers as English`, () => {
      expect(Object.keys(D[lang]).sort()).toEqual(Object.keys(EN).sort());
      const numberMismatch: string[] = [];
      const placeholderMismatch: string[] = [];
      for (const k of Object.keys(EN)) {
        if (placeholders(D[lang][k]) !== placeholders(EN[k])) placeholderMismatch.push(k);
        if (numbers(D[lang][k]) !== numbers(EN[k])) numberMismatch.push(`${k}: "${numbers(EN[k])}" vs "${numbers(D[lang][k])}"`);
      }
      expect(placeholderMismatch, "placeholders differ").toEqual([]);
      expect(numberMismatch, "numbers differ").toEqual([]);
    });
  }

  it("catches a changed number and a missing placeholder (the check itself works)", () => {
    expect(numbers("Keep under 40%")).not.toBe(numbers("40 से नीचे 50%"));
    expect(numbers("{n} items, 5 left")).toBe(numbers("बाकी 5, {n}"));
    expect(placeholders("Hello {name}")).not.toBe(placeholders("नमस्ते"));
  });
});

describe("translation review status", () => {
  it("has an entry for every Hindi and Tamil key, and every one still needs a native review", () => {
    for (const lang of ["hi", "ta"] as const) {
      expect(Object.keys(status[lang]).sort()).toEqual(Object.keys(D[lang]).sort());
      const reviewed = Object.entries(status[lang]).filter(([, v]) => !v.needsNativeReview);
      // nothing may be marked reviewed without a named reviewer and a date
      for (const [k, v] of reviewed) expect(v.reviewedBy && v.reviewedOn, `${lang} ${k} marked reviewed without a reviewer`).toBeTruthy();
    }
  });

  it("is up to date with the dictionaries (run `npm run docs:translation`)", () => {
    const fresh = updateReviewStatus({ hi, ta } as never, status);
    expect(fresh).toEqual(status);
    const doc = readFileSync(path.join(root, "docs/translation-review.md"), "utf8").replace(/\r\n/g, "\n");
    expect(doc).toBe(renderTranslationDoc(status));
  });

  it("never marks a key reviewed by itself, and keeps a real sign-off", () => {
    const signed: ReviewStatus = { ...status, hi: { ...status.hi, "adv.approve": { needsNativeReview: false, reviewedBy: "A. Reviewer", reviewedOn: "2030-01-01" } } };
    const merged = updateReviewStatus({ hi, ta } as never, signed);
    expect(merged.hi["adv.approve"].needsNativeReview).toBe(false);
    expect(merged.hi["nav.home"].needsNativeReview).toBe(true);
    // an entry that claims review without a name is reset
    const bogus: ReviewStatus = { ...status, ta: { ...status.ta, "nav.home": { needsNativeReview: false } } };
    expect(updateReviewStatus({ hi, ta } as never, bogus).ta["nav.home"].needsNativeReview).toBe(true);
  });

  it("the docs say plainly that nothing has been reviewed", () => {
    const doc = readFileSync(path.join(root, "docs/translation-review.md"), "utf8");
    expect(doc).toMatch(/has not been reviewed by a native speaker/i);
  });
});
