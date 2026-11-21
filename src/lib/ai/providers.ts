// Provider abstraction. Model ids come ONLY from env (AI_MODEL). Never hardcode one.
export type ProviderName = "anthropic" | "gemini" | "mock";

export interface ProviderConfig {
  provider: ProviderName;
  model: string;
  key: string;
  warning?: string;
  /** Override the API host (a proxy, a gateway, or a local stand-in for tests). Defaults to the vendor's host. */
  baseUrl?: string;
}

export interface GenerateOptions {
  maxTokens?: number;
}

export interface LLM {
  name: ProviderName;
  generate(system: string, user: string, signal: AbortSignal, opts?: GenerateOptions): Promise<string>;
}

type Env = Record<string, string | undefined>;

/**
 * Output budget per task. Hindi and Tamil text uses many more tokens per word than English, and a
 * plan pack is the largest answer, so it gets the biggest budget. A truncated answer is NOT retried
 * (it would truncate again) and is reported as `truncated`, never silently swallowed.
 * AI_MAX_TOKENS overrides everything.
 */
export function maxTokensFor(task: string, lang: string, env: Env = process.env): number {
  const forced = Number(env.AI_MAX_TOKENS);
  if (Number.isFinite(forced) && forced > 0) return Math.min(forced, 32000);
  const indic = lang === "hi" || lang === "ta";
  if (task === "draftPlanPack") return indic ? 9000 : 4500;
  if (task === "adviserCopilot" || task === "secondOpinion" || task === "explainFindings") return indic ? 4500 : 2500;
  return indic ? 2000 : 1000;
}

export function resolveProvider(env: Env = process.env): ProviderConfig {
  const wanted = (env.AI_PROVIDER ?? "mock").toLowerCase();
  const model = (env.AI_MODEL ?? "").trim();
  if (wanted === "anthropic" || wanted === "gemini") {
    const key = (wanted === "anthropic" ? env.ANTHROPIC_API_KEY : env.GEMINI_API_KEY) ?? "";
    if (!key) return { provider: "mock", model: "", key: "", warning: `AI_PROVIDER=${wanted} but its API key is empty. Using mock.` };
    if (!model) return { provider: "mock", model: "", key: "", warning: `AI_PROVIDER=${wanted} but AI_MODEL is empty. Failing closed to mock.` };
    const baseUrl = ((wanted === "anthropic" ? env.ANTHROPIC_BASE_URL : env.GEMINI_BASE_URL) ?? "").trim().replace(/\/+$/, "");
    return { provider: wanted, model, key, ...(baseUrl ? { baseUrl } : {}) };
  }
  return { provider: "mock", model: "", key: "" };
}

export function makeLLM(cfg: ProviderConfig): LLM | null {
  if (cfg.provider === "anthropic") {
    return {
      name: "anthropic",
      async generate(system, user, signal, opts) {
        const res = await fetch(`${cfg.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: cfg.model, max_tokens: opts?.maxTokens ?? 2500, system, messages: [{ role: "user", content: user }] }),
        });
        if (!res.ok) throw new Error(`provider_http_${res.status}`);
        const j = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
        if (j.stop_reason === "max_tokens") throw new Error("truncated");
        return j.content?.find((c) => c.type === "text")?.text ?? "";
      },
    };
  }
  if (cfg.provider === "gemini") {
    return {
      name: "gemini",
      async generate(system, user, signal, opts) {
        const res = await fetch(`${cfg.baseUrl ?? "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
          method: "POST",
          signal,
          headers: { "content-type": "application/json", "x-goog-api-key": cfg.key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: opts?.maxTokens ?? 2500 },
          }),
        });
        if (!res.ok) throw new Error(`provider_http_${res.status}`);
        const j = (await res.json()) as { candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] };
        if (j.candidates?.[0]?.finishReason === "MAX_TOKENS") throw new Error("truncated");
        return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      },
    };
  }
  return null;
}

export function extractJson(raw: string): unknown {
  const t = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no_json");
  return JSON.parse(t.slice(a, b + 1));
}
