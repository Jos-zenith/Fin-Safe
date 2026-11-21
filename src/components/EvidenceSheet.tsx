"use client";
import { Calculator } from "lucide-react";
import { assumption, statusOf } from "@/config/assumptions";
import { findResult } from "@/lib/engine";
import { formatValue, groupIndian } from "@/lib/format";
import { useApp } from "@/store/AppProvider";
import type { EngineResult, Unit } from "@/types";
import { Badge } from "./Badge";
import { Sheet } from "./Sheet";

const fmtInput = (v: number | string | boolean) =>
  typeof v === "number" ? (Math.abs(v) >= 1000 ? groupIndian(v) : String(Math.round(v * 100) / 100)) : String(v);

/** Evidence drawer: value, formula, inputs, assumptions, source and limitations for any metric. */
export function EvidenceSheet({ open, onClose, title, metricKey, engine }: { open: boolean; onClose: () => void; title: string; metricKey: string; engine: EngineResult }) {
  const { t, reviews } = useApp();
  const r = findResult(engine, metricKey);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {r && (
        <div className="space-y-4">
          <Badge kind="ANALYSIS" />
          <section>
            <h3 className="text-sm font-semibold text-muted">{t("evidence.value")}</h3>
            {typeof r.value === "number" ? (
              <p className="num text-3xl font-bold">{formatValue(r.value, r.unit)}</p>
            ) : (
              <dl className="mt-1 grid grid-cols-2 gap-2">
                {Object.entries(r.value).map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-primary-soft p-2">
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="num font-semibold">{formatValue(v, (r.subUnits?.[k] ?? r.unit) as Unit)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
          <section>
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted">
              <Calculator size={14} aria-hidden /> {t("evidence.formula")}
            </h3>
            <code className="mt-1 block rounded-xl bg-primary-soft p-3 text-sm leading-relaxed">{r.formula}</code>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-muted">{t("evidence.inputs")}</h3>
            <ul className="mt-1 divide-y divide-line rounded-xl border border-line text-sm">
              {Object.entries(r.inputs).map(([k, v]) => (
                <li key={k} className="flex justify-between gap-3 px-3 py-2">
                  <span className="text-muted">{k}</span>
                  <span className="num font-medium">{fmtInput(v)}</span>
                </li>
              ))}
            </ul>
          </section>
          {r.assumptions.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted">{t("evidence.assumptions")}</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {r.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}
          {r.assumptionIds.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-muted">{t("assump.evidence")}</h3>
              <ul className="mt-1 space-y-1 text-sm">
                {r.assumptionIds.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-primary-soft px-3 py-1.5">
                    <a href={`/assumptions#${id}`} className="font-mono text-xs underline">{id}</a>
                    <span className={assumption(id).notModelled ? "text-muted" : statusOf(id, reviews) === "reviewed" ? "font-semibold text-reviewed" : "font-semibold text-draft"}>
                      {assumption(id).notModelled ? t("assump.notModelled") : statusOf(id, reviews) === "reviewed" ? t("assump.reviewed") : t("assump.unverified")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-sm">
            <span className="font-semibold">{t("evidence.source")}: </span>
            {t("evidence.sourceValue")}
          </p>
          <p className="rounded-xl bg-draft-soft p-3 text-sm text-draft">{t("evidence.limits")}</p>
        </div>
      )}
    </Sheet>
  );
}
