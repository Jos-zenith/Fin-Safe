// Measures the scam detector against a labelled, synthetic corpus. Pure functions only: the CLI
// (scripts/eval-scam.ts) and the regression test (tests/scam-eval.test.ts) both use this file.
//
// Three kinds of number, kept apart on purpose:
//   TUNED       the dev rows of tests/fixtures/scam-corpus.json: the rules were fixed until these passed;
//   HELD-OUT    the ~20% of that corpus chosen by hash: not looked at while tuning, but the same author, parallel scenarios;
//   ADVERSARIAL tests/fixtures/scam-adversarial-v1.json: written in a separate pass, FROZEN (its SHA-256 is in the report),
//               never tuned on, reported separately. Still synthetic. NONE of them is a real-world detection rate.
//
// Honesty notes that the generated report repeats:
//  * every message was written by the build agent, not collected from real victims and not written by native
//    speakers, so measured recall is optimistic;
//  * the held-out rows are 20% of the corpus, chosen by a hash of the text. They were not used to tune the rules,
//    but the same author wrote them, so they are "not tuned on", not "independent".

import { mockSecondOpinion } from "../ai/mock/secondOpinion";
import { redact } from "../redact";

export type Label = "s" | "b";
export type GroupId = "en" | "hi" | "ta" | "hinglish" | "tanglish";
export const GROUPS: GroupId[] = ["en", "hi", "ta", "hinglish", "tanglish"];
export const GROUP_NAME: Record<GroupId, string> = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
  hinglish: "Hinglish",
  tanglish: "Tanglish",
};

export type CorpusRow = [category: string, label: Label, text: string];
export interface Corpus {
  version: number;
  note: string;
  groups: Record<GroupId, CorpusRow[]>;
}

export interface Item {
  id: string;
  group: GroupId;
  category: string;
  label: Label;
  text: string;
  heldOut: boolean;
}

/** FNV-1a, 32-bit. Stable across machines, so the split never changes unless a row's text changes. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** About one row in five is held out. The rule is a hash, so nobody chooses which rows. */
export const isHeldOut = (group: string, category: string, text: string) => hash32(`${group}|${category}|${text}`) % 5 === 0;

export function items(corpus: Corpus): Item[] {
  const out: Item[] = [];
  for (const g of GROUPS) {
    corpus.groups[g].forEach(([category, label, text], i) => {
      out.push({ id: `${g}-${String(i + 1).padStart(2, "0")}`, group: g, category, label, text, heldOut: isHeldOut(g, category, text) });
    });
  }
  return out;
}

export type Predict = (text: string, group: GroupId) => "low" | "medium" | "high";

export interface Counts {
  scams: number;
  benign: number;
  tp: number;
  fn: number;
  fp: number;
  tn: number;
}
export interface Metrics extends Counts {
  recall: number;
  fpr: number;
  precision: number;
}

const ratio = (a: number, b: number) => (b === 0 ? NaN : a / b);

export function metricsOf(rows: { label: Label; flagged: boolean }[]): Metrics {
  const c: Counts = { scams: 0, benign: 0, tp: 0, fn: 0, fp: 0, tn: 0 };
  for (const r of rows) {
    if (r.label === "s") {
      c.scams++;
      if (r.flagged) c.tp++;
      else c.fn++;
    } else {
      c.benign++;
      if (r.flagged) c.fp++;
      else c.tn++;
    }
  }
  return { ...c, recall: ratio(c.tp, c.scams), fpr: ratio(c.fp, c.benign), precision: ratio(c.tp, c.tp + c.fp) };
}

export interface Scored extends Item {
  overall: "low" | "medium" | "high";
  flagged: boolean;
}

export interface EvalResult {
  scored: Scored[];
  overall: { all: Metrics; dev: Metrics; heldOut: Metrics };
  byGroup: Record<GroupId, { all: Metrics; dev: Metrics; heldOut: Metrics }>;
  byCategory: { category: string; label: Label; n: number; flagged: number; rate: number; heldOutN: number }[];
  highOnlyRecall: number;
}

