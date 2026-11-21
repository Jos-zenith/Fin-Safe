// WIRE TEST, not a model test. The real provider adapters (src/lib/ai/providers.ts) send real HTTP to a
// local stand-in that speaks the Anthropic Messages and Gemini generateContent formats. This proves the
// request shape, auth headers, parsing, truncation / timeout / HTTP-error handling and the whole
// validation pipeline over a socket. It does NOT prove model quality: the stand-in only echoes the
// placeholders the prompt offers. For the real thing run `npm run test:live` with a key.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PRIYA } from "@/data/personas";
import { makeLLM, resolveProvider, type ProviderConfig } from "@/lib/ai/providers";
import { runTask, type TaskRequest } from "@/lib/ai/run";
import { expandPlaceholderList } from "@/lib/ai/prompts";
import { PlanPackSchema } from "@/lib/ai/schemas";
import { runEngine } from "@/lib/engine";

type Mode = "ok" | "truncated" | "http500" | "http401" | "slow" | "bad_number" | "stock_tip";
interface Captured {
  url: string;
  headers: IncomingMessage["headers"];
  body: Record<string, unknown>;
}

let server: Server;
let base = "";
let mode: Mode = "ok";
const seen: Captured[] = [];

const MODEL = "test-model-x"; // arbitrary id: the app must take it from the environment only

