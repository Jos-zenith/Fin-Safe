"use client";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { RISK_QUESTIONS } from "@/lib/risk";
import { useApp } from "@/store/AppProvider";
import type { Case } from "@/types";
import { Card } from "./ui";

const dateOf = (iso: string, lang: string) => new Date(iso).toLocaleDateString(lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "ta-IN");

/**
 * What the adviser reads before confirming the risk profile: the customer's own answers, the computed label, anything
 * that does not fit their numbers, and the recorded (demo) consent. A label for discussion, not a suitability finding.
 */
export function RiskCard({ c }: { c: Case }) {
  const { t, lang } = useApp();
  const r = c.risk;
  return (
    <Card data-testid="risk-card">
      <h3 className="flex items-center gap-2 font-semibold">
        <ShieldCheck size={18} className="text-primary" aria-hidden /> {t("adv.risk.title")}
      </h3>
      {!r ? (
        <p className="mt-1 text-sm text-draft">{t("adv.err.risk_incomplete")}</p>
      ) : (
        <>
          <p className="mt-1 text-lg font-bold" data-testid="risk-category">
            {t(`risk.cat.${r.category}`)}
          </p>
          <p className="text-xs text-muted">{t("risk.note")}</p>
          <p className="num mt-1 text-xs text-muted">{t("adv.risk.scores", r.scores)}</p>
          {r.seeded && <p className="mt-1 text-sm font-medium text-info">{t("adv.risk.seeded")}</p>}
          {r.checks.length > 0 && (
            <ul className="mt-2 space-y-1" data-testid="risk-checks">
              {r.checks.map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm text-draft">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden /> {t(`risk.check.${k}`)}
                </li>
              ))}
            </ul>
          )}
          <details className="mt-2">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-primary">{t("agree.risk.title")}</summary>
            <dl className="space-y-2 text-sm">
              {RISK_QUESTIONS.map((q) => (
                <div key={q.id}>
                  <dt className="text-muted">{t(`risk.q.${q.id}`)}</dt>
                  <dd className="font-medium">{r.answers[q.id] === undefined ? "—" : t(`risk.o.${q.id}.${r.answers[q.id]}`)}</dd>
                </div>
              ))}
            </dl>
          </details>
          <p className={`mt-2 text-sm font-medium ${r.confirmedAt ? "text-reviewed" : "text-draft"}`} data-testid="risk-confirmation">
            {r.confirmedAt ? t("adv.risk.confirmed", { name: r.confirmedByName ?? "", date: dateOf(r.confirmedAt, lang) }) : t("adv.risk.notConfirmed")}
          </p>
        </>
      )}
      <p className="mt-2 border-t border-line pt-2 text-xs text-muted" data-testid="consent-line">
        {c.consent ? (c.consent.seeded ? t("adv.consent.seeded") : t("adv.consent", { version: c.consent.version, date: dateOf(c.consent.at, lang) })) : t("adv.consent.none")}
      </p>
    </Card>
  );
}
