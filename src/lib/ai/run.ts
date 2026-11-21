// Task orchestrator. Pipeline for EVERY output (mock or real):
//   schema (Zod) -> numeric check on templates -> placeholder substitution -> numeric check on result
//   -> guardrails. Failure: retry once, then fall back to the validated mock fixture.
import { emptyProfile } from "@/data/personas";
import { runEngine } from "@/lib/engine";
import { redact } from "@/lib/redact";
import type { EngineResult, Lang, NudgeRuleId, UserProfile } from "@/types";
import { applyGuardrails, classifyRequest, type GuardrailMode } from "./guardrails";
import { mockAnswer, mockCopilot, mockFindings, mockNudge, mockPlanPack } from "./mock";
import { mockSecondOpinion, secondOpinionGround } from "./mock/secondOpinion";
import { renderTemplate, validateNumericIntegrity, type Ground } from "./numeric";
import { buildPrompt } from "./prompts";
import { mergeSecondOpinion, proseOf } from "./secondOpinionMerge";
import { claimsSafe } from "@/lib/scam/wording";
import { extractJson, maxTokensFor, type LLM } from "./providers";
import { NON_PROSE_KEYS, TASK_SCHEMAS, type SecondOpinionResult, type TaskName } from "./schemas";

export interface TaskRequest {
  task: TaskName;
  language: Lang;
  profile?: UserProfile;
  text?: string;
  question?: string;
  nudge?: { ruleId: NudgeRuleId; goalId?: string };
}

export interface SystemEvent {
  kind: "numeric_rejected" | "guardrail" | "schema_invalid" | "provider_error" | "fallback" | "rate_limited" | "refusal";
  detail: string;
}

export interface TaskResult {
  task: TaskName;
  data: unknown;
  source: "mock" | "provider" | "fixture";
  latencyMs: number;
  events: SystemEvent[];
}

export interface Deps {
  llm?: LLM | null;
  rateLimited?: boolean;
  /** Per model call. PRD default 10s; raise it for long Hindi / Tamil plan packs on hosts that allow it. */
  timeoutMs?: number;
  /** Total time for all attempts, so a retry cannot overrun the host's function limit. */
  totalBudgetMs?: number;
  maxTokens?: number;
  /** Receives task name, status, latency and reasons only. Never profile data or text. */
  log?: (e: { task: string; status: string; latencyMs: number; reasons: string[] }) => void;
}

type Json = unknown;

function mapProse(value: Json, fn: (s: string) => string, key?: string): Json {
  if (typeof value === "string") return key && NON_PROSE_KEYS.has(key) ? value : fn(value);
  if (Array.isArray(value)) return value.map((v) => mapProse(v, fn, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapProse(v, fn, k)]));
  }
  return value;
}

/**
 * `strict` is used for a real model's answer: if ANY safety rule fires (a named security, a promise, a price
 * call), the whole answer is rejected and the pipeline retries or falls back to the validated fixture. Without
 * `strict` (fixtures, mock) the offending sentence is replaced by a neutral one.
 */