/** Builds a plausible JSON answer from nothing but what the PROMPT offered. */
function standIn(user: string): unknown {
  const task = /Task: (\w+)\./.exec(user)?.[1];
  const list = /Allowed placeholders[^\n]*\n([^\n]*)/.exec(user)?.[1] ?? "";
  const offered = new Set(expandPlaceholderList(list));
  const has = (k: string) => offered.has(k);
  if (mode === "bad_number") return task === "nudgeCopy" ? { text: "Save 15 more every month." } : { findings: { ef: "Keep 15 months saved." } };
  if (mode === "stock_tip") return { text: "You should buy this stock now." };
  switch (task) {
    case "explainFindings":
      return { findings: { score: has("health.score") ? "Your health score is {{health.score}}." : "A summary.", ef: has("ef.months") ? "You have {{ef.months}} months saved against {{ef.target}}." : "OK." } };
    case "nudgeCopy":
      return { text: "Your reserve covers {{ef.months}} months." };
    case "answerQuestion":
      return { answer: "You have {{ef.months}} months saved.", refused: false };
    case "draftPlanPack": {
      const ctx = JSON.parse(/Context \(synthetic, minimal\): (\{.*\})/.exec(user)![1]) as { goals: { id: string; kind: string }[] };
      const items = [
        { id: "p-emergency_reserve", topic: "emergency_reserve", assetClass: "liquid_reserve", title: "Build a reserve", rationale: "You have {{ef.months}} months saved; the target is {{ef.target}}.", risks: "Liquid options earn modest returns.", evidenceRefs: ["ef.months"] },
        ...ctx.goals.map((g) => ({
          id: `p-goal_long-${g.id}`, topic: "goal_long", assetClass: "equity", goalRef: g.id, title: "Plan for a goal",
          rationale: `The monthly amount may range from {{goal.${g.id}.sip.high}} to {{goal.${g.id}.sip.low}}.`, risks: "Returns are not promised.", evidenceRefs: [`goal.${g.id}.sip`],
        })),
      ];
      return { lang: "en", summary: "A draft for review.", priorities: items.map((i) => i.id), items, checklist: ["Confirm your answers"], adviserQuestions: ["Is income captured correctly?"] };
    }
    default:
      return {};
  }
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>;
      seen.push({ url: req.url ?? "", headers: req.headers, body });
      const anthropic = (req.url ?? "").startsWith("/v1/messages");
      const user = anthropic
        ? ((body.messages as { content: string }[])[0]?.content ?? "")
        : ((body.contents as { parts: { text: string }[] }[])[0]?.parts[0]?.text ?? "");
      const send = (code: number, payload: unknown) => {
        res.writeHead(code, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      };
      if (mode === "http500") return send(500, { error: "boom" });
      if (mode === "http401") return send(401, { error: "bad key" });
      const reply = () => {
        const text = JSON.stringify(standIn(user));
        if (anthropic) send(200, { stop_reason: mode === "truncated" ? "max_tokens" : "end_turn", content: [{ type: "text", text }] });
        else send(200, { candidates: [{ finishReason: mode === "truncated" ? "MAX_TOKENS" : "STOP", content: { parts: [{ text }] } }] });
      };
      if (mode === "slow") return void setTimeout(reply, 400);
      reply();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const cfg = (provider: "anthropic" | "gemini"): ProviderConfig => ({ provider, model: MODEL, key: "test-key-123", baseUrl: base });
const run = (provider: "anthropic" | "gemini", req: TaskRequest, extra: { timeoutMs?: number } = {}) => {
  seen.length = 0;
  return runTask(req, { llm: makeLLM(cfg(provider)), ...extra });
};

describe("config", () => {
  it("reads a base URL override and trims the trailing slash", () => {
    const c = resolveProvider({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", AI_MODEL: "m", ANTHROPIC_BASE_URL: "http://x.test/" });
    expect(c.baseUrl).toBe("http://x.test");
    expect(resolveProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "k", AI_MODEL: "m" }).baseUrl).toBeUndefined();
  });
});

for (const provider of ["anthropic", "gemini"] as const) {
  describe(`${provider} adapter over HTTP`, () => {
    it("sends a well-formed, authenticated request with the model id and token budget from config", async () => {
      mode = "ok";
      const out = await run(provider, { task: "explainFindings", language: "en", profile: PRIYA });
      expect(out.source).toBe("provider");
      expect(out.events).toEqual([]);
      const r = seen[0];
      if (provider === "anthropic") {
        expect(r.url).toBe("/v1/messages");
        expect(r.headers["x-api-key"]).toBe("test-key-123");
        expect(r.headers["anthropic-version"]).toBeTruthy();
        expect(r.body.model).toBe(MODEL);
        expect(typeof r.body.max_tokens).toBe("number");
        expect(String(r.body.system)).toContain("NEVER write literal numbers");
      } else {
        expect(r.url).toBe(`/v1beta/models/${MODEL}:generateContent`);
        expect(r.headers["x-goog-api-key"]).toBe("test-key-123");
        expect((r.body.generationConfig as { responseMimeType: string }).responseMimeType).toBe("application/json");
        expect(typeof (r.body.generationConfig as { maxOutputTokens: number }).maxOutputTokens).toBe("number");
        expect(JSON.stringify(r.body.systemInstruction)).toContain("NEVER write literal numbers");
      }
    });

    it("the model's placeholders are replaced with real engine figures", async () => {
      mode = "ok";
      const out = await run(provider, { task: "explainFindings", language: "en", profile: PRIYA });
      expect((out.data as { findings: { ef: string; score: string } }).findings.ef).toBe("You have 1.8 months saved against 6.");
      expect((out.data as { findings: { score: string } }).findings.score).toMatch(/^Your health score is \d+\.$/);
    });

    it("never sends the user's name, city or raw figures to the model", async () => {
      mode = "ok";
      await run(provider, { task: "draftPlanPack", language: "ta", profile: PRIYA });
      const wire = JSON.stringify(seen[0].body);
      for (const secret of ["Priya", "Chennai", "45000", "45,000", "25000", "800000", "8,00,000"]) expect(wire, secret).not.toContain(secret);
      expect(wire).toContain("Tamil"); // the requested language is sent
    });

    it("a plan pack from the wire is schema-valid, has an item per goal, and uses engine figures", async () => {
      mode = "ok";
      const out = await run(provider, { task: "draftPlanPack", language: "en", profile: PRIYA });
      expect(out.source).toBe("provider");
      const pack = PlanPackSchema.parse(out.data);
      expect(pack.items.map((i) => i.goalRef).filter(Boolean)).toEqual(["g1", "g2"]);
      const e = runEngine(PRIYA);
      const g1 = pack.items.find((i) => i.goalRef === "g1")!;
      expect(g1.rationale).toContain(Math.round(e.flat["goal.g1.sip.low"]).toLocaleString("en-IN"));
      expect(JSON.stringify(pack)).not.toContain("{{");
    });

    it("a model answer with an invented number is rejected and replaced, over the wire", async () => {
      mode = "bad_number";
      const out = await run(provider, { task: "nudgeCopy", language: "en", profile: PRIYA, nudge: { ruleId: "ef_low" } });
      expect(out.source).toBe("fixture");
      expect(out.events.some((e) => e.kind === "numeric_rejected")).toBe(true);
      expect(seen.length).toBe(2); // one retry
    });

    it("a model stock tip is replaced and logged", async () => {
      mode = "stock_tip";
      const out = await run(provider, { task: "nudgeCopy", language: "en", profile: PRIYA, nudge: { ruleId: "ef_low" } });
      expect(out.events.some((e) => e.kind === "guardrail")).toBe(true);
      expect(JSON.stringify(out.data)).not.toMatch(/buy this stock/i);
    });

    it("a truncated answer is reported and not retried", async () => {
      mode = "truncated";
      const out = await run(provider, { task: "draftPlanPack", language: "ta", profile: PRIYA });
      expect(out.source).toBe("fixture");
      expect(out.events[0]).toEqual({ kind: "provider_error", detail: "truncated" });
      expect(seen.length).toBe(1);
    });

    it("HTTP 500 is retried once, then falls back; the status is recorded", async () => {
      mode = "http500";
      const out = await run(provider, { task: "adviserCopilot", language: "en", profile: PRIYA });
      expect(out.source).toBe("fixture");
      expect(out.events.filter((e) => e.detail === "http_500")).toHaveLength(2);
      expect(seen.length).toBe(2);
    });

    it("a bad API key (401) falls back safely", async () => {
      mode = "http401";
      const out = await run(provider, { task: "adviserCopilot", language: "en", profile: PRIYA });
      expect(out.source).toBe("fixture");
      expect(out.events[0].detail).toBe("http_401");
    });

    it("a slow provider times out, is reported, and is not retried", async () => {
      mode = "slow";
      const out = await run(provider, { task: "nudgeCopy", language: "en", profile: PRIYA, nudge: { ruleId: "ef_low" } }, { timeoutMs: 80 });
      expect(out.source).toBe("fixture");
      expect(out.events[0]).toEqual({ kind: "provider_error", detail: "timeout" });
      expect(seen.length).toBe(1);
    });
  });
}
