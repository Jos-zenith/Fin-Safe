// Mock provider: deterministic fixtures built from the catalogue. They use {{placeholders}}
// and go through the SAME validation pipeline as real model output.
import { classifyRequest, PREDICTION_SENTENCE, REFUSAL_SENTENCE } from "../guardrails";
import type { AnswerResult, CopilotResult, Findings, NudgeResult, PlanItem, PlanPack, PlanTopic, AssetClass } from "../schemas";
import type { EngineResult, Goal, Lang, Nudge, UserProfile } from "@/types";
import { ANSWER_TEXT, type AnswerKey } from "./answers";
import { COPILOT_TEXT, FINDING_TEXT, KIND_NAME, NUDGE_TEXT, PLAN_STATIC, TOPIC_TEXT } from "./content";

const sub = (s: string, goalId?: string) => (goalId ? s.replaceAll("@", goalId) : s);

export function goalTopic(years: number): { topic: PlanTopic; assetClass: AssetClass } {
  if (years <= 3) return { topic: "goal_short", assetClass: "debt" };
  if (years <= 6) return { topic: "goal_mid", assetClass: "other_planning" };
  return { topic: "goal_long", assetClass: "equity" };
}

/** Render one plan item's text for a topic in a language (used for mock mode AND language switching). */
export function topicTexts(topic: PlanTopic, lang: Lang, goal?: Goal) {
  const t = TOPIC_TEXT[topic][lang];
  const kind = goal ? KIND_NAME[lang][goal.kind] : "";
  const f = (s: string) => sub(s, goal?.id).replace("{kind}", kind);
  return { title: f(t.title), rationale: f(t.rationale), risks: f(t.risks), rangeNote: t.rangeNote ? f(t.rangeNote) : undefined };
}

export function mockPlanPack(profile: UserProfile, engine: EngineResult, lang: Lang): PlanPack {
  const has = (id: string) => engine.flags.some((f) => f.id === id);
  const ladder = engine.ladder;
  const step = (id: string) => ladder.steps.find((s) => s.id === id);
  const items: PlanItem[] = [];
  const add = (topic: PlanTopic, assetClass: AssetClass, evidenceRefs: string[], goal?: Goal) => {
    items.push({
      id: goal ? `p-${topic}-${goal.id}` : `p-${topic}`,
      topic,
      assetClass,
      ...(goal ? { goalRef: goal.id } : {}),
      ...topicTexts(topic, lang, goal),
      evidenceRefs,
    });
  };

  // 0. a key answer is missing: say so, show no figure, and hold every goal back
  if (ladder.steps.some((x) => x.reason.startsWith("no_"))) {
    add("inputs_missing", "other_planning", []);
    for (const g of profile.goals) add("goals_later", "other_planning", [`profile.goal.${g.id}.targetAmount`, `profile.goal.${g.id}.years`], g);
    const s0 = PLAN_STATIC[lang];
    return { lang, summary: s0.summaryBlocked, priorities: items.map((i) => i.id), items, checklist: s0.checklist, adviserQuestions: s0.adviserQuestions };
  }
  // 1. cash flow: a month that does not add up comes before everything else
  const cash = step("cash_flow");
  if (cash?.status === "blocked") {
    if (cash.reason === "shortfall") add("cash_flow", "other_planning", ["cash.shortfall", "cash.income", "cash.emi", "cash.surplus"]);
    else add("cash_tight", "other_planning", ["cash.surplus", "cash.surplusPct", "cash.income"]);
  }
  // 2. liquidity, 3. loans, 4. protection (the same order the ladder checks them in)
  if (has("ef_low")) add("emergency_reserve", "liquid_reserve", ["ef.months", "ef.target", "ef.gap", "profile.liquidSavings"]);
  if (has("high_cost_debt")) add("high_cost_debt", "debt_repayment", ["debt.highCost.rate", "debt.dti"]);
  else if (step("debt")?.reason === "heavy") add("loan_load", "debt_repayment", ["debt.dti", "debt.dtiMark"]);
  if (has("health_gap")) add("health_cover", "insurance_cover", ["ins.health.cover", "ins.health.needed", "ins.health.gap"]);
  if (has("term_gap")) add("term_cover", "insurance_cover", ["ins.term.cover", "ins.term.needed", "ins.term.gap", "ins.term.byIncome", "ins.term.byNeeds"]);
  if (has("tip_following")) add("speculation_guard", "other_planning", ["profile.holdings"]);
  // 5. goals: a monthly amount only when nothing before is blocked; otherwise a "later" item with NO amount
  if (!ladder.goalsLater) {
    for (const g of profile.goals) {
      const { topic, assetClass } = goalTopic(g.years);
      add(topic, assetClass, [`goal.${g.id}.sip`, `profile.goal.${g.id}.targetAmount`, `profile.goal.${g.id}.years`], g);
    }
  }
  if (has("concentration") || has("overlap_high")) add("diversify", "equity", ["conc.topSector", "conc.overlap"]);
  if (profile.holdings.length > 1 && !profile.holdings.some((h) => h.assetClass === "gold") && (has("concentration") || has("overlap_high"))) {
    add("gold_balance", "gold", ["alloc.gold.low", "alloc.gold.high"]);
  }
  if (ladder.goalsLater) {
    for (const g of profile.goals) add("goals_later", "other_planning", [`profile.goal.${g.id}.targetAmount`, `profile.goal.${g.id}.years`], g);
  }
  if (items.length === 0) add("emergency_reserve", "liquid_reserve", ["ef.months", "ef.target", "ef.gap"]);

  const s = PLAN_STATIC[lang];
  return { lang, summary: ladder.goalsLater ? s.summaryBlocked : s.summary, priorities: items.map((i) => i.id), items, checklist: s.checklist, adviserQuestions: s.adviserQuestions };
}

