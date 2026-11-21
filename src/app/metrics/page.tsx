"use client";
import { ArrowLeft, BarChart3, Calculator, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Btn, Card, Page } from "@/components/ui";
import { DEFAULT_INPUTS, unitEconomics, type UnitInputs } from "@/lib/unitEconomics";
import { api } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { MetricsSummary } from "@/server/metrics";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const mins = (x: number | null) => (x === null ? "—" : `${x}`);
/** A figure over fewer than five events means nothing, and the page says so instead of showing a tidy number. */
const SMALL = 5;

interface DigestView {
  current: { digest: string; chains: number; entries: number; date: string };
  latestExport: { file: string; date: string; digest: string; check: { ok: boolean; mismatched: string[]; missing: string[] } } | null;
}

/** The audit-chain digest: today's value, and an export to a local file. An export, not an anchor (the text says so). */
function DigestCard() {
  const { t } = useApp();
  const [d, setD] = useState<DigestView | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => api<DigestView>("GET", "audit/digest").then((r) => r.data && setD(r.data));
  useEffect(() => {
    void load();
  }, []);
  const exportNow = async () => {
    const r = await api<{ file: string; created: boolean }>("POST", "audit/digest/export", {});
    if (r.data) setMsg(r.data.created ? t("met.digest.exported", { file: r.data.file }) : t("met.digest.exists", { file: r.data.file }));
    await load();
  };
  const last = d?.latestExport;
  const state = !last ? "" : last.check.mismatched.length ? t("met.digest.mismatch") : last.check.missing.length ? t("met.digest.missing") : t("met.digest.ok");
  return (
    <Card className="mt-4" data-testid="audit-digest">
      <h2 className="font-semibold">{t("met.digest.title")}</h2>
      <p className="mb-2 text-xs text-muted">{t("met.digest.body")}</p>
      {d && (
        <>
          <p className="break-all font-mono text-xs" data-testid="digest-value">
            {t("met.digest.value", { d: d.current.digest })}
          </p>
          <p className="num text-xs text-muted">{t("met.digest.counts", { c: d.current.chains, e: d.current.entries })}</p>
          {last && <p className="mt-1 text-xs" data-testid="digest-last">{t("met.digest.last", { date: last.date, state })}</p>}
        </>
      )}
      <Btn variant="secondary" className="mt-2 min-h-11 px-3 text-sm" onClick={() => void exportNow()}>
        {t("met.digest.export")}
      </Btn>
      {msg && (
        <p role="status" className="mt-1 text-xs text-muted">
          {msg}
        </p>
      )}
    </Card>
  );
}

