"use client";
import { Calculator } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { findResult } from "@/lib/engine";
import { formatValue } from "@/lib/format";
import { useApp } from "@/store/AppProvider";
import type { EngineResult, Holding } from "@/types";
import { Badge } from "./Badge";
import { EvidenceSheet } from "./EvidenceSheet";
import { cannotText, ConfidenceChip } from "./Quality";
import { UnverifiedTag } from "./UnverifiedTag";
import type { MetricQuality } from "@/lib/quality";
import { Card, Skeleton } from "./ui";

/** Health-score ring. Teal only: the ring never turns red or green. */
export function ScoreRing({ score }: { score: number }) {
  const { t } = useApp();
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-36 shrink-0" role="img" aria-label={t("home.scoreAria", { score })}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="num text-4xl font-bold leading-none">{score}</p>
          <p className="mt-1 text-xs font-semibold text-muted">{t("home.score")}</p>
        </div>
      </div>
    </div>
  );
}

export function MetricCard({
  id,
  icon,
  title,
  value,
  bench,
  progress,
  text,
  loading,
  engine,
  metricKey,
  severity,
  quality,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  value: ReactNode;
  bench?: string;
  progress?: number;
  text?: string;
  loading?: boolean;
  engine: EngineResult;
  metricKey: string;
  severity?: "high" | "medium" | null;
  quality?: MetricQuality;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <Card id={id} data-testid="metric-card" className="scroll-mt-40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden>
            {icon}
          </span>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <Badge kind="ANALYSIS" />
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-1.5">
        <UnverifiedTag ids={findResult(engine, metricKey)?.assumptionIds ?? []} />
        {quality && <ConfidenceChip q={quality} />}
      </div>
      {quality?.cannot ? (
        <p data-testid="cannot-calculate" className="mt-3 text-lg font-bold text-draft">
          {cannotText(t, quality)}
        </p>
      ) : (
        <p className="num mt-3 text-3xl font-bold">{value}</p>
      )}
      {bench && !quality?.cannot && <p className="text-sm text-muted">{bench}</p>}
      {progress !== undefined && !quality?.cannot && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="presentation">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
        </div>
      )}
      {severity && !quality?.cannot && (
        <p className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${severity === "high" ? "bg-draft-soft text-draft" : "bg-info-soft text-info"}`}>
          {t(severity === "high" ? "home.lookFirst" : "home.worthChecking")}
        </p>
      )}
      <div className="mt-2 min-h-12">{quality?.cannot ? null : loading ? <Skeleton className="h-12" /> : <p>{text}</p>}</div>
      <button type="button" onClick={() => setOpen(true)} className="mt-1 flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary">
        <Calculator size={16} aria-hidden /> {t("evidence.how")}
      </button>
      <EvidenceSheet open={open} onClose={() => setOpen(false)} title={title} metricKey={metricKey} engine={engine} />
    </Card>
  );
}

const SLICE = ["var(--primary)", "var(--info)", "var(--draft)", "var(--muted)", "var(--primary-deep)"];

/** Charts with text alternatives (screen-reader table). */
export function PortfolioChart({ holdings }: { holdings: Holding[] }) {
  const { t } = useApp();
  const id = useId();
  const byClass = Object.entries(
    holdings.reduce<Record<string, number>>((m, h) => ({ ...m, [h.assetClass]: (m[h.assetClass] ?? 0) + h.amount }), {}),
  ).map(([k, v]) => ({ name: t(`class.${k}`), value: v }));
  const total = byClass.reduce((a, b) => a + b.value, 0);
  return (
    <div>
      <div className="h-44" role="img" aria-labelledby={id}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={byClass} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={2} stroke="var(--surface)">
              {byClass.map((_, i) => (
                <Cell key={i} fill={SLICE[i % SLICE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul id={id} className="mt-1 space-y-1 text-sm">
        {byClass.map((s, i) => (
          <li key={s.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: SLICE[i % SLICE.length] }} aria-hidden />
              {s.name}
            </span>
            <span className="num font-medium">{total ? `${Math.round((s.value / total) * 100)}%` : "0%"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EfChart({ months, target }: { months: number; target: number }) {
  const { t } = useApp();
  const id = useId();
  const data = [
    { name: t("chart.you"), v: Math.round(months * 10) / 10 },
    { name: t("chart.target"), v: target },
  ];
  return (
    <div>
      <div className="h-36" role="img" aria-labelledby={id}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" hide domain={[0, Math.max(target, months) * 1.15]} />
            <YAxis type="category" dataKey="name" width={70} tick={{ fill: "var(--fg)", fontSize: 13 }} axisLine={false} tickLine={false} />
            <ReferenceLine x={target} stroke="var(--muted)" strokeDasharray="4 4" />
            <Bar dataKey="v" radius={8} barSize={22}>
              <Cell fill="var(--primary)" />
              <Cell fill="var(--muted)" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p id={id} className="text-sm text-muted">
        {t("chart.efAlt", { months: formatValue(months, "months"), target: formatValue(target, "months") })}
      </p>
    </div>
  );
}