export function mockFindings(profile: UserProfile, engine: EngineResult, lang: Lang): Findings {
  const T = FINDING_TEXT[lang];
  const f = engine.flat;
  const out: Findings["findings"] = {};
  // a key answer is missing: no figure is worth showing
  if (engine.ladder.steps.some((x) => x.reason.startsWith("no_"))) return { findings: { cash: T.cannot } };
  out.score = T.score;
  const cash = engine.ladder.steps.find((x) => x.id === "cash_flow");
  if (profile.monthlyIncome > 0 && cash) out.cash = cash.reason === "shortfall" ? T.cash_short : cash.reason === "near_zero" ? T.cash_tight : T.cash_ok;
  out.ef = f["ef.months"] >= f["ef.target"] ? T.ef_ok : T.ef_low;
  out.term = f["ins.term.needed"] === 0 ? T.term_none : f["ins.term.gap"] > 0 ? T.term_gap : T.term_ok;
  out.health = f["ins.health.gap"] > 0 ? T.health_gap : T.health_ok;
  out.debt = profile.debts.length === 0 ? T.debt_none : f["debt.highCost.count"] > 0 ? T.debt_high : T.debt_ok;
  // "you save X a month" would be false for a month that does not add up; the cash-flow line says it instead
  if (profile.monthlyIncome > 0 && cash?.status !== "blocked") out.savings = T.savings;
  if (profile.goals[0]) out.goals = engine.ladder.goalsLater ? T.goals_later : sub(T.goals, profile.goals[0].id);
  if (profile.holdings.length) out.portfolio = f["conc.overlap"] > 0 ? T.portfolio : T.portfolio_sector;
  return { findings: out };
}

export function mockNudge(n: Pick<Nudge, "ruleId" | "goalId">, lang: Lang, engine?: EngineResult): NudgeResult {
  // a goal amount is never the nudge while a step on the ladder is blocked
  const key = n.ruleId === "sip_review" && engine?.ladder.goalsLater ? "sip_review_later" : n.ruleId;
  return { text: sub(NUDGE_TEXT[lang][key], n.goalId) };
}

export function mockCopilot(lang: Lang, engine?: EngineResult): CopilotResult {
  const { rationaleBlocked, rationaleSummary, ...rest } = COPILOT_TEXT[lang];
  // while a step is blocked the summary cites no goal or savings-rate figure
  return { ...rest, rationaleSummary: engine?.ladder.goalsLater ? rationaleBlocked : rationaleSummary };
}

/**
 * Which topic is the question about? Keyword routing across English, romanised Hindi, Hindi and Tamil.
 * Education topics come first (unless the question is about "my" numbers), then the user's own figures.
 */
