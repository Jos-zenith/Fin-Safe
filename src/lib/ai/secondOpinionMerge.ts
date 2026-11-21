// The optional model pass for Second Opinion may ADD warning signs or RAISE a severity. It can never remove or
// lower a sign that the rule engine found, and it can never turn a result into a "safe" verdict.
import type { Lang } from "@/types";
import { overallOf } from "@/lib/scam/detect";
import { claimsSafe } from "@/lib/scam/wording";
import { summaryFor } from "./mock/secondOpinion";
import type { SecondOpinionResult } from "./schemas";

const RANK = { low: 0, medium: 1, high: 2 } as const;
type Level = keyof typeof RANK;
const maxLevel = (a: Level, b: Level): Level => (RANK[a] >= RANK[b] ? a : b);

/** All prose a model wrote (not the quotes, which are the user's own words). */
export function proseOf(r: SecondOpinionResult): string {
  return [r.summary, r.educationalNote, ...r.questions, ...r.flags.map((f) => f.explanation)].join("\n");
}

export function mergeSecondOpinion(model: SecondOpinionResult, rules: SecondOpinionResult, lang: Lang): SecondOpinionResult {
  const byType = new Map(rules.flags.map((f) => [f.type, f]));
  for (const f of model.flags) {
    if (byType.size >= 10 && !byType.has(f.type)) continue;
    const r = byType.get(f.type);
    if (!r) byType.set(f.type, f);
    else if (RANK[f.severity] > RANK[r.severity]) byType.set(f.type, { ...r, severity: f.severity });
  }
  const flags = [...byType.values()];
  const overall = maxLevel(rules.overall, overallOf(flags));
  const questions = [...new Set([...rules.questions, ...model.questions])].slice(0, 8);
  const summary = overall === rules.overall ? rules.summary : summaryFor(lang, overall);
  const out: SecondOpinionResult = { overall, summary, flags, questions, educationalNote: rules.educationalNote };
  // belt and braces: a merged result must never carry a "safe" verdict
  if (claimsSafe(proseOf(out))) return rules;
  return out;
}
