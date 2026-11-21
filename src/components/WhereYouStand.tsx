"use client";
import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cannotText, ConfidenceChip } from "@/components/Quality";
import { UnverifiedTag } from "@/components/UnverifiedTag";
import type { Quality } from "@/lib/quality";
import { EvidenceSheet } from "@/components/EvidenceSheet";
import { ScoreRing } from "@/components/dash";
import { Card } from "@/components/ui";
import { CONSTANTS as C } from "@/config/constants";
import { formatValue, inr, inrSigned } from "@/lib/format";
import { useApp } from "@/store/AppProvider";
import type { EngineResult, UserProfile } from "@/types";

type Status = "look" | "check" | "ok";

/**
 * "Where you stand": the separate checks, each with its own number and a text status. This replaces a single
 * headline score. The composite sits behind "About this summary", never without the metrics beside it.
 */
export function WhereYouStand({ profile, engine, summary, quality }: { profile: UserProfile; engine: EngineResult; summary?: string; quality?: Quality }) {
  const { t } = useApp();
  const f = engine.flat;
  const sev = (ids: string[]): Status => {
    const hit = engine.flags.filter((x) => ids.includes(x.id));
    return hit.some((x) => x.severity === "high") ? "look" : hit.length ? "check" : "ok";
  };
  const rows: { id: string; label: string; value: string; target: string; status: Status; q?: Quality["metrics"][keyof Quality["metrics"]] }[] = [];
  rows.push({ id: "cash", label: t("card.cash"), value: inrSigned(f["cash.surplus"]), target: t("bench.cash"), status: sev(["cash_shortfall", "cash_tight"]) });
  rows.push(
    { id: "ef", label: t("card.ef"), value: `${formatValue(f["ef.months"], "months")} ${t("unit.months")}`, target: t("stand.target", { v: `${formatValue(f["ef.target"], "months")} ${t("unit.months")}` }), status: sev(["ef_low"]) },
  );
  // a savings rate says nothing useful when the month does not add up (the cash-flow row says it); it must still say "cannot" when income is missing
  const cashBlocked = engine.ladder.steps.find((x) => x.id === "cash_flow")?.status === "blocked";
  if (profile.monthlyIncome <= 0 || !cashBlocked) rows.push({ id: "savings", label: t("card.savings"), value: formatValue(f["save.rate"], "percent"), target: t("stand.target", { v: "20%" }), status: sev(["savings_low"]) });
  if (profile.debts.length || f["debt.dti"] > 0) rows.push({ id: "debt", label: t("card.debt"), value: formatValue(f["debt.dti"], "percent"), target: t("stand.under", { v: `${C.dtiHighPct}%` }), status: sev(["high_cost_debt", "dti_high"]) });
  if (f["ins.term.needed"] > 0) rows.push({ id: "term", label: t("card.term"), value: inr(f["ins.term.cover"]), target: t("stand.target", { v: inr(f["ins.term.needed"]) }), status: sev(["term_gap"]) });
  rows.push({ id: "health", label: t("card.health"), value: inr(f["ins.health.cover"]), target: t("stand.target", { v: inr(f["ins.health.needed"]) }), status: sev(["health_gap"]) });
  if (profile.holdings.length) rows.push({ id: "portfolio", label: t("card.portfolio"), value: formatValue(f["conc.topSector"], "percent"), target: t("stand.under", { v: "40%" }), status: sev(["concentration", "overlap_high"]) });

  // a confidence label per row (the row id is the metric id, except the loans row)
  for (const r of rows) r.q = quality?.metrics[r.id === "debt" ? "debt" : (r.id as keyof Quality["metrics"])];
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState(false);
  const ICON = { look: TriangleAlert, check: CircleHelp, ok: CircleCheck } as const;
  const TONE = { look: "bg-draft-soft text-draft", check: "bg-info-soft text-info", ok: "bg-reviewed-soft text-reviewed" } as const;

  return (
    <Card data-testid="where-you-stand">
      <h2 className="mb-1 text-lg font-bold">{t("stand.title")}</h2>
      <p className="mb-3 text-sm text-muted">{t("stand.sub")}</p>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const Icon = ICON[r.status];
          return (
            <li key={r.id}>
              <a href={`#${r.id}`} className="flex min-h-14 items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.label}</span>
                  <span className="block text-xs text-muted">{r.q?.cannot ? cannotText(t, r.q) : r.target}</span>
                </span>
                <span className="num text-right font-bold">{r.q?.cannot ? "—" : r.value}</span>
                <span className={`inline-flex w-24 items-center justify-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${r.q?.cannot ? TONE.check : TONE[r.status]}`}>
                  <Icon size={12} aria-hidden /> {t(`stand.s.${r.q?.cannot ? "check" : r.status}`)}
                </span>
              </a>
              {r.q && !r.q.cannot && <ConfidenceChip q={r.q} className="mb-2 ml-0" />}
            </li>
          );
        })}
      </ul>

      <details className="mt-3 rounded-xl bg-primary-soft p-3" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-primary">{t("stand.about")}</summary>
        <div className="mt-2 flex items-center gap-4">
          <ScoreRing score={f["health.score"]} />
          <div className="min-w-0 text-sm">
            <p>{t("stand.aboutBody")}</p>
            {summary && <p className="mt-1">{summary}</p>}
            <UnverifiedTag ids={["score.w_emergency", "score.w_insurance", "score.w_debt", "score.w_savings", "score.w_diversification"]} className="mt-2" />
            <button type="button" onClick={() => setWhy(true)} className="mt-1 block min-h-11 font-semibold text-primary">
              {t("evidence.how")}
            </button>
          </div>
        </div>
        <EvidenceSheet open={why} onClose={() => setWhy(false)} title={t("home.score")} metricKey="health.score" engine={engine} />
      </details>
    </Card>
  );
}