export function processOutput(
  data: Json,
  ground: Ground,
  lang: Lang,
  mode: GuardrailMode = "personal",
  strict = false,
): { ok: true; data: Json; events: SystemEvent[] } | { ok: false; events: SystemEvent[] } {
  const events: SystemEvent[] = [];
  const bad: string[] = [];

  // 0) the priority ladder: while an earlier step is blocked, goal amounts are "later", never the action
  const goalsLater = (ground as Partial<EngineResult>).ladder?.goalsLater === true;
  if (goalsLater) {
    mapProse(data, (s) => {
      if (/\{\{\s*goal\.[^}]*\.(?:sip|future)\b/.test(s)) bad.push("ladder:goal_amount_while_blocked");
      return s;
    });
    if (bad.length) return { ok: false, events: [{ kind: "numeric_rejected", detail: `ladder: ${[...new Set(bad)].join(", ")}` }] };
  }

  // 1) numeric check on the TEMPLATES (before substitution)
  mapProse(data, (s) => {
    const r = validateNumericIntegrity(s, ground, undefined, "pre");
    if (!r.ok) bad.push(...r.violations);
    return s;
  });
  if (bad.length) return { ok: false, events: [{ kind: "numeric_rejected", detail: `pre: ${[...new Set(bad)].slice(0, 10).join(", ")}` }] };

  // 2) substitute engine values, 3) numeric check on the RESULT
  const rendered = mapProse(data, (s) => {
    const r = renderTemplate(s, ground);
    if (r.missing.length) bad.push(...r.missing.map((m) => `unresolved:${m}`));
    const v = validateNumericIntegrity(r.text, ground, undefined, "post");
    if (!v.ok) bad.push(...v.violations);
    return r.text;
  });
  if (bad.length) return { ok: false, events: [{ kind: "numeric_rejected", detail: `post: ${[...new Set(bad)].slice(0, 10).join(", ")}` }] };

  // 4) guardrails on every prose string
  const safe = mapProse(rendered, (s) => {
    const g = applyGuardrails(s, lang, mode);
    if (g.hits.length) events.push({ kind: "guardrail", detail: g.hits.map((h) => h.category).join("+") });
    return g.text;
  });
  if (strict && events.some((e) => e.kind === "guardrail")) return { ok: false, events };
  return { ok: true, data: safe, events };
}

/** The template form (placeholders not yet filled) of the pre-written answer. A well-behaved model writes this shape. */
export function fixtureFor(req: TaskRequest, engine: EngineResult): Json {
  const lang = req.language;
  switch (req.task) {
    case "explainFindings":
      return mockFindings(engine_profile(req), engine, lang);
    case "draftPlanPack":
      return mockPlanPack(engine_profile(req), engine, lang);
    case "secondOpinion":
      return mockSecondOpinion(req.text ?? "", lang);
    case "adviserCopilot":
      return mockCopilot(lang, engine);
    case "nudgeCopy":
      return mockNudge(req.nudge ?? { ruleId: "ef_low" }, lang, engine);
    case "answerQuestion":
      return mockAnswer(req.question ?? "", lang, engine_profile(req), engine);
  }
}

const engine_profile = (req: TaskRequest) => req.profile ?? emptyProfile(req.language);

/** Explaining a pasted message is education; everything tied to the user is personal. */
const modeOf = (req: TaskRequest): GuardrailMode => (req.task === "secondOpinion" ? "education" : "personal");

/** Light, task-specific cleanup of a schema-valid model answer. */
function normalize(req: TaskRequest, data: Json): Json {
  const d = data as Record<string, unknown>;
  if (req.task === "draftPlanPack") {
    const items = d.items as { id: string }[];
    const ids = new Set(items.map((i) => i.id));
    const pri = (d.priorities as string[]).filter((p) => ids.has(p));
    for (const i of items) if (!pri.includes(i.id)) pri.push(i.id);
    return { ...d, lang: req.language, priorities: pri };
  }
  if (req.task === "secondOpinion") {
    const text = (req.text ?? "").toLowerCase();
    const flags = (d.flags as { quote: string }[]).map((f) => ({ ...f, quote: text.includes(f.quote.toLowerCase()) ? f.quote : "" }));
    return { ...d, flags };
  }
  return data;
}

export async function runTask(req: TaskRequest, deps: Deps = {}): Promise<TaskResult> {
  const t0 = Date.now();
  const events: SystemEvent[] = [];
  const lang = req.language;
  const profile = engine_profile(req);
  const engine = runEngine(profile);
  const ground: Ground = req.task === "secondOpinion" ? secondOpinionGround(req.text ?? "") : engine;

  const done = (data: Json, source: TaskResult["source"]): TaskResult => {
    const latencyMs = Date.now() - t0;
    deps.log?.({
      task: req.task,
      status: source === "provider" || source === "mock" ? "ok" : "fallback",
      latencyMs,
      reasons: events.map((e) => (e.kind === "numeric_rejected" ? `${e.kind}(${e.detail})` : e.kind)),
    });
    return { task: req.task, data, source, latencyMs, events };
  };

  // A request for a specific stock / fund or a market / price prediction never reaches a model.
  const refusalKind = req.task === "answerQuestion" ? classifyRequest(req.question ?? "") : null;
  if (refusalKind) {
    events.push({ kind: "refusal", detail: refusalKind === "prediction" ? "prediction_request" : "stock_tip_request" });
    const pr = processOutput(mockAnswer(req.question ?? "", lang, profile, engine), ground, lang);
    if (!pr.ok) throw new Error("fixture_failed");
    return done(pr.data, "mock");
  }

  if (deps.llm && !deps.rateLimited) {
    const { system, user } = buildPrompt({
      task: req.task,
      lang,
      profile,
      engine,
      ground,
      // defence in depth: whatever the caller did, nothing free-typed reaches a model without being redacted first
      text: req.text === undefined ? undefined : redact(req.text),
      question: req.question === undefined ? undefined : redact(req.question),
      ruleId: req.nudge?.ruleId,
      goalId: req.nudge?.goalId,
    });
    const perCall = deps.timeoutMs ?? 10000;
    const budget = deps.totalBudgetMs ?? perCall * 2 + 2000;
    const maxTokens = deps.maxTokens ?? maxTokensFor(req.task, lang);
    for (let attempt = 0; attempt < 2; attempt++) {
      // Never start a retry that could overrun the host's function time limit.
      if (attempt > 0 && Date.now() - t0 + perCall > budget) {
        events.push({ kind: "provider_error", detail: "time_budget" });
        break;
      }
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), perCall);
      try {
        const raw = await deps.llm.generate(system, user, ctl.signal, { maxTokens });
        const parsed = TASK_SCHEMAS[req.task].safeParse(extractJson(raw));
        if (!parsed.success) {
          events.push({ kind: "schema_invalid", detail: parsed.error.issues[0]?.path.join(".") ?? "schema" });
          continue;
        }
        // A model may never call a message safe, whatever else it says.
        if (req.task === "secondOpinion" && claimsSafe(proseOf(parsed.data as SecondOpinionResult))) {
          events.push({ kind: "guardrail", detail: "safe_verdict" });
          continue;
        }
        const pr = processOutput(normalize(req, parsed.data), ground, lang, modeOf(req), true);
        events.push(...pr.events);
        if (pr.ok) {
          if (req.task === "secondOpinion") {
            // the model pass can add warning signs or raise a severity, never remove or lower what the rules found
            const rules = processOutput(fixtureFor(req, engine), ground, lang, modeOf(req));
            if (rules.ok) return done(mergeSecondOpinion(pr.data as SecondOpinionResult, rules.data as SecondOpinionResult, lang), "provider");
          }
          return done(pr.data, "provider");
        }
      } catch (e) {
        // read the fields, do not use `instanceof Error`: an AbortError can come from another realm (a VM context, a worker)
        const err = (e && typeof e === "object" ? e : {}) as { name?: unknown; message?: unknown };
        const name = typeof err.name === "string" ? err.name : "error";
        const msg = typeof err.message === "string" ? err.message : "";
        const detail = name === "AbortError" ? "timeout" : msg === "truncated" ? "truncated" : msg.startsWith("provider_http_") ? msg.replace("provider_", "") : name;
        events.push({ kind: "provider_error", detail });
        // A timeout or a truncated answer would just repeat; go straight to the fixture.
        if (detail === "timeout" || detail === "truncated") break;
      } finally {
        clearTimeout(timer);
      }
    }
    events.push({ kind: "fallback", detail: "validated mock fixture used" });
  } else if (deps.rateLimited) {
    events.push({ kind: "rate_limited", detail: "served from fixture" });
  }

  const pr = processOutput(fixtureFor(req, engine), ground, lang, modeOf(req));
  if (!pr.ok) throw new Error(`fixture_failed:${pr.events[0]?.detail}`);
  events.push(...pr.events);
  return done(pr.data, deps.llm ? "fixture" : "mock");
}

/** Synchronous, validated fixture with no network. Seeds the demo and is the client's offline fallback. */
export function localFixture(req: TaskRequest): unknown {
  const engine = runEngine(engine_profile(req));
  const ground: Ground = req.task === "secondOpinion" ? secondOpinionGround(req.text ?? "") : engine;
  const pr = processOutput(fixtureFor(req, engine), ground, req.language, modeOf(req));
  if (!pr.ok) throw new Error(`fixture_failed:${pr.events[0]?.detail}`);
  return pr.data;
}
