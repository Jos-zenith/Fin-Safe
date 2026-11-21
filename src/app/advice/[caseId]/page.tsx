"use client";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Ask } from "@/components/Ask";
import { AssetChip } from "@/components/plan";
import { CaseGate } from "@/components/CaseGate";
import { Chip, Crumb, MainSide, PageHead, StatusBanner, Timeline, useDocTitle } from "@/components/ds";
import { EvidenceSheet } from "@/components/EvidenceSheet";
import { GoalExplorer } from "@/components/GoalExplorer";
import { Legal } from "@/components/Legal";
import { SourceTag } from "@/components/SourceTag";
import { UnverifiedTag } from "@/components/UnverifiedTag";
import { DraftWatermark } from "@/components/Watermark";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { assumptionIdsFor, findResult, runEngine } from "@/lib/engine";
import { reviewedItems, statusForUser } from "@/lib/cases";
import { itemInLang, packTextIn } from "@/lib/plan";
import { caseRef } from "@/lib/nav";
import { statusOf } from "@/config/assumptions";
import { inr } from "@/lib/format";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case, EngineResult } from "@/types";
import { fixFirstKey } from "@/components/LadderCard";

const FINDING_ORDER = ["cash", "ef", "term", "health", "debt", "savings", "goals", "portfolio"] as const;
const FINDING_TITLE: Record<(typeof FINDING_ORDER)[number], string> = { cash: "card.cash", ef: "card.ef", term: "card.term", health: "card.health", debt: "card.debt", savings: "card.savings", goals: "card.goal", portfolio: "card.portfolio" };
const VISIBLE = 3;

/**
 * The plan is prepared after the request returns: the findings appear first, then the plan. Nothing is waiting on
 * a spinner alone, and a failure says so and offers "Try again" (nothing is lost).
 */
