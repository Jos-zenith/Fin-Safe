// The scam check measures itself. These thresholds are the regression gate: if a change to the rules drops
// recall or raises false alarms below them, this test fails. The corpus is synthetic and was written by the
// build agent, so passing it is NOT evidence that the check protects real people (see docs/scam-eval.md).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mockSecondOpinion } from "@/lib/ai/mock/secondOpinion";
import { proseOf } from "@/lib/ai/secondOpinionMerge";
import { redact } from "@/lib/redact";
import { evaluate, GROUPS, isHeldOut, items, outcomeShare, realPipeline, renderScamEvalDoc, type Baseline, type Corpus } from "@/lib/scam/eval";
import { claimsSafe, LOW_RISK_SUMMARY } from "@/lib/scam/wording";
import { en, hi, ta } from "./helpers";

const root = path.resolve(__dirname, "..");
const corpus = JSON.parse(readFileSync(path.join(root, "tests/fixtures/scam-corpus.json"), "utf8")) as Corpus;
const baseline = JSON.parse(readFileSync(path.join(root, "tests/fixtures/scam-baseline.json"), "utf8")) as Baseline;
const all = items(corpus);
const result = evaluate(corpus, realPipeline);
// the frozen adversarial set: evaluated and reported separately, never tuned on, and tied to the report by a hash
const advText = readFileSync(path.join(root, "tests/fixtures/scam-adversarial-v1.json"), "utf8").replace(/\r\n/g, "\n");
const advCorpus = JSON.parse(advText) as Corpus & { set?: string };
const advSha = createHash("sha256").update(advText).digest("hex");
const adversarial = { result: evaluate(advCorpus, realPipeline), sha256: advSha };

// Starting thresholds from the brief. Raise them as the corpus grows; never lower them to make a test pass
// without recording the real numbers in docs/scam-eval.md.
const MIN_RECALL = 0.85;
const MAX_FPR = 0.1;

describe("scam corpus shape", () => {
  it("has at least 60 labelled messages in each of the five language groups", () => {
    for (const g of GROUPS) expect(all.filter((x) => x.group === g).length, g).toBeGreaterThanOrEqual(60);
  });

  it("covers every scam category and the hard benign categories in every group", () => {
    const scam = ["guaranteed_returns", "urgency", "pump_group", "insider", "credential", "remote_access", "payee_upi", "link", "pre_ipo", "novel_wording", "fake_regulator", "impersonation", "private_group", "new_payee", "implied_certainty"];
    const benign = ["bank_alert", "sip_explainer", "regulator_warning", "family_chat", "risk_boilerplate", "neutral_new_account", "neutral_group_invite"];
    for (const g of GROUPS) {
      const cats = new Set(all.filter((x) => x.group === g).map((x) => `${x.label}:${x.category}`));
      for (const c of scam) expect(cats.has(`s:${c}`), `${g} scam ${c}`).toBe(true);
      for (const c of benign) expect(cats.has(`b:${c}`), `${g} benign ${c}`).toBe(true);
    }
  });

  it("holds out about 20% by a hash of the text, with held-out scams and benign rows in every group", () => {
    const held = all.filter((x) => x.heldOut);
    expect(held.length / all.length).toBeGreaterThan(0.15);
    expect(held.length / all.length).toBeLessThan(0.25);
    for (const g of GROUPS) {
      expect(held.filter((x) => x.group === g && x.label === "s").length, `${g} held-out scams`).toBeGreaterThanOrEqual(4);
      expect(held.filter((x) => x.group === g && x.label === "b").length, `${g} held-out benign`).toBeGreaterThanOrEqual(2);
    }
    // the split must not depend on anything but the row itself
    for (const x of all) expect(isHeldOut(x.group, x.category, x.text)).toBe(x.heldOut);
  });

  it("uses only fictional domains and handles", () => {
    const text = all.map((x) => x.text).join("\n");
    expect(text).not.toMatch(/hdfcbank\.com|icicibank\.com|sbi\.co\.in|sebi\.gov\.in|npci\.org\.in|@oksbi|@okaxis|@okicici|@okhdfcbank|@ybl|@paytm/i);
  });

  it("includes the Tamil 'guaranteed 10% a month, buy this stock, pay today' tip, and it is rated HIGH", () => {
    const row = all.find((x) => x.group === "ta" && x.text.includes("இந்த பங்கை வாங்குங்கள், மாதம் 10% உத்தரவாத லாபம்"));
    expect(row).toBeDefined();
    expect(realPipeline(row!.text, "ta")).toBe("high");
  });
});

describe("scam check: measured against the corpus (regression gate)", () => {
  it("overall recall and false-positive rate stay within the thresholds", () => {
    expect(result.overall.all.recall).toBeGreaterThanOrEqual(MIN_RECALL);
    expect(result.overall.all.fpr).toBeLessThanOrEqual(MAX_FPR);
  });
  it("held-out rows (not tuned on) stay within the thresholds", () => {
    expect(result.overall.heldOut.recall).toBeGreaterThanOrEqual(MIN_RECALL);
    expect(result.overall.heldOut.fpr).toBeLessThanOrEqual(MAX_FPR);
  });
  for (const g of GROUPS) {
    it(`${g}: recall and false-positive rate stay within the thresholds`, () => {
      expect(result.byGroup[g].all.recall, `${g} recall`).toBeGreaterThanOrEqual(MIN_RECALL);
      expect(result.byGroup[g].all.fpr, `${g} FPR`).toBeLessThanOrEqual(MAX_FPR);
    });
  }
  it("beats the baseline recorded before this work, so the report cannot silently regress", () => {
    expect(result.overall.all.recall).toBeGreaterThan(baseline.overall.recall);
  });
});