export default function Metrics() {
  const { t, lang } = useApp();
  const wf = useWorkflow();
  const [m, setM] = useState<MetricsSummary | null>(null);

  useEffect(() => {
    if (wf.role !== "adviser") return;
    let live = true;
    api<MetricsSummary>("GET", "metrics").then((r) => live && r.data && setM(r.data));
    return () => {
      live = false;
    };
  }, [wf.role, wf.queue.length]);

  if (!wf.loaded) return null;
  if (wf.role !== "adviser") {
    return (
      <Page size="md">
        <Card className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden>
            <Lock size={26} />
          </span>
          <h1 className="mt-2 text-xl font-bold">{t("met.gateTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{t("met.gateBody")}</p>
          <Btn block className="mt-4" onClick={() => void wf.signIn("adviser", lang)}>
            {t("adv.gateCta")}
          </Btn>
        </Card>
      </Page>
    );
  }

  const stat = (label: string, value: string, n: number, hint: string) => (
    <Card>
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="num mt-1 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted">
        {t("met.n", { n })} {n < SMALL && <span className="font-semibold text-draft">{t("met.tooFew")}</span>}
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </Card>
  );

  return (
    <Page size="xl">
      <Link href="/adviser" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft size={16} aria-hidden /> {t("adv.queue")}
      </Link>
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold">
        <BarChart3 size={26} className="text-primary" aria-hidden /> {t("met.title")}
      </h1>
      <p role="note" data-testid="metrics-banner" className="mb-4 rounded-2xl border-2 border-draft bg-draft-soft p-3 font-bold text-draft">
        {t("met.banner")}
      </p>
      <p className="mb-4 text-sm text-muted">{t("met.sub")}</p>

      {!m ? (
        <p className="text-muted">…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="metrics-grid">
            {stat(t("met.reviewTime"), `${mins(m.review.medianMinutes)} ${t("met.min")}`, m.review.n, t("met.reviewTimeHint"))}
            {stat(t("met.firstPlan"), `${mins(m.firstReviewedPlan.medianMinutes)} ${t("met.min")}`, m.firstReviewedPlan.n, t("met.firstPlanHint"))}
            {stat(t("met.wait"), `${mins(m.waitBeforeReview.medianMinutes)} ${t("met.min")}`, m.waitBeforeReview.n, t("met.waitHint"))}
            {stat(t("met.corrected"), pct(m.draftsNeedingCorrection.share), m.draftsNeedingCorrection.n, t("met.correctedHint"))}
            {stat(t("met.liveShare"), pct(m.source.liveShare), m.source.n, t("met.liveShareHint", { live: m.source.live, template: m.source.template, fallback: m.source.fallback }))}
            {stat(t("met.overdue"), String(m.overdueCases), m.casesSubmitted, t("met.overdueHint"))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {stat(t("metrics.dwell"), m.itemDwell.medianSeconds === null ? "—" : t("metrics.dwellValue", { s: m.itemDwell.medianSeconds, n: m.itemDwell.n }), m.itemDwell.n, "")}
            {stat(t("metrics.accepted"), t("metrics.acceptedValue", { a: m.acceptance.accepted, b: m.acceptance.approved, e: m.acceptance.errorsReported }), m.acceptance.approved, "")}
          </div>
          <DigestCard />
          <Card className="mt-4" data-testid="generation-timing">
            <h2 className="font-semibold">{t("met.timing.title")}</h2>
            <p className="mb-2 text-xs text-muted">{t("met.timing.hint")}</p>
            {m.generation.length === 0 ? (
              <p className="text-sm text-muted">{t("met.none")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1">{t("met.topic")}</th>
                    <th className="py-1 text-right">{t("met.decisions")}</th>
                    <th className="py-1 text-right">median ms</th>
                    <th className="py-1 text-right">max ms</th>
                  </tr>
                </thead>
                <tbody>
                  {m.generation.map((g) => (
                    <tr key={g.task} className="border-t border-line">
                      <td className="py-1 font-mono text-xs">{g.task}</td>
                      <td className="num py-1 text-right">{g.n}</td>
                      <td className="num py-1 text-right">{g.medianMs ?? "—"}</td>
                      <td className="num py-1 text-right">{g.maxMs ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-xs text-muted">{t("met.timing.retries", { r: m.generationRetries, f: m.generationFailures })}</p>
          </Card>
          {(() => {
            const flagged = m.rubberStamp.advisers.filter((a) => a.flagged);
            const rule = { rule: pct(m.rubberStamp.rule.approvalRate), minutes: m.rubberStamp.rule.medianMinutes, min: m.rubberStamp.rule.minDecisions };
            return flagged.length ? (
              <div role="alert" data-testid="rubber-stamp-warning" className="mt-4 rounded-2xl border-2 border-draft bg-draft-soft p-3 text-draft">
                <p className="font-bold">{t("metrics.rubber.title")}</p>
                {flagged.map((a) => (
                  <p key={a.label} className="mt-1 text-sm">
                    {a.label}: {t("metrics.rubber.body", { rate: pct(a.approvalRate), median: mins(a.medianMinutes), n: a.decisions, ...rule })}
                  </p>
                ))}
              </div>
            ) : (
              <p data-testid="rubber-stamp-ok" className="mt-4 rounded-2xl bg-primary-soft p-3 text-sm text-muted">
                {t("metrics.rubber.ok", rule)}
              </p>
            );
          })()}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-2 font-semibold">{t("met.editRate")}</h2>
              <p className="mb-2 text-xs text-muted">{t("met.editRateHint")}</p>
              {m.editRateByTopic.length === 0 ? (
                <p className="text-sm text-muted">{t("met.none")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1">{t("met.topic")}</th>
                      <th className="py-1 text-right">{t("met.decisions")}</th>
                      <th className="py-1 text-right">{t("met.editRateCol")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.editRateByTopic.map((r) => (
                      <tr key={r.topic} className="border-t border-line">
                        <td className="py-1.5">{r.topic}</td>
                        <td className="num py-1.5 text-right">{r.decisions}</td>
                        <td className="num py-1.5 text-right font-semibold">{pct(r.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card>
              <h2 className="mb-2 font-semibold">{t("met.rejection")}</h2>
              <p className="mb-2 text-xs text-muted">{t("met.rejectionHint")}</p>
              {m.validationRejection.filter((r) => r.liveRequests > 0).length === 0 ? (
                <p className="text-sm" data-testid="no-live">{t("met.noLive")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="py-1">{t("met.task")}</th>
                      <th className="py-1 text-right">{t("met.live")}</th>
                      <th className="py-1 text-right">{t("met.rejected")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.validationRejection
                      .filter((r) => r.liveRequests > 0)
                      .map((r) => (
                        <tr key={r.task} className="border-t border-line">
                          <td className="py-1.5">{r.task}</td>
                          <td className="num py-1.5 text-right">{r.liveRequests}</td>
                          <td className="num py-1.5 text-right font-semibold">{pct(r.rate)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}

      <UnitEconomics />
    </Page>
  );
}

/** Illustrative unit economics. Editable. The defaults are made-up numbers. */
function UnitEconomics() {
  const { t } = useApp();
  const [i, setI] = useState<UnitInputs>(DEFAULT_INPUTS);
  const o = useMemo(() => unitEconomics(i), [i]);
  const FIELDS: [keyof UnitInputs, string, string][] = [
    ["adviserCostPerHour", "ue.cost", "₹"],
    ["minutesPerReview", "ue.minutes", ""],
    ["reworkPercent", "ue.rework", "%"],
    ["reworkMinutes", "ue.reworkMin", ""],
    ["aiCostPerPlan", "ue.ai", "₹"],
    ["plansPerClientPerYear", "ue.plans", ""],
    ["pricePerClientPerYear", "ue.price", "₹"],
    ["otherCostPerClientPerYear", "ue.other", "₹"],
    ["reviewHoursPerDay", "ue.hours", ""],
  ];
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  return (
    <section className="mt-8" aria-labelledby="ue-h" data-testid="unit-economics">
      <h2 id="ue-h" className="mb-1 flex items-center gap-2 text-xl font-bold">
        <Calculator size={22} className="text-primary" aria-hidden /> {t("ue.title")}
      </h2>
      <p role="note" className="mb-3 rounded-xl bg-draft-soft p-3 text-sm font-semibold text-draft">
        {t("ue.banner")}
      </p>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(([k, label, unit]) => (
              <label key={k} className="block text-sm font-medium">
                {t(label)}
                <span className="mt-1 flex items-center gap-1">
                  {unit === "₹" && <span aria-hidden>₹</span>}
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={i[k]}
                    onChange={(e) => setI((x) => ({ ...x, [k]: Math.max(0, Number(e.target.value) || 0) }))}
                    className="min-h-11 w-full rounded-xl border border-line bg-bg px-3"
                  />
                  {unit === "%" && <span aria-hidden>%</span>}
                </span>
              </label>
            ))}
          </div>
          <Btn variant="secondary" className="mt-3" onClick={() => setI(DEFAULT_INPUTS)}>
            {t("ue.reset")}
          </Btn>
        </Card>
        <Card aria-live="polite">
          <dl className="space-y-2 text-sm">
            {(
              [
                ["ue.o.minutes", `${o.expectedMinutesPerPlan.toFixed(1)} ${t("met.min")}`],
                ["ue.o.costPlan", inr(o.costPerReviewedPlan)],
                ["ue.o.plansDay", o.plansPerAdviserDay.toFixed(1)],
                ["ue.o.costClient", inr(o.costPerClientPerYear)],
                ["ue.o.margin", `${inr(o.marginPerClientPerYear)}${o.marginPercent === null ? "" : ` (${o.marginPercent.toFixed(0)}%)`}`],
                ["ue.o.clients", String(Math.round(o.clientsPerAdviser))],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
                <dt className="text-muted">{t(k)}</dt>
                <dd className="num font-bold" data-testid={k}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">{t("ue.how")}</p>
        </Card>
      </div>
    </section>
  );
}