export function intentOf(question: string): AnswerKey {
  const q = question.toLowerCase();
  const personal = /\b(my|mine)\b|मेरा|मेरी|मेरे|என்\s|எனது/.test(q);
  if (!personal) {
    if (/\bsip\b/.test(q)) return "sip";
    if (/mutual\s*fund|म्यूचुअल|மியூச்சுவல்/.test(q) && !/\bmy\b/.test(q)) return "mutual_fund";
    if (/term\s*(?:insurance|plan|cover)|टर्म|டெர்ம்/.test(q)) return "term";
    if (/\bdirect\b|\bregular\b|डायरेक्ट|रेगुलर|டைரக்ட்|ரெகுலர்/.test(q)) return "direct_regular";
    if (/inflation|महंगाई|பணவீக்கம்/.test(q)) return "inflation";
    if (/diversif|विविधता|பன்முக/.test(q)) return "diversify";
  }
  if (/score|rating|स्कोर|सेहत|ஸ்கோர்|ஆரோக்கிய/.test(q)) return "score_intro";
  if (/emergency|rainy day|reserve|आपातकाल|அவசர/.test(q)) return "ef";
  if (/prepay|pre-pay|pay\s*off|payoff|foreclos|repay|चुकाना|चुकाऊं|चुका\s*दूं|முன்கூட்டி|திருப்பிச்|திருப்பி/.test(q)) return "prepay_ok";
  // "equity or debt" is about asset classes, not about the user's loans
  if (/equity|इक्विटी|\bbonds?\b|debt\s+(?:fund|vs|or)\b/.test(q)) return "equity_debt";
  if (/\bloan|\bdebt|\bemi\b|कर्ज|लोन|கடன்/.test(q)) return "debt";
  if (/insur|\bcover|policy|बीमा|காப்பீடு/.test(q)) return /term|टर्म|டெர்ம்/.test(q) ? "term" : "insurance";
  if (/\bgold\b|सोना|सोने|தங்கம்/.test(q)) return "gold";
  if (/\b(?:house|home|flat|apartment|property|plot)\b|घर|मकान|வீடு/.test(q)) return "house";
  if (/equity|bonds?\b|risk|volatil|इक्विटी|जोखिम|ஆபத்து|பங்குச்?\s*சந்தை/.test(q)) return "equity_debt";
  if (/saving|savings|\bsave\b|बचत|சேமிப்/.test(q)) return "savings";
  if (/goal|lakh|retire|education|wedding|लक्ष्य|இலக்கு/.test(q)) return "goal";
  return "fallback";
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The finding text for whichever area of the score has the most room (chosen by code, not by the model). */
function weakestFinding(profile: UserProfile, engine: EngineResult, lang: Lang): string | null {
  const f = engine.flat;
  const F = FINDING_TEXT[lang];
  const parts = [
    { r: f["ef.target"] ? f["ef.months"] / f["ef.target"] : 1, t: f["ef.months"] >= f["ef.target"] ? F.ef_ok : F.ef_low },
    { r: f["ins.term.needed"] ? f["ins.term.cover"] / f["ins.term.needed"] : 1, t: f["ins.term.needed"] === 0 ? F.term_none : f["ins.term.gap"] > 0 ? F.term_gap : F.term_ok },
    { r: f["ins.health.needed"] ? f["ins.health.cover"] / f["ins.health.needed"] : 1, t: f["ins.health.gap"] > 0 ? F.health_gap : F.health_ok },
    {
      r: profile.debts.length === 0 ? 1 : f["debt.highCost.count"] > 0 ? 0.3 : clamp01(1 - f["debt.dti"] / 50),
      t: profile.debts.length === 0 ? F.debt_none : f["debt.highCost.count"] > 0 ? F.debt_high : F.debt_ok,
    },
    { r: profile.monthlyIncome > 0 ? f["save.rate"] / 20 : 1, t: F.savings },
    { r: profile.holdings.length ? clamp01(1 - Math.max(0, f["conc.topSector"] - 20) / 40) : 1, t: f["conc.overlap"] > 0 ? F.portfolio : F.portfolio_sector },
  ];
  const w = parts.reduce((a, b) => (b.r < a.r ? b : a));
  return w.r >= 0.999 ? null : w.t;
}

/**
 * Mock-mode "Ask a question". It routes by topic and answers from the user's engine numbers or plain
 * education. Specific securities and market predictions are refused. It is honest about being a template:
 * the UI labels the source, and a real provider answers through the same validators.
 */
export function mockAnswer(question: string, lang: Lang, profile?: UserProfile, engine?: EngineResult): AnswerResult {
  const kind = classifyRequest(question);
  if (kind) return { answer: kind === "prediction" ? PREDICTION_SENTENCE[lang] : REFUSAL_SENTENCE[lang], refused: true, kind };
  const T = ANSWER_TEXT[lang];
  const intent = intentOf(question);
  const ok = (answer: string): AnswerResult => ({ answer, refused: false });

  if (intent === "score_intro" && profile && engine) {
    const w = weakestFinding(profile, engine, lang);
    // the single number is never given without the checks behind it
    const F = FINDING_TEXT[lang];
    return ok(w ? `${T.score_intro}${w}` : `${F.score} ${engine.flat["ef.months"] >= engine.flat["ef.target"] ? F.ef_ok : F.ef_low}`);
  }
  if (intent === "prepay_ok" && profile && engine) {
    if (profile.debts.length === 0) return ok(FINDING_TEXT[lang].debt_none);
    return ok(engine.flat["debt.highCost.count"] > 0 ? T.prepay_high : T.prepay_ok);
  }
  if (intent === "diversify" && profile?.holdings.length && engine) {
    return ok(`${T.diversify} ${engine.flat["conc.overlap"] > 0 ? FINDING_TEXT[lang].portfolio : FINDING_TEXT[lang].portfolio_sector}`);
  }
  if (intent === "score_intro" || intent === "prepay_ok") return ok(intent === "prepay_ok" ? T.debt : T.fallback);
  return ok(T[intent]);
}
