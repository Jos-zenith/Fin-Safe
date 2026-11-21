// Browser-side AI helper: calls the server route; if it is unreachable, falls back to the same
// validated fixtures so the demo never fails.
import { redact } from "@/lib/redact";
import { localFixture, type TaskRequest, type TaskResult } from "./run";

export async function callAI(req: TaskRequest): Promise<TaskResult> {
  const body = { ...req, text: req.text === undefined ? undefined : redact(req.text) };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    if (!res.ok) throw new Error("bad_status");
    return (await res.json()) as TaskResult;
  } catch {
    return { task: req.task, data: localFixture(body), source: "fixture", latencyMs: 0, events: [] };
  } finally {
    clearTimeout(timer);
  }
}