describe("the check never calls a message safe", () => {
  const msgs = all.map((x) => x.text);
  const labels = (d: Record<string, string>) => [d["check.risk.low"], d["check.risk.medium"], d["check.risk.high"], d["check.found.none"], d["check.found.one"], d["check.found.n"]];

  it("no output for any corpus message, in any language, carries a safe/genuine verdict", () => {
    for (const lang of ["en", "hi", "ta"] as const) {
      for (const m of msgs) {
        const out = mockSecondOpinion(redact(m), lang);
        expect(claimsSafe(proseOf(out)), `${lang}: ${m.slice(0, 60)}`).toBe(false);
      }
    }
  });

  it("the low-risk summary is exactly the agreed wording, and it negates 'safe'", () => {
    expect(LOW_RISK_SUMMARY.en).toBe("No known warning signs were found in this check. That does not mean the message is safe.");
    const low = mockSecondOpinion("What a lovely evening, see you tomorrow", "en");
    expect(low.overall).toBe("low");
    expect(low.summary).toBe(LOW_RISK_SUMMARY.en);
    for (const lang of ["hi", "ta"] as const) expect(mockSecondOpinion("What a lovely evening", lang).summary).toBe(LOW_RISK_SUMMARY[lang]);
  });

  it("no on-screen label for a result is a safe verdict, in any language", () => {
    for (const d of [en, hi, ta] as Record<string, string>[]) for (const l of labels(d)) expect(claimsSafe(l), l).toBe(false);
  });

  it("claimsSafe catches verdicts in every language and allows the negated disclaimer", () => {
    expect(claimsSafe("This message looks safe")).toBe(true);
    expect(claimsSafe("It seems legitimate and trustworthy")).toBe(true);
    expect(claimsSafe("यह संदेश सुरक्षित है")).toBe(true);
    expect(claimsSafe("இந்தச் செய்தி பாதுகாப்பானது")).toBe(true);
    expect(claimsSafe("Some warning signs were found. Check before acting.")).toBe(false);
    for (const d of Object.values(LOW_RISK_SUMMARY)) expect(claimsSafe(d)).toBe(false);
  });
});

describe("docs/scam-eval.md is generated from the corpus", () => {
  it("matches what `npm run eval:scam` would write", () => {
    const committed = readFileSync(path.join(root, "docs/scam-eval.md"), "utf8").replace(/\r\n/g, "\n");
    expect(committed).toBe(renderScamEvalDoc(result, baseline, adversarial));
  });
  it("states plainly that the corpus is synthetic and the numbers optimistic", () => {
    const doc = renderScamEvalDoc(result, baseline, adversarial);
    expect(doc).toMatch(/synthetic|written by the build agent/i);
    expect(doc).toMatch(/optimistic/i);
    expect(doc).toMatch(/not evidence/i);
    expect(doc).not.toMatch(/MISSED \(held|held-out failure/i);
  });
});

describe("adversarial-v1: a second, frozen set, reported separately and never tuned on", () => {
  const rows = items(advCorpus);

  it("is marked adversarial-v1, covers all five language groups, and has scams and benign look-alikes in each", () => {
    expect(advCorpus.set).toBe("adversarial-v1");
    for (const g of GROUPS) {
      expect(rows.filter((x) => x.group === g && x.label === "s").length, `${g} scams`).toBeGreaterThanOrEqual(8);
      expect(rows.filter((x) => x.group === g && x.label === "b").length, `${g} benign`).toBeGreaterThanOrEqual(3);
    }
  });

  it("shares no message with the tuned corpus, so nothing was copied across", () => {
    const tuned = new Set(all.map((x) => x.text));
    expect(rows.filter((x) => tuned.has(x.text))).toEqual([]);
  });

  it("is tied to the report by its SHA-256, so editing it after a result is visible", () => {
    const doc = readFileSync(path.join(root, "docs/scam-eval.md"), "utf8");
    expect(doc).toContain(advSha);
    expect(doc).toMatch(/never tuned on/i);
    expect(doc).toMatch(/not independent/i);
  });

  it("is reported with its own numbers and NO pass/fail threshold, and says it is still synthetic", () => {
    const doc = renderScamEvalDoc(result, baseline, adversarial);
    expect(doc).toMatch(/Adversarial set \(adversarial-v1\)/);
    expect(doc).toMatch(/No pass\/fail threshold is applied to it/);
    expect(doc).toMatch(/None of these numbers is a real-world detection rate/);
    const sc = outcomeShare(adversarial.result.scored, "s");
    expect(sc.high + sc.verify + sc.none).toBe(sc.n);
    expect(doc).toMatch(/High risk \| Needs verification \| No known indicators/);
  });

  it("does not leak into the rules: no adversarial message appears in the source", () => {
    const src = readFileSync(path.join(root, "src/lib/scam/detect.ts"), "utf8") + readFileSync(path.join(root, "src/lib/scam/urls.ts"), "utf8");
    for (const x of rows.filter((r) => r.group === "en")) expect(src).not.toContain(x.text.slice(0, 40));
  });

  it("does not change the tuned numbers: those come from the corpus alone", () => {
    expect(result.scored.length).toBe(all.length);
    expect(result.scored.every((x) => !x.id.startsWith("adv"))).toBe(true);
  });
});
