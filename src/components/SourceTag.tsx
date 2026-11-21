"use client";
import { Cpu, FileText, ShieldAlert } from "lucide-react";
import { useApp } from "@/store/AppProvider";

export type TextSource = "mock" | "provider" | "fixture";

/**
 * Says where a piece of AI-prepared text came from, and lets anyone expand "How was this made?":
 *  - Template (mock): pre-written wording filled with the app's own figures; no model was used.
 *  - Live model: a model wrote it, then every number was replaced and every rule checked.
 *  - Fallback after validation failure: a model was tried, its answer was rejected, pre-written wording is shown.
 */
export function SourceTag({ source, className = "" }: { source: TextSource | null | undefined; className?: string }) {
  const { t } = useApp();
  if (!source) return null;
  const map = {
    mock: { icon: FileText, text: t("ask.fromTemplate"), tone: "text-muted" },
    provider: { icon: Cpu, text: t("ask.fromLive"), tone: "text-primary" },
    fixture: { icon: ShieldAlert, text: t("ai.safeText"), tone: "text-draft" },
  }[source];
  const Icon = map.icon;
  return (
    <div data-source={source} className={`text-xs ${map.tone} ${className}`}>
      <p role="note" className="flex items-start gap-1.5 font-medium">
        <Icon size={13} className="mt-0.5 shrink-0" aria-hidden />
        {map.text}
      </p>
      <details className="mt-0.5 pl-5">
        <summary className="cursor-pointer font-semibold text-primary underline underline-offset-2">{t("ai.how")}</summary>
        <p className="mt-1 text-muted">{t(`ai.how.${source}`)}</p>
      </details>
    </div>
  );
}