function Generating({ c }: { c: Case }) {
  const { t } = useApp();
  const wf = useWorkflow();
  const g = c.gen;
  const failed = g?.state === "failed";
  const [busy, setBusy] = useState(false);
  // while it is being prepared, look again every second instead of waiting for the slower background poll
  useEffect(() => {
    if (failed) return;
    const id = setInterval(() => void wf.refresh(), 1000);
    return () => clearInterval(id);
  }, [failed, wf]);
  const findingsDone = !!g?.findings;
  const steps = [
    { key: "findings", done: findingsDone, now: !findingsDone && !failed },
    { key: "plan", done: false, now: findingsDone && !failed },
  ] as const;
  return (
    <div className="ac-wrap max-w-3xl pb-12 pt-6">
      <div role="status" aria-live="polite" data-testid="generating" data-state={g?.state ?? "generating"} data-stage={g?.stage ?? "findings"}>
        <h1 className="t-h1">{t("gen.title")}</h1>
        <p className="mt-2 text-muted">{t("gen.reviewerNote")}</p>
        <ol className="mt-5 flex flex-col gap-3">
          {steps.map((s) => (
            <li key={s.key} data-step={s.key} data-done={s.done} className="s-dark flex items-center gap-3 rounded-2xl border border-[#333] bg-[#242424] p-3.5">
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${s.done ? "bg-[#9ADBB4] text-[#0B3B20]" : s.now ? "bg-[#F2C14E] text-[#3D2A00]" : "border border-[#5a5a5a] text-muted"}`}>
                {s.done ? <Check size={16} aria-hidden /> : s.now ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <span className="size-2 rounded-full bg-muted" />}
              </span>
              <span className="flex-1 font-semibold">{t(`gen.step.${s.key}`)}</span>
              <span className="text-xs font-bold text-muted">{s.done ? t("gen.stepDone") : s.now ? t("gen.stepNow") : t("gen.stepWaiting")}</span>
            </li>
          ))}
        </ol>
        {g?.findings && (
          <Card className="mt-5" data-testid="findings-ready">
            <h2 className="t-h4">{t("gen.findingsReady")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {FINDING_ORDER.filter((k) => g.findings?.[k]).map((k) => (
                <li key={k}>
                  <span className="font-semibold">{t(FINDING_TITLE[k])}: </span>
                  {g.findings?.[k]}
                </li>
              ))}
            </ul>
            <SourceTag source={g.findingsSource} className="mt-3" />
          </Card>
        )}
        {failed && (
          <div role="alert" className="mt-5 rounded-2xl border-2 border-[#F0A3A3] bg-[#2A1A1A] p-4" data-testid="generation-failed">
            <Chip tone="err">{t("err.load.label")}</Chip>
            <p className="mt-2 font-semibold">{t("gen.failed")}</p>
            <Btn
              className="mt-3"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await wf.retryGeneration(c.id);
                setBusy(false);
              }}
            >
              {t("gen.retry")}
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function Draft({ c, engine }: { c: Case; engine: EngineResult }) {
  const { t, lang, reviews } = useApp();
  const wf = useWorkflow();
  const id = encodeURIComponent(c.id);
  const ref = caseRef(c.id);
  const [all, setAll] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  // the ladder of the profile this case was drafted from (the server's copy), not whatever is in the browser now
  const ladder = useMemo(() => runEngine(c.profile).ladder, [c.profile]);
  const text = packTextIn(c, lang);
  const items = useMemo(() => reviewedItems(c), [c]);
  const idx = statusForUser(c.status);
  const f = engine.flat;
  const loc = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
  const created = new Date(c.createdAt).toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" });
  const lead = ladder.steps.find((s) => s.id === (ladder.firstBlocker ?? ladder.firstOpen));
  const sourceText = c.planSource === "provider" ? t("ask.fromLive") : c.planSource === "fixture" ? t("ai.safeText") : t("ask.fromTemplate");
  // the assumptions behind the plan, with whether anyone has reviewed them
  const assumptionIds = useMemo(() => [...new Set(items.flatMap((r) => assumptionIdsFor(engine, r.item.evidenceRefs)))].slice(0, 6), [items, engine]);
  const shown = all ? items : items.slice(0, VISIBLE);
  useDocTitle(t("adv2.title"));

  return (
    <>
      <DraftWatermark />
      {/* a full-width amber banner with a dashed edge: directly under the header on every screen size */}
      <StatusBanner kind="draft" chip={<Chip tone="warn" className="!min-h-[30px]">{t("adv2.banner.chip")}</Chip>} meta={t("adv2.banner.meta", { ref, v: c.planVersion ?? 1, date: created })}>
        <b>{t("adv2.banner.dont")}</b> {t("adv2.banner.body")} {sourceText}
      </StatusBanner>
      <div className="ac-wrap pb-12">
        <Crumb items={[{ label: t("case.crumb"), href: `/case/${id}` }, { label: t("case.ref", { ref }), href: `/case/${id}` }, { label: t("adv2.title") }]} />
        {c.flagged && (
          <p role="status" data-testid="flagged-banner" className="mb-4 rounded-2xl border-2 border-[#E0A800] bg-[#2A2418] p-3 text-sm font-semibold text-[#F3E2B3]">
            {t("plan.flagged")}
          </p>
        )}
        <PageHead
          title={t("adv2.title")}
          sub={t("adv2.sub", { n: items.length })}
          actions={
            <>
              <Chip tone="neu">{lang.toUpperCase()}</Chip>
              <Btn variant="secondary" small data-no-print onClick={() => window.print()}>{t("adv2.print")}</Btn>
            </>
          }
        />

        <MainSide
          className="mt-8"
          main={
            <>
              <Card tone="dark">
                <h2 className="t-h3">{t("adv2.situation")}</h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div><dt className="t-label">{t(c.profile.incomeStable ? "adv2.income.stable" : "adv2.income.irregular")}</dt><dd className="num text-[1.75rem]">{inr(c.profile.monthlyIncome)}</dd></div>
                  <div><dt className="t-label">{t("adv2.essential")}</dt><dd className="num text-[1.75rem]">{inr(c.profile.essentialExpenses)}</dd></div>
                  <div><dt className="t-label">{t("adv2.reserve")}</dt><dd className="num text-[1.75rem]">{`${(f["ef.months"] ?? 0).toFixed(1)} ${t("unit.months")}`}</dd></div>
                </dl>
                {lead && (
                  <p className="mt-4 text-sm text-muted">
                    {t("adv2.why", { step: t(lead.status === "blocked" ? fixFirstKey(lead.id, lead.reason) : `ladder.step.${lead.id}`) })}{" "}
                    <Link href="/dashboard" className="und text-lime">{t("adv2.seeFigures")}</Link>
                  </p>
                )}
                <SourceTag source={c.planSource} className="mt-3" />
                {c.planSource === "fixture" && c.status === "DRAFT_READY" && !c.claimedBy && (
                  <div className="mt-3 rounded-xl bg-[#2e2e2e] p-3" data-testid="fallback-retry">
                    <p className="text-xs">{t("gen.fallbackHint")}</p>
                    <Btn variant="secondary" small className="mt-2" onClick={() => void wf.retryGeneration(c.id)}>
                      {t("gen.retryFallback")}
                    </Btn>
                  </div>
                )}
                {c.gen?.findingsMs !== undefined && c.gen.planMs !== undefined && (
                  <p className="num mt-2 text-xs text-muted" data-testid="gen-took">
                    {t("gen.took", { f: c.gen.findingsMs, p: c.gen.planMs })}
                  </p>
                )}
              </Card>

              <ol className="flex flex-col gap-5" aria-label={t("plan.priorities")}>
                {shown.map((r, i) => {
                  const item = itemInLang(c, r.item, lang);
                  const ref0 = item.evidenceRefs[0];
                  return (
                    <li key={r.item.id}>
                      {/* a dashed amber container with a faint hatch and a DRAFT chip: no item can be mistaken for approved advice */}
                      <article className="s-ivory ac-draft relative rounded-[22px] bg-ivory p-[26px] max-md:p-5" data-testid={`draft-item-${r.item.id}`}>
                        <div className="ac-hatch" aria-hidden />
                        <div className="relative">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="num text-xl">{i + 1}</b>
                              <AssetChip cls={item.assetClass} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Chip tone="warn">DRAFT</Chip>
                              <UnverifiedTag ids={assumptionIdsFor(engine, item.evidenceRefs)} />
                            </div>
                          </div>
                          <h3 className="t-h2 mt-3">{item.title}</h3>
                          <p className="mt-2 text-base leading-relaxed">{item.rationale}</p>
                          {item.rangeNote && (
                            <div className="ac-inner mt-4">
                              <div className="t-label">{t("adv2.range")}</div>
                              <div className="num text-[1.375rem]">{item.rangeNote}</div>
                            </div>
                          )}
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                              <div className="t-label">{t("adv2.whyThis")}</div>
                              <div className="mt-1 text-sm text-muted">{(ref0 && findResult(engine, ref0)?.formula) || "—"}</div>
                              {ref0 && (
                                <button type="button" onClick={() => setWhy(r.item.id)} className="und min-h-11 text-sm font-semibold">
                                  {t("adv2.evidence")}
                                </button>
                              )}
                            </div>
                            <div>
                              <div className="t-label">{t("adv2.risks")}</div>
                              <div className="mt-1 text-sm text-muted">{item.risks}</div>
                            </div>
                          </div>
                        </div>
                      </article>
                      {ref0 && <EvidenceSheet open={why === r.item.id} onClose={() => setWhy(null)} title={item.title} metricKey={ref0} engine={engine} />}
                    </li>
                  );
                })}
              </ol>
              {items.length > VISIBLE && (
                <div className="s-dark ac-card-s ac-bordered bg-[#242424] text-center">
                  <button type="button" aria-expanded={all} onClick={() => setAll((a) => !a)} className="und min-h-11 font-semibold">
                    {all ? t("adv2.less") : t("adv2.more", { n: items.length - VISIBLE })}
                  </button>
                </div>
              )}

              {c.profile.goals.length > 0 && <GoalExplorer key={c.id} profile={c.profile} />}

              <Card>
                <h2 className="t-h3">{t("plan.next")}</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {text.checklist.map((x) => (
                    <li key={x} className="flex gap-2">
                      <ArrowRight size={16} className="mt-1 shrink-0" aria-hidden />
                      {x}
                    </li>
                  ))}
                </ul>
                <Link href={`/case/${id}/audit`} className="und mt-3 inline-flex min-h-11 items-center font-semibold">
                  {t("plan.trail")}
                </Link>
              </Card>

              <p className="text-xs text-muted"><Legal k="demoWorkflow" /></p>
              <Ask />
            </>
          }
          side={
            <>
              {c.status === "CHANGES_REQUESTED" && c.adviserQuestion && (
                <Card tone="lav" small className="!p-6" data-testid="adviser-question">
                  <div className="t-h4">{t("plan.adviserAsks")}</div>
                  <p className="ac-inner mt-2 text-sm">{c.adviserQuestion}</p>
                  <LinkBtn href={`/case/${id}`} small className="mt-3">{t("adv2.reply")}</LinkBtn>
                </Card>
              )}
              <Card tone="lime" small className="!p-6">
                <div className="t-h3">{t("adv2.req.title")}</div>
                <p className="mt-2 text-sm text-muted">{t("adv2.req.body")}</p>
                <LinkBtn href={`/case/${id}`} block className="mt-4">{t("case.view")}</LinkBtn>
                <p className="mt-3 text-xs text-muted">{t("adv2.req.terms")}</p>
              </Card>
              <Card tone="dark" small className="!p-6">
                <div className="t-h4">{t("adv2.status")}</div>
                <Timeline
                  className="mt-4"
                  items={[
                    { key: "1", title: t("adv2.status.1"), state: idx >= 1 ? "done" : "now" },
                    { key: "2", title: t("adv2.status.2"), state: idx >= 2 ? "done" : idx === 1 ? "now" : "todo" },
                    { key: "3", title: t("adv2.status.3"), state: idx >= 4 ? "done" : "todo" },
                  ]}
                />
              </Card>
              {assumptionIds.length > 0 && (
                <Card small className="!p-6">
                  <div className="t-h4">{t("adv2.assump")}</div>
                  <ul className="mt-3 flex flex-col gap-2 text-sm">
                    {assumptionIds.map((a) => {
                      const st = statusOf(a, reviews);
                      return (
                        <li key={a} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 break-all font-mono text-xs">{a}</span>
                          <Chip tone={st === "reviewed" ? "ok" : "warn"} className="!min-h-[22px]">{st === "reviewed" ? t("assump.reviewed") : t("assump.unverified").toUpperCase()}</Chip>
                        </li>
                      );
                    })}
                  </ul>
                  <Link href="/assumptions" className="und mt-3 inline-block min-h-11 text-sm">{t("adv2.assump.why")}</Link>
                </Card>
              )}
              {c.plan.adviserQuestions.length > 0 && (
                <Card tone="lav" small className="!p-6">
                  <div className="t-h4">{t("adv2.q.title")}</div>
                  <ul className="mt-3 flex flex-col gap-2 text-sm">
                    {c.plan.adviserQuestions.slice(0, 3).map((q) => (
                      <li key={q}>• {q}</li>
                    ))}
                  </ul>
                </Card>
              )}
              <Card tone="dark" small className="!p-5">
                <div className="flex flex-wrap gap-x-4">
                  <a href="#ask" className="und min-h-11 text-sm text-lime">{t("adv2.links.ask")}</a>
                  <Link href="/transparency" className="und min-h-11 text-sm text-lime">{t("nav2.earn")}</Link>
                </div>
              </Card>
            </>
          }
        />
      </div>
    </>
  );
}

function Body({ c }: { c: Case }) {
  const router = useRouter();
  const wf = useWorkflow();
  const { state } = useApp();
  const profile = state?.profile ?? c.profile;
  const engine = useMemo(() => runEngine(profile), [profile]);
  useEffect(() => {
    // an approved plan lives on its own page, with its own banner
    if (c.status === "APPROVED") router.replace(`/case/${encodeURIComponent(c.id)}/approved`);
  }, [c.status, c.id, router]);
  void wf;
  if (c.status === "APPROVED") return null;
  if (c.status === "INTAKE_DONE") return <Generating c={c} />;
  return <Draft c={c} engine={engine} />;
}

export default function Advice() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useApp();
  return (
    <CaseGate caseId={decodeURIComponent(caseId)} crumb={t("adv2.title")}>
      {(c) => <Body c={c} />}
    </CaseGate>
  );
}
