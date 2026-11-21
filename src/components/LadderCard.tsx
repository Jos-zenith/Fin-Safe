"use client";
import { CircleCheck, CircleHelp, Hourglass, ListOrdered, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { formatValue, inr } from "@/lib/format";
import { useApp } from "@/store/AppProvider";
import type { EngineResult, LadderStep, LadderStepId } from "@/types";
import { Badge } from "./Badge";
import { EvidenceSheet } from "./EvidenceSheet";
import { UnverifiedTag } from "./UnverifiedTag";
import { Card } from "./ui";

const ICON = { blocked: TriangleAlert, attention: CircleHelp, ok: CircleCheck, later: Hourglass } as const;
const TONE = { blocked: "bg-draft-soft text-draft", attention: "bg-info-soft text-info", ok: "bg-reviewed-soft text-reviewed", later: "bg-line text-muted" } as const;

/** The figures a step's one-line reason cites, formatted by the same function the plan text uses. */
export function ladderParams(step: LadderStep, e: EngineResult): Record<string, string> {
  const f = e.flat;
  switch (step.id) {
    case "cash_flow":
      return { gap: inr(f["cash.shortfall"] ?? 0), surplus: inr(Math.max(0, f["cash.surplus"] ?? 0)) };
    case "liquidity":
      return { months: formatValue(f["ef.months"] ?? 0, "months"), target: formatValue(f["ef.target"] ?? 0, "months") };
    case "debt":
      return {
        rate: formatValue(f["debt.highCost.rate"] ?? 0, "percent"),
        threshold: formatValue(f["debt.highCost.threshold"] ?? 0, "percent"),
        dti: formatValue(f["debt.dti"] ?? 0, "percent"),
        max: formatValue(f["debt.dtiMark"] ?? 0, "percent"),
      };
    case "protection":
      return { cover: inr(f["ins.term.cover"] ?? 0), needed: inr(f["ins.term.needed"] ?? 0) };
    default:
      return {};
  }
}

/** A short "Fix X first" label for the step that is holding goals back. */
export const fixFirstKey = (id: LadderStepId, reason?: string) => (reason?.startsWith("no_") ? "ladder.fixFirst.inputs" : `ladder.fixFirst.${id === "goals" ? "cash_flow" : id}`);

/**
 * The priority ladder: what comes first. The current step leads, goals are shown as "later" while a step is blocked,
 * and nothing here is an instruction to buy, sell or repay a named product.
 */
export function LadderCard({ engine, compact = false, leadOnly = false }: { engine: EngineResult; compact?: boolean; leadOnly?: boolean }) {
  const { t } = useApp();
  const [why, setWhy] = useState<string | null>(null);
  const L = engine.ladder;
  if (!L.steps.length) return null;
  const lead = L.steps.find((s) => s.id === (L.firstBlocker ?? L.firstOpen));
  const leadBlocked = lead?.status === "blocked";
  const ids = [...new Set(L.steps.flatMap((s) => s.assumptionIds))];
  return (
    <Card data-testid="ladder" data-blocker={L.firstBlocker ?? ""} className={leadBlocked ? "border-2 border-draft/60" : ""}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ListOrdered size={20} className="text-primary" aria-hidden /> {t("ladder.title")}
        </h2>
        <Badge kind="ANALYSIS" />
      </div>
      {!compact && <p className="mt-1 text-sm text-muted">{t("ladder.sub")}</p>}
      <UnverifiedTag ids={ids} className="mt-2" />

      {lead ? (
        <div className={`mt-3 rounded-2xl p-3 ${leadBlocked ? "bg-draft-soft" : "bg-info-soft"}`} data-testid="ladder-lead">
          <p className={`text-xl font-bold ${leadBlocked ? "text-draft" : "text-info"}`}>{leadBlocked ? t(fixFirstKey(lead.id, lead.reason)) : `${t("ladder.current")}: ${t(`ladder.step.${lead.id}`)}`}</p>
          <p className="mt-1 text-sm">{t(`ladder.r.${lead.id}.${lead.reason}`, ladderParams(lead, engine))}</p>
        </div>
      ) : (
        <p className="mt-3 rounded-2xl bg-reviewed-soft p-3 font-medium text-reviewed" data-testid="ladder-lead">
          {t("ladder.allClear")}
        </p>
      )}

      {leadOnly && <p className="mt-2 text-xs text-muted">{t("ladder.discuss")}</p>}
      {!leadOnly && <ol className="mt-3 divide-y divide-line">
        {L.steps.map((s, i) => {
          const Icon = ICON[s.status];
          return (
            <li key={s.id} className="flex items-start gap-3 py-2" data-step={s.id} data-status={s.status}>
              <span className="num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-line text-xs font-bold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t(`ladder.step.${s.id}`)}</span>
                {!compact && <span className="block text-sm text-muted">{t(`ladder.r.${s.id}.${s.reason}`, ladderParams(s, engine))}</span>}
                {s.metricKeys[0] && s.status !== "later" && s.id !== "goals" && (
                  <button type="button" onClick={() => setWhy(s.id)} className="min-h-11 text-sm font-semibold text-primary">
                    {t("evidence.how")}
                  </button>
                )}
              </span>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${TONE[s.status]}`}>
                <Icon size={12} aria-hidden /> {t(`ladder.status.${s.status}`)}
              </span>
            </li>
          );
        })}
      </ol>}
      {!leadOnly && <p className="mt-2 text-xs text-muted">{t("ladder.discuss")}</p>}
      {L.steps
        .filter((s) => s.id === why)
        .map((s) => (
          <EvidenceSheet key={s.id} open onClose={() => setWhy(null)} title={t(`ladder.step.${s.id}`)} metricKey={s.metricKeys[0]} engine={engine} />
        ))}
    </Card>
  );
}
