"use client";
import { Activity, Banknote, HeartPulse, Landmark, LineChart, PiggyBank, Target, Umbrella, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MetricCard } from "@/components/dash";
import { EvidenceSheet } from "@/components/EvidenceSheet";
import { Chip, Crumb, MainSide, Meter, PageHead, Stat, useDocTitle } from "@/components/ds";
import { ImproveAccuracy } from "@/components/ImproveAccuracy";
import { fixFirstKey, ladderParams } from "@/components/LadderCard";
import { CORE_STEPS, OPTIONAL_STEPS } from "@/components/IntakeInput";
import { DataQualityCard, useQuality } from "@/components/Quality";
import { SourceTag } from "@/components/SourceTag";
import { UnverifiedTag } from "@/components/UnverifiedTag";
import { WhereYouStand } from "@/components/WhereYouStand";
import { Btn, Card, LinkBtn, StickyAction } from "@/components/ui";
import { CONSTANTS as C } from "@/config/constants";
import type { Findings } from "@/lib/ai/schemas";
import { formatValue, inr, inrSigned } from "@/lib/format";
import { useAI, useEngine, useNudges } from "@/lib/hooks";
import { planHref } from "@/lib/nav";
import { usePrefs } from "@/lib/prefs";
import { api } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { EngineResult, LadderStep } from "@/types";

type Sev = "high" | "medium" | null;
const RANK = { high: 0, medium: 1, none: 2 } as const;
const LOCALE = { en: "en-IN", hi: "hi-IN", ta: "ta-IN" } as const;

/** What the lime block says: the first step on the priority ladder, with the figures behind it. */
function heroFor(lead: LadderStep | undefined, e: EngineResult, t: (k: string, v?: Record<string, string | number>) => string) {
  const f = e.flat;
  switch (lead?.id) {
    case "liquidity":
      return {
        big: `${formatValue(f["ef.months"], "months")} ${t("unit.months")}`,
        note: t("dash.hero.ef", { target: formatValue(f["ef.target"], "months") }),
        second: f["ef.gap"] > 0 ? { v: inr(f["ef.gap"]), n: t("dash.hero.gap") } : null,
        progress: f["ef.target"] ? f["ef.months"] / f["ef.target"] : 0,
      };
    case "cash_flow":
      return { big: inrSigned(f["cash.surplus"]), note: t("dash.hero.cash"), second: null, progress: null };
    case "debt":
      return { big: formatValue(f["debt.dti"], "percent"), note: t("dash.hero.debt"), second: null, progress: f["debt.dti"] / C.dtiHighPct };
    case "protection":
      return {
        big: inr(f["ins.term.cover"]),
        note: t("dash.hero.cover", { needed: inr(f["ins.term.needed"]) }),
        second: f["ins.term.gap"] > 0 ? { v: inr(f["ins.term.gap"]), n: t("dash.hero.gap") } : null,
        progress: f["ins.term.needed"] ? f["ins.term.cover"] / f["ins.term.needed"] : 1,
      };
    default:
      return { big: null, note: t("dash.hero.clear"), second: null, progress: null };
  }
}

/** The last word of a headline gets the dark highlight ("... first"). */
function Headline({ text }: { text: string }) {
  const i = text.lastIndexOf(" ");
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)} <span className="hl-dark">{text.slice(i + 1)}</span>
    </>
  );
}

const MIX_COLORS = ["#171717", "#43000B", "#A9A1E8", "#77746A", "#9CC2F5"];

