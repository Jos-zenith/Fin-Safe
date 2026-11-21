import { NextResponse } from "next/server";
import { RequestSchema } from "@/lib/ai/request";
import { makeLLM, resolveProvider } from "@/lib/ai/providers";
import { runTask } from "@/lib/ai/run";
import { aiStats } from "@/lib/ai/stats";
import { clientKey } from "@/lib/ratelimit";
import { aiLimiter as limiter } from "@/server/limiter";
import { redact } from "@/lib/redact";

export const runtime = "nodejs";
// Hosts that read this (e.g. Vercel) allow a longer function. Long Hindi/Tamil plan packs need it
// if you raise AI_TIMEOUT_MS above the 10s default.
export const maxDuration = 60;

const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);

let warned = false;

function config() {
  const cfg = resolveProvider();
  if (cfg.warning && !warned) {
    warned = true;
    console.warn(`[ai] ${cfg.warning}`);
  }
  return cfg;
}

/** Which mode is the server in? Never exposes the key or the model id. */
export async function GET() {
  const cfg = config();
  return NextResponse.json({ mode: cfg.provider === "mock" ? "mock" : "live", fellBackToMock: !!cfg.warning });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const cfg = config();
  const llm = makeLLM(cfg);
  const r = parsed.data;
  // Mock answers are free, so only a real (paid) model is rate limited.
  const rateLimited = llm ? limiter.limited(clientKey(req.headers, process.env.TRUST_PROXY === "1")) : false;

  try {
    const result = await runTask(
      { ...r, text: r.text === undefined ? undefined : redact(r.text) },
      {
        llm,
        rateLimited,
        timeoutMs: num(process.env.AI_TIMEOUT_MS),
        totalBudgetMs: num(process.env.AI_TOTAL_BUDGET_MS),
        // Only task name, status, latency and rejection reasons are logged.
        log: (e) => console.info(JSON.stringify({ ai: e })),
      },
    );
    aiStats.record(result);
    return NextResponse.json(result);
  } catch {
    console.error(JSON.stringify({ ai: { task: r.task, status: "error" } }));
    return NextResponse.json({ error: "task_failed" }, { status: 500 });
  }
}
