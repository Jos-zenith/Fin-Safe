"use client";
import { Calculator, Hourglass } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { flattenResults, goalFeasibility, NO_LADDER, runEngine, scenarioParams } from "@/lib/engine";
import { corpusAt, costOfDelay, exploreGoal, roundTo } from "@/lib/engine/explore";
import { compactInr, inr } from "@/lib/format";
import { useApp } from "@/store/AppProvider";
import type { EngineResult, UserProfile } from "@/types";
import { Badge } from "./Badge";
import { EvidenceSheet } from "./EvidenceSheet";
import { Card } from "./ui";
import { UnverifiedTag } from "./UnverifiedTag";

/** "What if...?" Drag a monthly amount, see a RANGE of outcomes and the cost of waiting. Engine figures only. */
export function GoalExplorer({ profile }: { profile: UserProfile }) {
  const { t } = useApp();
  const goals = profile.goals;
  const [gid, setGid] = useState(goals[0]?.id ?? "");
  const g = goals.find((x) => x.id === gid) ?? goals[0];
  const rates = useMemo(() => (g ? (goalFeasibility(g).value as Record<string, number>) : null), [g]);
  const [monthly, setMonthly] = useState(() => (rates ? Math.ceil(rates.base / 500) * 500 : 0));
  const [late, setLate] = useState(false);
  const [open, setOpen] = useState(false);
  const alt = useId();
  const ladder = useMemo(() => runEngine(profile).ladder, [profile]);
  if (!g || !rates) return null;

  // A monthly amount is not a sensible action while an earlier step on the ladder is blocked: no slider, no range.
  if (ladder.goalsLater) {
    const blocker = ladder.firstBlocker ?? "cash_flow";
    const blockerStep = ladder.steps.find((x) => x.id === blocker);
    return (
      <Card data-testid="goal-explorer-later" className="border-2 border-draft/60">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-draft">
            <Hourglass size={20} aria-hidden /> {t(blockerStep?.reason.startsWith("no_") ? "ladder.fixFirst.inputs" : `ladder.fixFirst.${blocker === "goals" ? "cash_flow" : blocker}`)}
          </h2>
          <Badge kind="ANALYSIS" />
        </div>
        <p className="text-sm">{t("ladder.fixFirst.body")}</p>
        <p className="mt-2 text-sm text-muted">{t("ladder.goalLaterNote", { step: t(`ladder.step.${blocker}`) })}</p>
      </Card>
    );
  }

  const max = Math.max(5000, roundTo(rates.low * 2, 500));
  const m = Math.min(monthly, max);
  const r = exploreGoal(g, m);
  const v = r.value as Record<string, number>;
  const delay = costOfDelay(g, 1, "base");
  const net = { low: scenarioParams("low").netReturnPct, base: scenarioParams("base").netReturnPct, high: scenarioParams("high").netReturnPct };
  const laterEnd = corpusAt(g, m, g.years, net.base, 1);
  const engine: EngineResult = { results: [r], ...flattenResults([r]), flags: [], ladder: NO_LADDER };

  const data = Array.from({ length: g.years + 1 }, (_, y) => ({
    year: y,
    low: Math.round(corpusAt(g, m, y, net.low)),
    base: Math.round(corpusAt(g, m, y, net.base)),
    high: Math.round(corpusAt(g, m, y, net.high)),
    late: Math.round(corpusAt(g, m, y, net.base, 1)),
  }));

  const pick = (id: string) => {
    const next = goals.find((x) => x.id === id);
    setGid(id);
    if (next) setMonthly(Math.ceil((goalFeasibility(next).value as Record<string, number>).base / 500) * 500);
  };

  return (
    <Card>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Hourglass size={20} className="text-primary" aria-hidden /> {t("explore.title")}
          </h2>
          <p className="text-sm text-muted">{t("explore.sub")}</p>
        </div>
        <Badge kind="ANALYSIS" />
      </div>

      <UnverifiedTag ids={r.assumptionIds} className="mt-1" />

      {goals.length > 1 && (
        <div className="my-2 flex flex-wrap gap-2" role="group" aria-label={t("explore.goal")}>
          {goals.map((x) => (
            <button key={x.id} type="button" aria-pressed={x.id === g.id} onClick={() => pick(x.id)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${x.id === g.id ? "border-primary bg-primary-soft text-primary" : "border-line"}`}>
              {t(`goal.${x.kind}`)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-2xl bg-primary-soft p-3">
        <label htmlFor={`${alt}-s`} className="flex items-baseline justify-between text-sm font-semibold">
          <span>{t("explore.monthly")}</span>
          <span className="num text-2xl font-bold text-primary">{inr(m)}</span>
        </label>
        <input
          id={`${alt}-s`}
          type="range"
          min={0}
          max={max}
          step={500}
          value={m}
          onChange={(e) => setMonthly(Number(e.target.value))}
          aria-valuetext={`${inr(m)}`}
          className="mt-2 h-8 w-full accent-[var(--primary)]"
        />
        <div className="num flex justify-between text-xs text-muted">
          <span>{inr(0)}</span>
          <span>{inr(max)}</span>
        </div>
      </div>

      <div className="mt-3 h-56" role="img" aria-labelledby={alt}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} />
            <YAxis tickFormatter={(n: number) => compactInr(n)} width={64} tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(n) => inr(Number(n))} labelFormatter={(y) => `${y} ${t("common.years")}`} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} />
            <ReferenceLine y={v.target} stroke="var(--fg)" strokeDasharray="6 4" label={{ value: t("explore.goalLine"), fill: "var(--fg)", fontSize: 12, position: "insideTopLeft" }} />
            <Line type="monotone" dataKey="low" name={t("explore.low")} stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="base" name={t("explore.mid")} stroke="var(--primary)" strokeWidth={3.5} dot={false} />
            <Line type="monotone" dataKey="high" name={t("explore.high")} stroke="var(--info)" strokeWidth={2} dot={false} />
            {late && <Line type="monotone" dataKey="late" name={t("explore.late")} stroke="var(--draft)" strokeWidth={2.5} strokeDasharray="2 3" dot={false} />}
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div id={alt} className="mt-2 space-y-1">
        <p className="font-semibold">{t("explore.result", { years: g.years, low: inr(v.low), high: inr(v.high) })}</p>
        <p className="num text-sm text-muted">
          {t("explore.base", { base: inr(v.base) })} · {t("explore.target", { target: inr(v.target) })}
        </p>
        <p className="num text-sm text-muted">{t("explore.todayLine", { today: inr(v.today), todayValue: inr(v.baseInTodaysMoney) })}</p>
        {(g.savedSoFar ?? 0) > 0 && <p className="num text-sm text-muted">{t("explore.saved", { saved: inr(g.savedSoFar ?? 0) })}</p>}
        <p className={`text-sm font-medium ${v.shortfallBase <= 0.5 ? "text-primary" : "text-draft"}`}>
          {v.shortfallBase <= 0.5 ? t("explore.meets") : t("explore.short", { gap: inr(v.shortfallBase) })}
        </p>
        <p className="sr-only">{t("explore.alt", { years: g.years })}</p>
        <p className="text-xs text-muted">{t("explore.taxNote")}</p>
      </div>

      <label className="mt-3 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
        <input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} className="mt-1 size-5 accent-[var(--primary)]" />
        <span className="text-sm font-medium">{t("explore.delayToggle")}</span>
      </label>
      {late && delay && (
        <div className="mt-2 space-y-1 rounded-xl bg-draft-soft p-3 text-sm" role="status">
          <p className="num font-medium">{t("explore.delayResult", { now: inr(v.base), later: inr(laterEnd) })}</p>
          <p>{t("explore.delayCost", { extra: inr(delay.extra) })}</p>
        </div>
      )}

      <button type="button" onClick={() => setOpen(true)} className="mt-2 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary">
        <Calculator size={16} aria-hidden /> {t("evidence.how")}
      </button>
      <EvidenceSheet open={open} onClose={() => setOpen(false)} title={t("explore.title")} metricKey={`explore.${g.id}`} engine={engine} />
    </Card>
  );
}