export default function Dashboard() {
  const { state, t, lang } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const prefs = usePrefs();
  const profile = state?.profile ?? null;
  const engine = useEngine(profile);
  const quality = useQuality(profile, engine);
  // The first view is short; every measure is one tap away ("See all measures").
  const [showAll, setShowAll] = useState(false);
  const [why, setWhy] = useState<null | "lead" | "score" | "rate">(null);
  const [openActions, setOpenActions] = useState<number | null>(null);
  useDocTitle(t("nav2.home"));

  useEffect(() => {
    if (state && !state.profile) router.replace("/");
  }, [state, router]);

  const find = useAI<Findings>(profile ? { task: "explainFindings", language: lang, profile } : null, `${lang}|${JSON.stringify(profile)}`);
  const nudges = useNudges(profile, engine, lang);
  const c = wf.myCase ?? undefined;

  // the number of open steps in the action center (server-held), shown on its card
  const customer = wf.loaded && wf.role === "customer" && !!profile;
  useEffect(() => {
    if (!customer) return;
    let live = true;
    const id = window.setTimeout(() => {
      api<{ actions: { active: boolean; status: string }[] }>("GET", "me/actions").then((r) => {
        if (live && r.ok && r.data) setOpenActions(r.data.actions.filter((a) => a.active && (a.status === "suggested" || a.status === "planned")).length);
      });
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [customer, profile]);

  const cards = useMemo(() => {
    if (!profile || !engine) return [];
    const f = engine.flat;
    const sev = (ids: string[]): Sev => {
      const hit = engine.flags.filter((x) => ids.includes(x.id));
      return hit.some((x) => x.severity === "high") ? "high" : hit.length ? "medium" : null;
    };
    const list: { id: string; sev: Sev; node: (text?: string, loading?: boolean) => ReactNode; title: string }[] = [];
    const add = (id: string, title: string, s: Sev, node: (text?: string, loading?: boolean) => ReactNode) => list.push({ id, title, sev: s, node });

    const cashBlocked = engine.ladder.steps.find((x) => x.id === "cash_flow")?.status === "blocked";
    // always shown: with income missing it is the card that says "Cannot calculate reliably"
    add("cash", t("card.cash"), sev(["cash_shortfall", "cash_tight"]), (text, loading) => (
      <MetricCard id="cash" icon={<Banknote size={20} />} title={t("card.cash")} value={inrSigned(f["cash.surplus"])} bench={t("bench.cash")} text={text} loading={loading} engine={engine} metricKey="cash" severity={sev(["cash_shortfall", "cash_tight"])} quality={quality?.metrics.cash} />
    ));
    if (!profile.incomeStable || profile.incomeMonths) {
      const src = profile.incomeMonths?.history?.length ? "history" : profile.incomeMonths ? "entered" : "default";
      add("income", t("card.inc"), sev(["bad_month_stress"]), () => (
        <MetricCard id="income" icon={<Activity size={20} />} title={t("card.inc")} value={f["inc.badDrain"] > 0 ? t("inc.lasts", { months: formatValue(f["inc.survivableMonths"], "months") }) : t("inc.covered")} bench={t("inc.bench", { bad: inr(f["inc.bad"]) })} text={t(`inc.src.${src}`)} engine={engine} metricKey="inc" severity={sev(["bad_month_stress"])} quality={quality?.metrics.ef} />
      ));
    }
    add("ef", t("card.ef"), sev(["ef_low"]), (text, loading) => (
      <MetricCard id="ef" icon={<PiggyBank size={20} />} title={t("card.ef")} value={`${formatValue(f["ef.months"], "months")} ${t("unit.months")}`} bench={t("bench.ef", { target: formatValue(f["ef.target"], "months") })} progress={f["ef.months"] / f["ef.target"]} text={text} loading={loading} engine={engine} metricKey="ef.months" severity={sev(["ef_low"])} quality={quality?.metrics.ef} />
    ));
    add("term", t("card.term"), sev(["term_gap"]), (text, loading) => (
      <MetricCard id="term" icon={<Umbrella size={20} />} title={t("card.term")} value={inr(f["ins.term.cover"])} bench={f["ins.term.needed"] ? t("bench.cover", { needed: inr(f["ins.term.needed"]) }) : t("bench.noDependents")} progress={f["ins.term.needed"] ? f["ins.term.cover"] / f["ins.term.needed"] : 1} text={text} loading={loading} engine={engine} metricKey="ins.term" severity={sev(["term_gap"])} quality={quality?.metrics.term} />
    ));
    add("health", t("card.health"), sev(["health_gap"]), (text, loading) => (
      <MetricCard id="health" icon={<HeartPulse size={20} />} title={t("card.health")} value={inr(f["ins.health.cover"])} bench={t("bench.cover", { needed: inr(f["ins.health.needed"]) })} progress={f["ins.health.needed"] ? f["ins.health.cover"] / f["ins.health.needed"] : 1} text={text} loading={loading} engine={engine} metricKey="ins.health" severity={sev(["health_gap"])} quality={quality?.metrics.health} />
    ));
    add("debt", t("card.debt"), sev(["high_cost_debt", "dti_high"]), (text, loading) => (
      <MetricCard id="debt" icon={<Landmark size={20} />} title={t("card.debt")} value={formatValue(f["debt.dti"], "percent")} bench={t("bench.dti", { max: C.dtiHighPct })} progress={f["debt.dti"] / C.dtiHighPct} text={text} loading={loading} engine={engine} metricKey="debt.dti" severity={sev(["high_cost_debt", "dti_high"])} quality={quality?.metrics.debt} />
    ));
    if (f["tradeoff.loanRate"] !== undefined) {
      add("tradeoff", t("card.tradeoff"), null, () => (
        <MetricCard id="tradeoff" icon={<Landmark size={20} />} title={t("card.tradeoff")} value={formatValue(f["tradeoff.loanRate"], "percent")} bench={t("bench.tradeoff")} text={t("tradeoff.text", { loan: formatValue(f["tradeoff.loanRate"], "percent"), low: formatValue(f["tradeoff.returnLow"], "percent"), high: formatValue(f["tradeoff.returnHigh"], "percent") })} engine={engine} metricKey="tradeoff" />
      ));
    }
    // a savings rate is meaningless when the month does not add up (the cash-flow card says it), but it must still
    // say "cannot calculate" when income is missing
    if (profile.monthlyIncome <= 0 || !cashBlocked) {
      add("savings", t("card.savings"), sev(["savings_low"]), (text, loading) => (
        <MetricCard id="savings" icon={<Wallet size={20} />} title={t("card.savings")} value={formatValue(f["save.rate"], "percent")} bench={t("bench.savings", { monthly: inr(f["save.monthly"]) })} progress={f["save.rate"] / 20} text={text} loading={loading} engine={engine} metricKey="save" severity={sev(["savings_low"])} quality={quality?.metrics.savings} />
      ));
    }
    profile.goals.forEach((g, i) => {
      // while a step on the ladder is blocked, a goal is shown as "later": no monthly amount, no range
      if (engine.ladder.goalsLater) {
        add(`goal-${g.id}`, t(`goal.${g.kind}`), null, () => (
          <MetricCard key={g.id} id={`goal-${g.id}`} icon={<Target size={20} />} title={`${t(`goal.${g.kind}`)} · ${t("card.goal")}`} value={t("ladder.later")} bench={t("bench.goal", { amount: inr(g.targetAmount), years: g.years })} text={t("ladder.goalLaterNote", { step: t(`ladder.step.${engine.ladder.firstBlocker ?? "cash_flow"}`) })} engine={engine} metricKey="ladder" quality={quality?.metrics.goal} />
        ));
        return;
      }
      add(`goal-${g.id}`, t(`goal.${g.kind}`), null, (text, loading) => (
        <MetricCard key={g.id} id={`goal-${g.id}`} icon={<Target size={20} />} title={`${t(`goal.${g.kind}`)} · ${t("card.goal")}`} value={`${inr(f[`goal.${g.id}.sip.high`])} – ${inr(f[`goal.${g.id}.sip.low`])}`} bench={t("bench.goal", { amount: inr(g.targetAmount), years: g.years })} text={i === 0 ? text : t("bench.goalRange")} loading={i === 0 && loading} engine={engine} metricKey={`goal.${g.id}.sip`} quality={quality?.metrics.goal} />
      ));
    });
    if (profile.holdings.length) {
      add("portfolio", t("card.portfolio"), sev(["concentration", "overlap_high"]), (text, loading) => (
        <MetricCard id="portfolio" icon={<LineChart size={20} />} title={t("card.portfolio")} value={formatValue(f["conc.topSector"], "percent")} bench={f["conc.overlap"] > 0 ? t("bench.portfolio", { overlap: formatValue(f["conc.overlap"], "percent") }) : t("bench.portfolioSector")} progress={f["conc.topSector"] / 100} text={text} loading={loading} engine={engine} metricKey="conc" severity={sev(["concentration", "overlap_high"])} quality={quality?.metrics.portfolio} />
      ));
    }
    return list.map((x, idx) => ({ ...x, idx })).sort((a, b) => RANK[a.sev ?? "none"] - RANK[b.sev ?? "none"] || a.idx - b.idx);
  }, [profile, engine, quality, t]);

  if (!state || !profile || !engine) return null;
  const f = engine.flat;
  const F = find.data?.findings;
  const textFor = (id: string) => (id === "cash" ? F?.cash : id === "ef" ? F?.ef : id === "term" ? F?.term : id === "health" ? F?.health : id === "debt" ? F?.debt : id === "savings" ? F?.savings : id === "portfolio" ? F?.portfolio : F?.goals);

  const L = engine.ladder;
  const lead = L.steps.find((s) => s.id === (L.firstBlocker ?? L.firstOpen));
  const leadBlocked = lead?.status === "blocked";
  const hero = heroFor(lead, engine, t);
  const heroTitle = lead ? (leadBlocked ? t(fixFirstKey(lead.id, lead.reason)) : `${t("ladder.current")}: ${t(`ladder.step.${lead.id}`)}`) : t("ladder.allClear");
  const flagged = engine.flags.filter((x) => x.severity !== "low").slice(0, 3);
  const nPriority = Math.max(1, engine.flags.filter((x) => x.severity !== "low").length);

  // overall confidence is the lowest of the metric confidences; the unverified assumptions behind the page are counted once each
  const levels = quality ? Object.values(quality.metrics).map((m) => m.level) : [];
  const overall = levels.includes("low") ? "low" : levels.includes("medium") ? "medium" : "high";
  const unverified = quality ? new Set(Object.values(quality.metrics).flatMap((m) => m.unverified)).size : 0;
  const answered = CORE_STEPS.length + (state.extras?.length ?? 0);
  const answeredTotal = CORE_STEPS.length + OPTIONAL_STEPS.length;
  const today = new Date().toLocaleDateString(LOCALE[lang], { day: "2-digit", month: "2-digit", year: "numeric" });

  const summaryKey = engine.flags.some((x) => x.severity === "high") ? "attention" : engine.flags.some((x) => x.severity === "medium") ? "watch" : "ok";
  const request = () => router.push("/confirm");
  const cashCannot = quality?.metrics.cash.cannot;
  const spend = f["cash.essential"] + f["cash.other"] + f["cash.emi"];

  const byClass = Object.entries(profile.holdings.reduce<Record<string, number>>((m, h) => ({ ...m, [h.assetClass]: (m[h.assetClass] ?? 0) + h.amount }), {}));
  const mixTotal = byClass.reduce((a, [, v]) => a + v, 0);

  const planStatus = c ? (
    <>
      <Chip tone={c.status === "APPROVED" ? "ok" : c.status === "CHANGES_REQUESTED" ? "info" : "warn"}>{t(`status.s.${c.status}`)}</Chip>
      <p className="mt-3 text-sm text-muted">{t(c.status === "APPROVED" ? "status.reviewed" : c.status === "CHANGES_REQUESTED" ? "status.questionBody" : "status.waiting")}</p>
      <LinkBtn href={planHref(c)} variant="lime" block className="mt-4">
        {t("dash.rail.view")}
      </LinkBtn>
    </>
  ) : (
    <>
      <Chip tone="neu">{t("dash.rail.notreq")}</Chip>
      <p className="mt-3 text-sm text-muted">{t("dash.rail.statusBody")}</p>
      <Btn variant="lime" block className="mt-4 max-md:hidden" onClick={request}>
        {t("status.cta")}
      </Btn>
    </>
  );

  return (
    <div className="ac-wrap pb-32 md:pb-10">
      <Crumb items={[{ label: t("nav2.home"), href: "/dashboard" }, { label: "Dashboard" }]} />
      <PageHead
        title={t("home.hi", { name: profile.name })}
        sub={t("dash.sub", { n: answered, total: answeredTotal, date: today })}
        actions={
          <>
            {quality && <Chip tone="neu">{t("conf.label", { level: t(`conf.${overall}`) })}</Chip>}
            {unverified > 0 && <Chip tone="warn">{t("dash.unverified", { n: unverified })}</Chip>}
            <a href="#data-quality" className="ac-btn ac-btn-secondary ac-btn-sm">
              {t("improve.title")}
            </a>
          </>
        }
      />

      {quality && quality.issues.some((i) => i.kind !== "default") && (
        <div className="mt-5">
          <DataQualityCard quality={quality} hideDefaults />
        </div>
      )}

      <div data-testid="home-first">
      <MainSide
        className="mt-6"
        main={
          <>
            {/* 1 · the first thing to fix, with its figures and one primary action: the only lime block on the page */}
            <Card tone="lime" className="!p-9 max-md:!p-6" data-testid="ladder" data-blocker={L.firstBlocker ?? ""} aria-labelledby="lead-h">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="t-label !text-[#2d3a00]">{t("dash.startHere", { n: nPriority })}</span>
                <Chip tone="ink">ANALYSIS</Chip>
              </div>
              <h2 id="lead-h" className="t-h1 mt-3" data-testid="ladder-lead">
                <Headline text={heroTitle} />
              </h2>
              {hero.big ? (
                <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-3">
                  <Stat value={hero.big} note={hero.note} size={64} />
                  {hero.second && <Stat value={hero.second.v} note={hero.second.n} size={36} />}
                </div>
              ) : (
                <p className="mt-3 text-base">{hero.note}</p>
              )}
              {lead && <p className="mt-3 text-sm">{t(`ladder.r.${lead.id}.${lead.reason}`, ladderParams(lead, engine))}</p>}
              {hero.progress !== null && <Meter value={hero.progress} tone="lime" className="mt-4 !h-3" label={heroTitle} />}
              <UnverifiedTag ids={[...new Set(L.steps.flatMap((s) => s.assumptionIds))]} className="mt-3" />
              {/* opened with "See all measures": the whole ladder, in order, each step with its status in words */}
              {showAll && (
                <ol className="mt-4 divide-y divide-[#a8d400] border-t border-[#a8d400] text-sm" aria-label={t("ladder.title")}>
                  {L.steps.map((s, i) => (
                    <li key={s.id} data-step={s.id} data-status={s.status} className="flex items-center gap-3 py-2">
                      <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-char text-xs text-lime" aria-hidden>{i + 1}</span>
                      <span className="min-w-0 flex-1 font-semibold">{t(`ladder.step.${s.id}`)}</span>
                      <Chip tone="ink">{t(`ladder.status.${s.status}`)}</Chip>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                {c ? (
                  <LinkBtn href={planHref(c)}>{t("dash.rail.view")}</LinkBtn>
                ) : (
                  <Btn onClick={request}>{t("status.cta")}</Btn>
                )}
                {lead?.metricKeys[0] && (
                  <Btn variant="secondary" onClick={() => setWhy("lead")}>
                    {t("evidence.how")}
                  </Btn>
                )}
              </div>
            </Card>

            {/* 2 · the summary, the savings rate and loans: three plain cards, none of them a prediction */}
            <div className="grid gap-5 md:grid-cols-3">
              <Card className="!p-6">
                <div className="flex items-start justify-between gap-2">
                  <span className="t-label">{t("dash.sum.title")}</span>
                  <Chip tone="neui">ANALYSIS</Chip>
                </div>
                <div className="num mt-3 text-[clamp(1.5rem,3vw,2.375rem)] leading-[1.1]">{t(`dash.sum.${summaryKey}`)}</div>
                <p className="mt-2 text-sm text-muted">{t("dash.sum.body", { score: f["health.score"] })}</p>
                <button type="button" onClick={() => setWhy("score")} className="und mt-2 min-h-11 text-sm font-semibold">
                  {t("dash.sum.method")}
                </button>
              </Card>
              <Card className="!p-6">
                <div className="flex items-start justify-between gap-2">
                  <span className="t-label">{t("card.savings")}</span>
                  <Chip tone="neui">ANALYSIS</Chip>
                </div>
                {quality?.metrics.savings.cannot ? (
                  <>
                    <div className="num mt-3 text-2xl">{t("dash.debt.none")}</div>
                    <Chip tone="warn" className="mt-3">{t("dash.missing")}</Chip>
                  </>
                ) : (
                  <>
                    <div className="num mt-3 text-[clamp(1.75rem,3.2vw,2.375rem)] leading-none">{formatValue(f["save.rate"], "percent")}</div>
                    <p className="mt-1 text-sm text-muted">{t("dash.rate.about", { amt: inr(f["save.monthly"]) })}</p>
                    <Meter value={f["save.rate"] / 100} className="mt-3" label={t("card.savings")} />
                    <button type="button" onClick={() => setWhy("rate")} className="und mt-2 min-h-11 text-sm font-semibold">
                      {t("dash.formula")}
                    </button>
                  </>
                )}
              </Card>
              <Card className="!p-6">
                <div className="flex items-start justify-between gap-2">
                  <span className="t-label">{t("card.debt")}</span>
                  <Chip tone="neui">ANALYSIS</Chip>
                </div>
                {profile.debts.length ? (
                  <>
                    <div className="num mt-3 text-[clamp(1.75rem,3.2vw,2.375rem)] leading-none">{formatValue(f["debt.dti"], "percent")}</div>
                    <p className="mt-1 text-sm text-muted">{t("bench.dti", { max: C.dtiHighPct })}</p>
                    <Meter value={f["debt.dti"] / C.dtiHighPct} className="mt-3" label={t("card.debt")} />
                  </>
                ) : (
                  <>
                    <div className="num mt-3 text-2xl">{t("dash.debt.none")}</div>
                    <p className="mt-1 text-sm text-muted">{t("dash.debt.add")}</p>
                    <Chip tone="warn" className="mt-3">{t("dash.missing")}</Chip>
                  </>
                )}
              </Card>
            </div>

            {/* 3 · income against spending: the table is the source of truth for screen readers and small screens */}
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="t-h3">{t("dash.cash.title")}</h2>
                <span className="text-xs text-muted">{t("dash.cash.sub")}</span>
              </div>
              {cashCannot ? (
                <p className="mt-4 text-sm font-semibold text-draft">{t("conf.cannot", { what: t("dq.field.monthlyIncome") })}</p>
              ) : (
                <div className="mt-5 grid items-start gap-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                  <div className="flex flex-col gap-3" aria-hidden>
                    <div>
                      <div className="mb-1 flex justify-between text-xs"><span>{t("dash.cash.income")}</span><b className="num">{inr(f["cash.income"])}</b></div>
                      <div className="h-7 rounded-md bg-char" style={{ width: "100%" }} />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs"><span>{t("dash.cash.spending")}</span><b className="num">{inr(spend)}</b></div>
                      <div className="h-7 rounded-md bg-lav" style={{ width: `${f["cash.income"] > 0 ? Math.min(100, Math.round((spend / f["cash.income"]) * 100)) : 0}%` }} />
                    </div>
                  </div>
                  <div className="ac-scrollx">
                    <table className="ac-tbl">
                      <caption className="sr-only">{t("dash.cash.title")}</caption>
                      <thead>
                        <tr><th scope="col">{t("dash.cash.item")}</th><th scope="col" className="text-right">{t("dash.cash.amount")}</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>{t("dash.cash.income")}</td><td className="num text-right">{inr(f["cash.income"])}</td></tr>
                        <tr><td>{t("dash.cash.essential")}</td><td className="num text-right">{inr(f["cash.essential"])}</td></tr>
                        <tr><td>{t("dash.cash.other")}</td><td className="num text-right">{inr(f["cash.other"])}</td></tr>
                        <tr><td>{t("dash.cash.emi")}</td><td className="num text-right">{inr(f["cash.emi"])}</td></tr>
                        <tr><th scope="row" className="!text-fg">{t("dash.cash.left")}</th><td className="num text-right font-bold">{inrSigned(f["cash.surplus"])}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {prefs.hints && !cashCannot && <p className="sr-only">{t("dash.cash.income")} {inr(f["cash.income"])}, {t("dash.cash.spending")} {inr(spend)}, {t("dash.cash.left")} {inrSigned(f["cash.surplus"])}.</p>}
            </Card>

            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="t-h3">{t("dash.ins.title")}</h2>
                  <Chip tone="neui">ANALYSIS</Chip>
                </div>
                <div className="mt-4 flex flex-col gap-4">
                  <div>
                    <div className="flex flex-wrap justify-between gap-x-3 text-sm"><span>{t("dash.ins.health")}</span><b className="num">{t("dash.ins.of", { cover: inr(f["ins.health.cover"]), needed: inr(f["ins.health.needed"]) })}</b></div>
                    <Meter value={f["ins.health.needed"] ? f["ins.health.cover"] / f["ins.health.needed"] : 1} className="mt-2" label={t("dash.ins.health")} />
                    <p className="mt-2 text-xs text-muted">{t("dash.ins.start")}</p>
                  </div>
                  <div>
                    {f["ins.term.needed"] > 0 ? (
                      <>
                        <div className="flex flex-wrap justify-between gap-x-3 text-sm"><span>{t("dash.ins.term")}</span><b className="num">{t("dash.ins.of", { cover: inr(f["ins.term.cover"]), needed: inr(f["ins.term.needed"]) })}</b></div>
                        <Meter value={f["ins.term.cover"] / f["ins.term.needed"]} className="mt-2" label={t("dash.ins.term")} />
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap justify-between gap-x-3 text-sm"><span>{t("dash.ins.term")}</span><b>{t("dash.ins.noterm")}</b></div>
                        <p className="mt-2 text-xs text-muted">{t("dash.ins.noterm.note")}</p>
                      </>
                    )}
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="t-h3">{t("dash.mix.title")}</h2>
                  <Chip tone="neui">ANALYSIS</Chip>
                </div>
                {byClass.length ? (
                  <>
                    <div className="mt-4 flex h-6 overflow-hidden rounded-full" aria-hidden>
                      {byClass.map(([k, v], i) => (
                        <i key={k} style={{ width: `${(v / mixTotal) * 100}%`, background: MIX_COLORS[i % MIX_COLORS.length] }} />
                      ))}
                    </div>
                    <div className="ac-scrollx mt-3">
                      <table className="ac-tbl">
                        <thead>
                          <tr><th scope="col">{t("dash.mix.class")}</th><th scope="col" className="text-right">{t("dash.mix.amount")}</th><th scope="col" className="text-right">{t("dash.mix.share")}</th></tr>
                        </thead>
                        <tbody>
                          {byClass.map(([k, v], i) => (
                            <tr key={k}>
                              <td><span className="mr-2 inline-block size-3 rounded-sm align-middle" style={{ background: MIX_COLORS[i % MIX_COLORS.length] }} aria-hidden />{t(`class.${k}`)}</td>
                              <td className="num text-right">{inr(v)}</td>
                              <td className="num text-right">{Math.round((v / mixTotal) * 100)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-xs text-muted">{t("dash.mix.note", { pct: formatValue(f["conc.topSector"], "percent").replace("%", "") })}</p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-muted">{t("dash.mix.none")}</p>
                )}
              </Card>
            </div>
          </>
        }
        side={
          <>
            <Card tone="dark" small className="!p-6">
              <h2 className="t-h4">{t("dash.rail.status")}</h2>
              <div className="mt-3">{planStatus}</div>
            </Card>
            <ImproveAccuracy profile={profile} />
            <Card className="!p-6">
              <h2 className="t-h4">{t("dash.prio.title")}</h2>
              {flagged.length ? (
                <ol className="mt-3 flex flex-col gap-3 text-sm">
                  {flagged.map((x, i) => (
                    <li key={x.id} className="flex items-start gap-2.5">
                      <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-char text-xs text-lime" aria-hidden>{i + 1}</span>
                      <span>{t(`eflag.${x.id}`)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-muted">{t("home.noGaps")}</p>
              )}
              <button type="button" aria-expanded={showAll} data-testid={showAll ? "show-fewer" : "see-all"} onClick={() => setShowAll((s) => !s)} className="und mt-3 min-h-11 text-sm font-semibold">
                {showAll ? t("dash.prio.hide") : t("dash.prio.all", { n: cards.length })}
              </button>
            </Card>
            <Card tone="lav" small className="!p-6">
              <h2 className="t-h4">{t("dash.src.title")}</h2>
              <p className="mt-2 text-sm">{t("dash.src.body")}</p>
              <div className="mt-3 flex flex-wrap gap-x-4">
                <Link href="/sources" className="und min-h-11 text-sm">{t("footer.sources")}</Link>
                <Link href="/transparency" className="und min-h-11 text-sm">{t("nav2.earn")}</Link>
              </div>
            </Card>
            <Card tone="dark" small className="!p-6">
              <div className="flex items-center justify-between gap-2">
                <b>{t("dash.act.title")}</b>
                {openActions !== null && <Chip tone="neu">{t("dash.act.open", { n: openActions })}</Chip>}
              </div>
              {nudges.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
                  {nudges.slice(0, 2).map((n) => (
                    <li key={n.ruleId}>• {n.text}</li>
                  ))}
                </ul>
              )}
              <LinkBtn href="/actions" variant="secondary" small className="mt-3">
                {t("dash.act.openBtn")}
              </LinkBtn>
              <p className="mt-4 text-sm text-muted">{t("dash.act.fall")}</p>
              <LinkBtn href="/guardrail/market-fall" variant="secondary" small className="mt-2">
                {t("dash.act.fallBtn")}
              </LinkBtn>
            </Card>
          </>
        }
      />

      </div>

      {/* every measure, with the AI-written plain-language findings and the full "where you stand" table */}
      {showAll && (
        <section aria-labelledby="all-h" className="mt-8" data-testid="all-measures">
          <h2 id="all-h" className="t-h2">{t("dash.all.title")}</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0 lg:col-span-2 xl:col-span-1">
              <WhereYouStand profile={profile} engine={engine} summary={F?.score} quality={quality ?? undefined} />
            </div>
            {cards.map((x) => (
              <div key={x.id} className="min-w-0">{x.node(textFor(x.id) ?? undefined, find.loading)}</div>
            ))}
          </div>
          <SourceTag source={find.source} className="mt-3" />
        </section>
      )}

      {lead?.metricKeys[0] && <EvidenceSheet open={why === "lead"} onClose={() => setWhy(null)} title={heroTitle} metricKey={lead.metricKeys[0]} engine={engine} />}
      <EvidenceSheet open={why === "score"} onClose={() => setWhy(null)} title={t("dash.sum.title")} metricKey="health.score" engine={engine} />
      <EvidenceSheet open={why === "rate"} onClose={() => setWhy(null)} title={t("card.savings")} metricKey="save" engine={engine} />

      {!c && (
        <StickyAction>
          <Btn variant="lime" block onClick={request}>
            {t("status.cta")}
          </Btn>
        </StickyAction>
      )}
    </div>
  );
}
