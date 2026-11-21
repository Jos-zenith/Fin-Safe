"use client";
import { Info, ShieldCheck, ShieldQuestion, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Card } from "@/components/ui";
import { assessProfile, type Issue, type MetricQuality, type Quality } from "@/lib/quality";
import { useApp } from "@/store/AppProvider";
import type { EngineResult, UserProfile } from "@/types";

/** Data quality for the profile on screen, using the intake answers this browser knows about and the adviser reviews. */
export function useQuality(profile: UserProfile | null, engine: EngineResult | null): Quality | null {
  const { state, reviews } = useApp();
  const extras = state?.extras;
  return useMemo(() => (profile && engine ? assessProfile(profile, engine, { answered: new Set(extras ?? []), reviews }) : null), [profile, engine, extras, reviews]);
}

type T = (k: string, v?: Record<string, string | number>) => string;
const fieldNames = (t: T, fields: readonly string[]) => fields.map((f) => t(`dq.field.${f}`)).join(", ");

/** "Cannot calculate reliably: <what is missing>" for a metric whose key input is missing. */
export const cannotText = (t: T, q: MetricQuality) => t("conf.cannot", { what: fieldNames(t, q.missing) });

const ICON = { high: ShieldCheck, medium: ShieldQuestion, low: TriangleAlert } as const;
const TONE = { high: "bg-reviewed-soft text-reviewed", medium: "bg-info-soft text-info", low: "bg-draft-soft text-draft" } as const;

/** A confidence label next to a number. Opens to say why: what is missing, defaulted, off, or unreviewed. */
export function ConfidenceChip({ q, className = "" }: { q: MetricQuality; className?: string }) {
  const { t } = useApp();
  const Icon = ICON[q.level];
  return (
    <details className={`group inline-block align-top ${className}`} data-testid="confidence" data-level={q.level}>
      <summary className={`inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE[q.level]}`}>
        <Icon size={12} aria-hidden /> {t("conf.label", { level: t(`conf.${q.level}`) })}
      </summary>
      <div className="mt-1 max-w-xs rounded-xl border border-line bg-surface p-2 text-xs text-fg shadow-card">
        <p className="mb-1 font-semibold">{t("conf.why")}</p>
        <ul className="list-disc space-y-0.5 pl-4">
          {q.missing.length > 0 && <li>{t("conf.why.missing", { fields: fieldNames(t, q.missing) })}</li>}
          {q.defaults.length > 0 && <li>{t("conf.why.defaults", { fields: fieldNames(t, q.defaults) })}</li>}
          {q.implausible.length > 0 && <li>{t("conf.why.implausible", { fields: fieldNames(t, q.implausible) })}</li>}
          {q.unverified.length > 0 && <li>{t("conf.why.unverified")}</li>}
          {!q.missing.length && !q.defaults.length && !q.implausible.length && !q.unverified.length && <li>{t("conf.why.complete")}</li>}
        </ul>
      </div>
    </details>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const { t } = useApp();
  const soft = issue.kind === "default";
  const Icon = soft ? Info : TriangleAlert;
  return (
    <li className="flex items-start gap-2 py-1.5" data-issue={issue.code} data-kind={issue.kind}>
      <Icon size={16} className={`mt-0.5 shrink-0 ${soft ? "text-info" : "text-draft"}`} aria-hidden />
      <span className="text-sm">{t(`dq.issue.${issue.code}`, { fields: fieldNames(t, issue.fields) })}</span>
    </li>
  );
}

/**
 * What is missing, what looks off, what is only a default. Shown BEFORE the results are relied on, and to the adviser.
 * `hideDefaults` keeps the first dashboard view short: only things that can make a number wrong are listed.
 */
export function DataQualityCard({ quality, hideDefaults = false, compact = false, link = true }: { quality: Quality; hideDefaults?: boolean; compact?: boolean; link?: boolean }) {
  const { t } = useApp();
  const issues = quality.issues.filter((i) => !(hideDefaults && i.kind === "default"));
  if (!issues.length) return null;
  const serious = issues.some((i) => i.kind !== "default");
  return (
    <Card data-testid="data-quality" data-serious={serious ? "yes" : "no"} className={serious ? "border border-draft/50" : ""}>
      <h2 className="flex items-center gap-2 font-semibold">
        <TriangleAlert size={18} className={serious ? "text-draft" : "text-info"} aria-hidden /> {t(compact ? "adv.dq" : "dq.title")}
      </h2>
      {!compact && <p className="mt-1 text-sm text-muted">{t("dq.sub")}</p>}
      <ul className="mt-2 divide-y divide-line">
        {issues.map((i) => (
          <IssueRow key={i.code} issue={i} />
        ))}
      </ul>
      {link && (
        <Link href="/confirm" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary">
          {t("dq.fix")}
        </Link>
      )}
    </Card>
  );
}
