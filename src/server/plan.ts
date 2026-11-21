// Plan drafting happens ON THE SERVER, from the profile the server holds. A customer cannot hand the server a
// plan; they can only ask it to draft one. In mock mode this is a pre-written template; with a configured provider
// it is the model's answer after the schema, number and safety checks, or the validated fixture if those fail.
import type { PlanPack } from "@/lib/ai/schemas";
import { makeLLM, resolveProvider } from "@/lib/ai/providers";
import { runTask, type SystemEvent, type TaskResult } from "@/lib/ai/run";
import { aiStats } from "@/lib/ai/stats";
import type { CopilotOut, Lang, UserProfile } from "@/types";

export interface DraftedPlan {
  plan: PlanPack;
  source: "mock" | "provider" | "fixture";
  events: SystemEvent[];
  latencyMs: number;
}

const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);

export type PlanGenerator = (profile: UserProfile, language: Lang) => Promise<DraftedPlan>;

const real: PlanGenerator = async (profile, language) => {
  const llm = makeLLM(resolveProvider());
  const result = await runTask(
    { task: "draftPlanPack", language, profile },
    { llm, timeoutMs: num(process.env.AI_TIMEOUT_MS), totalBudgetMs: num(process.env.AI_TOTAL_BUDGET_MS) },
  );
  aiStats.record(result);
  return { plan: result.data as PlanPack, source: result.source, events: result.events, latencyMs: result.latencyMs };
};

let generator: PlanGenerator = real;
export const generatePlan: PlanGenerator = (p, l) => generator(p, l);
/** Tests replace the generator (to simulate failures or a slow model) and restore it with null. */
export function setPlanGeneratorForTests(g: PlanGenerator | null): void {
  generator = g ?? real;
}

export interface DraftedFindings {
  findings: Record<string, string>;
  source: "mock" | "provider" | "fixture";
  events: SystemEvent[];
  latencyMs: number;
}
export type FindingsGenerator = (profile: UserProfile, language: Lang) => Promise<DraftedFindings>;

const realFindings: FindingsGenerator = async (profile, language) => {
  const llm = makeLLM(resolveProvider());
  const result = await runTask(
    { task: "explainFindings", language, profile },
    { llm, timeoutMs: num(process.env.AI_TIMEOUT_MS), totalBudgetMs: num(process.env.AI_TOTAL_BUDGET_MS) },
  );
  aiStats.record(result);
  return { findings: (result.data as { findings: Record<string, string> }).findings, source: result.source, events: result.events, latencyMs: result.latencyMs };
};
let findingsGenerator: FindingsGenerator = realFindings;
export const generateFindings: FindingsGenerator = (p, l) => findingsGenerator(p, l);
/** Tests replace the generator (a slow or failing model) and restore it with null. */
export function setFindingsGeneratorForTests(g: FindingsGenerator | null): void {
  findingsGenerator = g ?? realFindings;
}

// ---- the adviser's copilot and the customer's questions are also answered on the server ----

export async function generateCopilot(profile: UserProfile, language: Lang): Promise<{ out: CopilotOut; source: TaskResult["source"] }> {
  const llm = makeLLM(resolveProvider());
  const result = await runTask(
    { task: "adviserCopilot", language, profile },
    { llm, timeoutMs: num(process.env.AI_TIMEOUT_MS), totalBudgetMs: num(process.env.AI_TOTAL_BUDGET_MS) },
  );
  aiStats.record(result);
  return { out: result.data as CopilotOut, source: result.source };
}

export async function generateAnswer(profile: UserProfile, language: Lang, question: string, rateLimited: boolean): Promise<TaskResult> {
  const llm = makeLLM(resolveProvider());
  const result = await runTask(
    { task: "answerQuestion", language, profile, question },
    { llm, rateLimited, timeoutMs: num(process.env.AI_TIMEOUT_MS), totalBudgetMs: num(process.env.AI_TOTAL_BUDGET_MS) },
  );
  aiStats.record(result);
  return result;
}
