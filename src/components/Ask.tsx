"use client";
import { Send, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { callAI } from "@/lib/ai/client";
import type { AnswerResult } from "@/lib/ai/schemas";
import { api } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import { Badge } from "./Badge";
import { SourceTag, type TextSource } from "./SourceTag";
import { Card } from "./ui";

/** A question box. A stock-tip request is refused and logged as a `system` audit entry. */
export function Ask({ id = "ask" }: { id?: string }) {
  const { state, t, lang } = useApp();
  const wf = useWorkflow();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<{ q: string; a?: AnswerResult; source?: TextSource }[]>([]);
  const profile = state?.profile;
  if (!profile) return null;

  const send = async (text?: string) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setQ("");
    setBusy(true);
    setChat((x) => [...x, { q: question }]);
    let out: { data: unknown; source: TextSource } | null = null;
    try {
      if (wf.role === "customer") {
        const r = await api<{ data: unknown; source: TextSource }>("POST", "ask", { question, language: lang });
        if (r.ok && r.data) out = r.data;
      }
    } catch {
      /* server unreachable: use the offline fixture below */
    }
    if (!out) {
      const r = await callAI({ task: "answerQuestion", language: lang, profile, question });
      out = { data: r.data, source: r.source };
    }
    const a = out.data as AnswerResult;
    setChat((x) => x.map((m, i) => (i === x.length - 1 ? { ...m, a, source: out!.source } : m)));
    setBusy(false);
  };

  return (
    <Card id={id} className="scroll-mt-28">
      <h2 className="t-h3 mb-3">{t("plan.ask")}</h2>
      <div className="mb-3" role="group" aria-label={t("ask.try")}>
        <p className="mb-1.5 text-xs font-semibold text-muted">{t("ask.try")}</p>
        <div className="flex flex-wrap gap-2">
          {["ask.s1", "ask.s2", "ask.s3", "ask.s4", "ask.s5"].map((k) => (
            <button key={k} type="button" disabled={busy} onClick={() => void send(t(k))} className="ac-chip ac-chip-neui min-h-11 px-3.5 text-[13px] hover:brightness-95 disabled:opacity-50">
              {t(k)}
            </button>
          ))}
        </div>
      </div>
      <p data-testid="ask-privacy" className="mb-3 rounded-xl bg-[#F3EAD0] p-2.5 text-xs font-medium text-[#4A2D00]">
        {t("ask.privacy")}
      </p>
      <div className="space-y-2" aria-live="polite">
        {chat.map((m, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-bubble-me px-3.5 py-2">{m.q}</p>
            {m.a ? (
              <div className={`max-w-[92%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 ${m.a.refused ? "border-draft/50 bg-draft-soft" : "border-line bg-bg"}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {m.a.refused ? <ShieldAlert size={16} className="text-draft" aria-hidden /> : <ShieldCheck size={16} className="text-primary" aria-hidden />}
                  <Badge kind={m.a.refused ? "EDUCATION" : "ANALYSIS"} />
                  {m.a.refused && <span className="text-xs font-bold text-draft">{t("ask.refusedTag")}</span>}
                </div>
                <p>{m.a.answer}</p>
                <SourceTag source={m.source} className="mt-1.5" />
              </div>
            ) : (
              <p className="text-sm text-muted">{t("plan.thinking")}</p>
            )}
          </div>
        ))}
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 300))} aria-label={t("plan.askPh")} placeholder={t("plan.askPh")} className="ac-field !min-h-12 flex-1 !rounded-full" />
        <button type="submit" disabled={!q.trim() || busy} aria-label={t("plan.send")} className="ac-btn ac-btn-primary !size-12 !min-h-12 !p-0">
          <Send size={20} aria-hidden />
        </button>
      </form>
    </Card>
  );
}
