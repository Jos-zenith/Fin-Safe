// `npm run docs:translation` writes src/i18n/review-status.json and docs/translation-review.md.
//
// Every Hindi and Tamil string starts as "needsNativeReview: true". Nobody who is a native speaker has reviewed
// them, and nothing here pretends otherwise. When a real reviewer signs a key off, edit that entry by hand
// (needsNativeReview: false, reviewedBy, reviewedOn); regenerating keeps those entries and never sets one back.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderTranslationDoc, type ReviewStatus, updateReviewStatus } from "../src/lib/translation";

const root = path.resolve(__dirname, "..");
const load = (l: string) => JSON.parse(readFileSync(path.join(root, `src/i18n/${l}.json`), "utf8")) as Record<string, string>;
const file = path.join(root, "src/i18n/review-status.json");
const prev: ReviewStatus | undefined = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ReviewStatus) : undefined;

const next = updateReviewStatus({ hi: load("hi"), ta: load("ta") }, prev);
writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
const doc = path.join(root, "docs/translation-review.md");
mkdirSync(path.dirname(doc), { recursive: true });
writeFileSync(doc, renderTranslationDoc(next));
console.log(`wrote ${file} and ${doc}`);