/** "Flagged" means the check reported warning signs (medium or high). Only "low" counts as not flagged. */
export function evaluate(corpus: Corpus, predict: Predict): EvalResult {
  const scored: Scored[] = items(corpus).map((it) => {
    const overall = predict(it.text, it.group);
    return { ...it, overall, flagged: overall !== "low" };
  });
  const split = (rows: Scored[]) => ({
    all: metricsOf(rows),
    dev: metricsOf(rows.filter((r) => !r.heldOut)),
    heldOut: metricsOf(rows.filter((r) => r.heldOut)),
  });
  const byGroup = Object.fromEntries(GROUPS.map((g) => [g, split(scored.filter((r) => r.group === g))])) as EvalResult["byGroup"];

  const cats = new Map<string, { label: Label; n: number; flagged: number; heldOutN: number }>();
  for (const r of scored) {
    const k = `${r.label}:${r.category}`;
    const c = cats.get(k) ?? { label: r.label, n: 0, flagged: 0, heldOutN: 0 };
    c.n++;
    if (r.flagged) c.flagged++;
    if (r.heldOut) c.heldOutN++;
    cats.set(k, c);
  }
  const byCategory = [...cats.entries()]
    .map(([k, c]) => ({ category: k.slice(2), ...c, rate: c.flagged / c.n }))
    .sort((a, b) => (a.label === b.label ? a.category.localeCompare(b.category) : a.label === "s" ? -1 : 1));

  const scams = scored.filter((r) => r.label === "s");
  return {
    scored,
    overall: split(scored),
    byGroup,
    byCategory,
    highOnlyRecall: scams.filter((r) => r.overall === "high").length / scams.length,
  };
}

/** How rows of one label were rated across the three outcomes (high / needs verification / no known indicators). */
export function outcomeShare(scored: Scored[], label: Label): { n: number; high: number; verify: number; none: number } {
  const rows = scored.filter((r) => r.label === label);
  return { n: rows.length, high: rows.filter((r) => r.overall === "high").length, verify: rows.filter((r) => r.overall === "medium").length, none: rows.filter((r) => r.overall === "low").length };
}

// ---------- report ----------
const pct = (x: number) => (Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(1)}%`);
const mrow = (name: string, m: Metrics) => `| ${name} | ${m.scams} | ${m.benign} | ${pct(m.recall)} | ${pct(m.precision)} | ${pct(m.fpr)} |`;
const HEAD = "| | scams | benign | recall (scams flagged) | precision | false-positive rate (benign flagged) |\n|---|---|---|---|---|---|";

export interface Baseline {
  note: string;
  overall: { recall: number; fpr: number; precision: number; heldOutRecall: number; heldOutFpr: number };
}

/** Failures of DEV rows only. Held-out failures are never listed, so they cannot be tuned against by reading the report. */
export interface AdversarialInput {
  result: EvalResult;
  /** SHA-256 of tests/fixtures/scam-adversarial-v1.json (line endings normalised), so an edit after the fact is visible. */
  sha256: string;
}

export function renderScamEvalDoc(r: EvalResult, baseline?: Baseline, adv?: AdversarialInput): string {
  const devFails = r.scored.filter((x) => !x.heldOut && ((x.label === "s" && !x.flagged) || (x.label === "b" && x.flagged)));
  const o = r.overall;
  return `# Scam-check evaluation

