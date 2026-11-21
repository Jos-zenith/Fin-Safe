// Server-side counters for the AI pipeline. They hold COUNTS ONLY: no text, no profile data, no keys.
// "Validation rejection rate" for a task = live requests where the model's answer failed a schema, number or
// safety check (even if the retry then passed) divided by live requests. They live in this server process's
// memory, so they reset on restart and are not shared between serverless instances (see docs/PRODUCTION_GAP.md).
import type { TaskName } from "./schemas";
import type { TaskResult } from "./run";

export interface TaskStats {
  calls: number;
  /** Requests where a real model was actually called (not mock, not rate limited). */
  live: number;
  /** Live requests whose final answer came from the model. */
  liveKept: number;
  /** Live requests with at least one schema / numeric / guardrail rejection, even if the retry passed. */
  rejected: number;
  schemaInvalid: number;
  numericRejected: number;
  guardrail: number;
  providerError: number;
  /** Live requests that ended on the validated fixture. */
  fallback: number;
  rateLimited: number;
  refusals: number;
  latencyTotalMs: number;
  latencyMaxMs: number;
}

const empty = (): TaskStats => ({
  calls: 0,
  live: 0,
  liveKept: 0,
  rejected: 0,
  schemaInvalid: 0,
  numericRejected: 0,
  guardrail: 0,
  providerError: 0,
  fallback: 0,
  rateLimited: 0,
  refusals: 0,
  latencyTotalMs: 0,
  latencyMaxMs: 0,
});

/** How many recent outputs the "AI status" line looks at. */
export const RECENT_N = 20;
export type OutputKind = "live" | "template" | "fallback";

export class AiStats {
  private byTask = new Map<TaskName, TaskStats>();
  /** The kind of each of the last RECENT_N outputs, oldest first. Counts only: no text, no task content. */
  private recentKinds: OutputKind[] = [];

  record(result: Pick<TaskResult, "task" | "source" | "latencyMs" | "events">): void {
    const s = this.byTask.get(result.task) ?? empty();
    const kinds = result.events.map((e) => e.kind);
    const count = (k: string) => kinds.filter((x) => x === k).length;
    s.calls++;
    s.latencyTotalMs += result.latencyMs;
    s.latencyMaxMs = Math.max(s.latencyMaxMs, result.latencyMs);
    s.refusals += count("refusal") ? 1 : 0;
    s.rateLimited += count("rate_limited") ? 1 : 0;
    const schema = count("schema_invalid");
    const numeric = count("numeric_rejected");
    const guard = count("guardrail");
    const err = count("provider_error");
    // A live request is one where the model was really called: it kept the answer, or it fell back after trying.
    const live = result.source === "provider" || kinds.includes("fallback");
    if (live) {
      s.live++;
      if (result.source === "provider") s.liveKept++;
      if (kinds.includes("fallback")) s.fallback++;
      if (schema + numeric + guard > 0) s.rejected++;
      s.schemaInvalid += schema;
      s.numericRejected += numeric;
      s.guardrail += guard;
      s.providerError += err;
    }
    this.byTask.set(result.task, s);
    // live = a model wrote it and it passed every check; fallback = a model was tried and pre-written text is shown;
    // template = no model was used at all
    this.recentKinds.push(result.source === "provider" ? "live" : result.source === "fixture" ? "fallback" : "template");
    if (this.recentKinds.length > RECENT_N) this.recentKinds.shift();
  }

  /** Exactly which of the last outputs were live, template or fallback. */
  recent(): { n: number; size: number; live: number; template: number; fallback: number } {
    const k = this.recentKinds;
    return { n: k.length, size: RECENT_N, live: k.filter((x) => x === "live").length, template: k.filter((x) => x === "template").length, fallback: k.filter((x) => x === "fallback").length };
  }

  get(task: TaskName): TaskStats {
    return { ...(this.byTask.get(task) ?? empty()) };
  }

  /** Share of live requests with at least one validation rejection. null until a real model has been called. */
  rejectionRate(task: TaskName): number | null {
    const s = this.byTask.get(task);
    return s && s.live > 0 ? s.rejected / s.live : null;
  }

  snapshot(): Record<string, TaskStats & { rejectionRate: number | null; meanLatencyMs: number | null }> {
    const out: Record<string, TaskStats & { rejectionRate: number | null; meanLatencyMs: number | null }> = {};
    for (const [task, s] of this.byTask) {
      out[task] = { ...s, rejectionRate: s.live > 0 ? s.rejected / s.live : null, meanLatencyMs: s.calls > 0 ? Math.round(s.latencyTotalMs / s.calls) : null };
    }
    return out;
  }

  reset(): void {
    this.byTask.clear();
    this.recentKinds = [];
  }
}

// One shared instance per server process, surviving dev hot reloads.
const g = globalThis as unknown as { __finSafeAiStats?: AiStats };
export const aiStats: AiStats = (g.__finSafeAiStats ??= new AiStats());
