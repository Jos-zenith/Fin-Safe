import { describe, expect, it, vi } from "vitest";
import { PRIYA } from "@/data/personas";
import { maxTokensFor, type LLM } from "@/lib/ai/providers";
import { runTask, type TaskRequest } from "@/lib/ai/run";

const req: TaskRequest = { task: "draftPlanPack", language: "ta", profile: PRIYA };

describe("live-mode operations", () => {
  it("Hindi and Tamil plan packs get a bigger output budget than English, and everything is bounded", () => {
    expect(maxTokensFor("draftPlanPack", "ta", {})).toBeGreaterThan(maxTokensFor("draftPlanPack", "en", {}));
    expect(maxTokensFor("draftPlanPack", "hi", {})).toBeGreaterThan(2500);
    expect(maxTokensFor("nudgeCopy", "en", {})).toBeLessThan(maxTokensFor("draftPlanPack", "en", {}));
    expect(maxTokensFor("draftPlanPack", "en", { AI_MAX_TOKENS: "123456" })).toBe(32000);
    expect(maxTokensFor("draftPlanPack", "en", { AI_MAX_TOKENS: "777" })).toBe(777);
  });

  it("passes the output budget to the model", async () => {
    const gen = vi.fn<LLM["generate"]>(async () => "{}");
    await runTask(req, { llm: { name: "anthropic", generate: gen } });
    expect(gen.mock.calls[0][3]).toEqual({ maxTokens: maxTokensFor("draftPlanPack", "ta") });
  });

  it("a truncated answer is reported as `truncated`, not retried, and falls back to the fixture", async () => {
    const gen = vi.fn(async () => {
      throw new Error("truncated");
    });
    const out = await runTask(req, { llm: { name: "anthropic", generate: gen } });
    expect(gen).toHaveBeenCalledTimes(1);
    expect(out.source).toBe("fixture");
    expect(out.events).toEqual(expect.arrayContaining([{ kind: "provider_error", detail: "truncated" }, expect.objectContaining({ kind: "fallback" })]));
  });

  it("a slow model times out, is reported as `timeout`, and is not retried", async () => {
    const slow: LLM = {
      name: "gemini",
      generate: (_s, _u, signal) => new Promise((_res, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))),
    };
    const gen = vi.spyOn(slow, "generate");
    const out = await runTask(req, { llm: slow, timeoutMs: 30 });
    expect(gen).toHaveBeenCalledTimes(1);
    expect(out.events[0]).toEqual({ kind: "provider_error", detail: "timeout" });
    expect(out.source).toBe("fixture");
  });

  it("does not start a retry that would overrun the total time budget", async () => {
    const gen = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 40));
      return JSON.stringify({ text: "Save 99 more" }); // rejected by the numeric check, so a retry would normally follow
    });
    const out = await runTask({ task: "nudgeCopy", language: "en", profile: PRIYA, nudge: { ruleId: "ef_low" } }, { llm: { name: "gemini", generate: gen }, timeoutMs: 50, totalBudgetMs: 60 });
    expect(gen).toHaveBeenCalledTimes(1);
    expect(out.events.some((e) => e.detail === "time_budget")).toBe(true);
  });

  it("HTTP errors are reported with their status", async () => {
    const gen = vi.fn(async () => {
      throw new Error("provider_http_429");
    });
    const out = await runTask({ task: "adviserCopilot", language: "en", profile: PRIYA }, { llm: { name: "anthropic", generate: gen } });
    expect(out.events[0]).toEqual({ kind: "provider_error", detail: "http_429" });
    expect(gen).toHaveBeenCalledTimes(2); // transient errors are retried once
  });
});