> Generated by \`npm run eval:scam\` from \`tests/fixtures/scam-corpus.json\`. Do not edit by hand.
> \`tests/scam-eval.test.ts\` fails if the numbers fall below the thresholds recorded there.

## Read this first

- **Three different kinds of number appear below. None of them is a real-world detection rate.**
  - **Tuned**: the "dev" rows of \`tests/fixtures/scam-corpus.json\`. The rules were adjusted until these passed, so they say almost nothing about new messages.
  - **Held-out**: about 20% of the same corpus, chosen by a hash and not looked at while tuning. Same author, parallel scenarios in every language group, so still optimistic.
  - **Adversarial (adversarial-v1)**: a second set written in a separate pass from a list of scammer tactics, then **frozen and never tuned on**. It is reported separately at the end. It is still synthetic and still written by the same author, so it measures resistance to this author's evasion ideas, not to real scammers.
- **This is a measurement of a rule-based demo check against small synthetic sets. It is not evidence that the check protects anyone.**
- Every message was written by the build agent. None is a real victim's message, none was written or reviewed by a native Hindi or Tamil speaker, and the corpus was written by the same author who tuned the rules, so **the numbers below are optimistic**.
- Domains, UPI handles, account numbers and bank names are fictional.
- ${r.scored.length} messages: ${GROUPS.map((g) => `${GROUP_NAME[g]} ${r.scored.filter((x) => x.group === g).length}`).join(", ")}.
- "Flagged" means the check reported warning signs (overall level medium or high). "Scam" rows are messages that carry the labelled scam pattern. "Benign" rows are ordinary or educational messages, including regulator warnings that quote scam words.
- **Held-out set:** about 20% of rows (${o.heldOut.scams + o.heldOut.benign}) were chosen by a hash of their text and were **not looked at while the rules were tuned**. Their failures are never printed here. They were still written by the same author, so they are "not tuned on", not "independent". **Worse, the language groups are parallel:** the same scenarios were written once per group, so a held-out row often has a dev-set twin in another group that the rules were tuned on. The held-out figure is therefore inflated, and a fresh sample from real people would very likely score lower.
- **Three outcomes**, with no green tick and no "safe" verdict: **High risk: strong indicators**; **Needs verification: not enough evidence either way**; **No known indicators found**. The third reads "No known warning signs were found in this check. That does not mean the message is safe." A message with only weak signals (an unknown sender claiming to be your adviser, a private-group invitation, a new payee) lands in the middle outcome, never the third.

## Overall

${HEAD}
${mrow("All rows", o.all)}
${mrow("Dev rows (used while tuning)", o.dev)}
${mrow("**Held-out rows (not tuned on)**", o.heldOut)}

Share of scams rated **high** (not just flagged): ${pct(r.highOnlyRecall)}.

### How rows were rated across the three outcomes

| | rows | High risk | Needs verification | No known indicators |
|---|---|---|---|---|
${(["s", "b"] as const)
  .map((l) => {
    const o3 = outcomeShare(r.scored, l);
    return `| ${l === "s" ? "Scam rows" : "Benign rows"} | ${o3.n} | ${pct(o3.high / o3.n)} | ${pct(o3.verify / o3.n)} | ${pct(o3.none / o3.n)} |`;
  })
  .join("\n")}

A scam row rated "No known indicators" is a **miss**. A benign row rated "Needs verification" or "High risk" is a **false alarm**.
${
  baseline
    ? `
### Before and after tuning

${baseline.note}

| | recall | false-positive rate | precision | held-out recall | held-out FPR |
|---|---|---|---|---|---|
| Baseline (rules as they stood before this pass) | ${pct(baseline.overall.recall)} | ${pct(baseline.overall.fpr)} | ${pct(baseline.overall.precision)} | ${pct(baseline.overall.heldOutRecall)} | ${pct(baseline.overall.heldOutFpr)} |
| Now | ${pct(o.all.recall)} | ${pct(o.all.fpr)} | ${pct(o.all.precision)} | ${pct(o.heldOut.recall)} | ${pct(o.heldOut.fpr)} |
`
    : ""
}
## By language group

${HEAD}
${GROUPS.map((g) => mrow(GROUP_NAME[g], r.byGroup[g].all)).join("\n")}

Held-out rows only:

${HEAD}
${GROUPS.map((g) => mrow(GROUP_NAME[g], r.byGroup[g].heldOut)).join("\n")}

## By category

For scam categories the rate is **recall** (share flagged). For benign categories the rate is the **false-positive rate** (share wrongly flagged). Precision is not defined for one category on its own, so it is reported per language and overall only.

| category | kind | messages | flagged | rate |
|---|---|---|---|---|
${r.byCategory.map((c) => `| ${c.category} | ${c.label === "s" ? "scam" : "benign"} | ${c.n} | ${c.flagged} | ${pct(c.rate)} |`).join("\n")}

## Dev-set misses and false alarms (${devFails.length})

These are the only failures listed. They are the rows that were used to find what to fix.

${devFails.length === 0 ? "None." : devFails.map((x) => `- \`${x.id}\` (${x.category}, ${x.label === "s" ? "missed scam" : "false alarm"}): ${x.text.slice(0, 90).replace(/\n/g, " ")}`).join("\n")}

