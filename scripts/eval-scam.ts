// `npm run eval:scam`            -> evaluates the current check and writes docs/scam-eval.md
// `npm run eval:scam -- --dev`   -> also prints DEV-set misses (the rows you may tune against)
// `npm run eval:scam -- --baseline` -> records the current numbers as tests/fixtures/scam-baseline.json
// Held-out failures are never printed. (`--reveal-heldout` exists for an audit, and it ends the held-out set's
// value for tuning, so do not use it while changing rules.)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { evaluate, realPipeline, renderScamEvalDoc, type Baseline, type Corpus } from "../src/lib/scam/eval";

const root = path.resolve(__dirname, "..");
const corpus = JSON.parse(readFileSync(path.join(root, "tests/fixtures/scam-corpus.json"), "utf8")) as Corpus;
const args = new Set(process.argv.slice(2));

// The page redacts the message before the check sees it, so the evaluation does the same.
const result = evaluate(corpus, realPipeline);

const baselinePath = path.join(root, "tests/fixtures/scam-baseline.json");
if (args.has("--baseline")) {
  const o = result.overall;
  const b: Baseline = {
    note: "Recorded by `npm run eval:scam -- --baseline` on the rules as they stood before the vernacular and URL work, before any tuning against this corpus.",
    overall: { recall: o.all.recall, fpr: o.all.fpr, precision: o.all.precision, heldOutRecall: o.heldOut.recall, heldOutFpr: o.heldOut.fpr },
  };
  writeFileSync(baselinePath, JSON.stringify(b, null, 2) + "\n");
  console.log(`baseline written: recall ${(b.overall.recall * 100).toFixed(1)}%, FPR ${(b.overall.fpr * 100).toFixed(1)}%`);
}
const baseline = existsSync(baselinePath) ? (JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline) : undefined;

// The adversarial set is evaluated and reported separately. It is never printed row by row and never tuned on.
const advText = readFileSync(path.join(root, "tests/fixtures/scam-adversarial-v1.json"), "utf8").replace(/\r\n/g, "\n");
const adversarial = { result: evaluate(JSON.parse(advText) as Corpus, realPipeline), sha256: createHash("sha256").update(advText).digest("hex") };

const out = path.join(root, "docs/scam-eval.md");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, renderScamEvalDoc(result, baseline, adversarial));

const f = (x: number) => (Number.isNaN(x) ? "n/a" : (x * 100).toFixed(1) + "%");
const line = (name: string, m: { recall: number; fpr: number; precision: number; scams: number; benign: number }) =>
  `${name.padEnd(16)} scams ${String(m.scams).padStart(3)}  benign ${String(m.benign).padStart(3)}  recall ${f(m.recall).padStart(6)}  FPR ${f(m.fpr).padStart(6)}  precision ${f(m.precision).padStart(6)}`;
console.log(line("all", result.overall.all));
console.log(line("dev", result.overall.dev));
console.log(line("held-out", result.overall.heldOut));
for (const [g, m] of Object.entries(result.byGroup)) console.log(line(g, m.all));
console.log(line("adversarial-v1", adversarial.result.overall.all) + "   (reported separately, never tuned on)");
console.log(`wrote ${out}`);

if (args.has("--dev")) {
  console.log("\nDEV-set failures:");
  for (const x of result.scored.filter((r) => !r.heldOut && ((r.label === "s" && !r.flagged) || (r.label === "b" && r.flagged)))) {
    console.log(`  ${x.id} [${x.category}] ${x.label === "s" ? "MISSED" : "FALSE ALARM"} (${x.overall}): ${x.text.slice(0, 110)}`);
  }
}
if (args.has("--reveal-heldout")) {
  console.log("\nHELD-OUT failures (audit only):");
  for (const x of result.scored.filter((r) => r.heldOut && ((r.label === "s" && !r.flagged) || (r.label === "b" && r.flagged)))) {
    console.log(`  ${x.id} [${x.category}] ${x.label === "s" ? "MISSED" : "FALSE ALARM"}: ${x.text.slice(0, 110)}`);
  }
}