${adv ? renderAdversarial(adv) : ""}
## What this does not tell you

- Whether the check works on real messages. Real scams are written by people trying to avoid detection, and they change.
- Whether the Hindi and Tamil wording is natural. A native speaker must write and review a larger sample.
- Anything about the optional model second pass. It was not run here; with no key, the check is the rule engine only.
- A scam this check rates "No known indicators found" is still a possible scam. That outcome means only that no known warning sign matched.

## Not covered, and documented as next steps

- **OCR of screenshots**: a message that arrives as an image is not read.
- **Voice-call reporting**: a scam by phone call cannot be pasted in or reported here.
- **Live reputation lookups**: no link, number or handle is looked up anywhere; the link check is offline and from the address text only.
`;
}

function renderAdversarial(a: AdversarialInput): string {
  const m = a.result.overall.all;
  const sc = outcomeShare(a.result.scored, "s");
  const bn = outcomeShare(a.result.scored, "b");
  return `
## Adversarial set (adversarial-v1): reported separately, never tuned on

- ${a.result.scored.length} messages (${GROUPS.map((g) => `${GROUP_NAME[g]} ${a.result.scored.filter((x) => x.group === g).length}`).join(", ")}), file \`tests/fixtures/scam-adversarial-v1.json\`, **SHA-256 \`${a.sha256}\`**. \`tests/scam-eval.test.ts\` fails if the file no longer matches this hash, so editing the set after seeing a result is visible in the diff.
- Written in one separate pass from a list of scammer tactics (impersonating an adviser, a private group, a new payee, certainty without the word "guarantee", asking for a "code" instead of an OTP), **not** from the detector's patterns, and then left alone. **It is not independent**: the same author wrote the rules, and no native speaker wrote or reviewed it.
- **No pass/fail threshold is applied to it**, on purpose: a threshold would invite tuning. Its failures are not listed row by row. Read the category rates below to see where the rules are weak.
- Still **synthetic**. **None of these numbers is a real-world detection rate.**

${HEAD}
${mrow("Adversarial-v1, all rows", m)}
${GROUPS.map((g) => mrow(`${GROUP_NAME[g]}`, a.result.byGroup[g].all)).join("\n")}

| | rows | High risk | Needs verification | No known indicators |
|---|---|---|---|---|
| Scam rows | ${sc.n} | ${pct(sc.high / sc.n)} | ${pct(sc.verify / sc.n)} | ${pct(sc.none / sc.n)} |
| Benign rows | ${bn.n} | ${pct(bn.high / bn.n)} | ${pct(bn.verify / bn.n)} | ${pct(bn.none / bn.n)} |

| category | kind | messages | flagged | rate |
|---|---|---|---|---|
${a.result.byCategory.map((c) => `| ${c.category} | ${c.label === "s" ? "scam" : "benign"} | ${c.n} | ${c.flagged} | ${pct(c.rate)} |`).join("\n")}
`;
}

/** What the Check page really does: redact the message, run the rules, read the overall level. */
export const realPipeline: Predict = (text) => mockSecondOpinion(redact(text), "en").overall;
