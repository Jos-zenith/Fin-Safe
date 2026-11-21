"use client";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdviserCaseGate } from "@/components/AdviserGate";
import { Chip, Crumb, Meter, PageHead, StatusBanner, useDocTitle } from "@/components/ds";
import { EvidenceSheet } from "@/components/EvidenceSheet";
import { Legal } from "@/components/Legal";
import { AssetChip } from "@/components/plan";
import { RiskCard } from "@/components/RiskCard";
import { Sheet } from "@/components/Sheet";
import { UnverifiedTag } from "@/components/UnverifiedTag";
import { DraftWatermark } from "@/components/Watermark";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { statusOf } from "@/config/assumptions";
import type { ReviewedItem } from "@/lib/cases";
import { assumptionIdsFor, findResult, runEngine } from "@/lib/engine";
import { formatValue, inr } from "@/lib/format";
import { caseRef } from "@/lib/nav";
import { itemInLang } from "@/lib/plan";
import { assessProfile, unconfirmed } from "@/lib/quality";
import { useCaseWork, type ActResult } from "@/lib/useCaseWork";
import { useDwell } from "@/lib/useDwell";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case, EngineResult } from "@/types";

function RefChip({ k, engine }: { k: string; engine: EngineResult }) {
  const [open, setOpen] = useState(false);
  const v = engine.flat[k];
  const has = !!findResult(engine, k);
  if (v === undefined) return null;
  return (
    <>
      <button type="button" disabled={!has} onClick={() => setOpen(true)} className="ac-chip ac-chip-neui min-h-11 gap-1.5 px-3 font-medium">
        <span className="text-[#55524a]">{k}</span> <span className="num">{formatValue(v, engine.units[k])}</span>
      </button>
      {has && <EvidenceSheet open={open} onClose={() => setOpen(false)} title={k} metricKey={k} engine={engine} />}
    </>
  );
}

/** One plan item: the AI's original text (dashed amber) beside the adviser's edit (solid green), a decision, and the evidence. */
function ItemReview({ n, c, r, engine, locked, act }: { n: number; c: Case; r: ReviewedItem; engine: EngineResult; locked: boolean; act: (p: Promise<ActResult>) => Promise<ActResult> }) {
  const { t, lang } = useApp();
  const wf = useWorkflow();
  const item = itemInLang(c, r.item, lang);
  const [mode, setMode] = useState<null | "edit" | "comment">(null);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [dwellRef, takeDwell] = useDwell();
  const shown = r.edited ? r.rationale : item.rationale;
  const seg = (label: string, on: boolean, onClick?: () => void, testid?: string) => (
    <button
      type="button"
      aria-pressed={on}
      disabled={locked || !onClick}
      onClick={onClick}
      data-testid={testid}
      className={`min-h-11 px-3.5 py-1.5 text-xs font-bold ${on ? "bg-char text-lime" : "text-char"} disabled:cursor-default`}
    >
      {label}
    </button>
  );

  return (
    <li ref={dwellRef} data-testid={`item-${r.item.id}`} data-decision={r.decision} className="border-t border-line py-4 first:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <b className="num text-lg">{n}</b>
          <AssetChip cls={item.assetClass} />
          <b className={`text-sm ${r.decision === "rejected" ? "line-through" : ""}`}>{item.title}</b>
          {r.edited && <Chip tone="ok">{t("rv.edited")}</Chip>}
          <span className="sr-only">{t(`dec.${r.decision}`)}</span>
        </div>
        {/* the decision: pending is where every item starts; accept, edit or reject changes it */}
        <div className="inline-flex overflow-hidden rounded-full border-[1.5px] border-char" role="group" aria-label={t("cr.items")}>
          {seg(t("dec.pending"), r.decision === "pending")}
          {seg(t("adv.accept"), r.decision === "accepted", locked ? undefined : () => void act(wf.decide(c.id, r.item.id, "accepted", undefined, takeDwell())), `accept-${r.item.id}`)}
          {seg(t("adv.edit"), r.decision === "edited" || mode === "edit", locked ? undefined : () => { setText(shown); setReason(""); setBlocked(false); setMode("edit"); }, `edit-${r.item.id}`)}
          {seg(t("adv.reject"), r.decision === "rejected", locked ? undefined : () => void act(wf.decide(c.id, r.item.id, "rejected", undefined, takeDwell())), `reject-${r.item.id}`)}
        </div>
      </div>

      {r.edited ? (
        <div className="mt-3 grid gap-3.5 md:grid-cols-2">
          <div className="rounded-2xl border-2 border-dashed border-[#E0A800] bg-[#F3EAD0] p-3.5">
            <Chip tone="warn">{t("cr.orig")}</Chip>
            <p className="mt-2 text-sm">{item.rationale}</p>
          </div>
          <div className="rounded-2xl border-2 border-[#2F8F5B] bg-[#E3EFE6] p-3.5">
            <Chip tone="ok">{t("cr.yours")}</Chip>
            <p className="mt-2 text-sm">{r.rationale}</p>
          </div>
        </div>
      ) : (
        <div className={`mt-3 rounded-2xl p-3.5 ${r.decision === "rejected" ? "border-2 border-[#9a968a] opacity-80" : "border-2 border-dashed border-[#E0A800] bg-[#F3EAD0]"}`}>
          <Chip tone="warn">{t("cr.orig")}</Chip>
          <p className={`mt-2 text-sm ${r.decision === "rejected" ? "line-through" : ""}`}>{shown}</p>
        </div>
      )}
      {item.rangeNote && <p className="mt-2 text-sm font-medium">{item.rangeNote}</p>}
      <p className="mt-2 text-sm text-muted"><b>{t("plan.risks")}: </b>{item.risks}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2" aria-label={t("cr.evidence")}>
        <span className="t-label">{t("cr.evidence")}:</span>
        {item.evidenceRefs.map((k) => <RefChip key={k} k={k} engine={engine} />)}
        <UnverifiedTag ids={assumptionIdsFor(engine, item.evidenceRefs)} />
      </div>
      {r.comment && <p className="ac-inner mt-2 text-sm">{t("adv.comment")}: {r.comment}</p>}

      {!locked && mode === null && (
        <Btn variant="ghost" small className="mt-1 !px-0" onClick={() => { setText(r.comment ?? ""); setMode("comment"); }}>
          <MessageSquare size={16} aria-hidden /> {t("adv.commentBtn")}
        </Btn>
      )}
      {mode && (
        <div className="ac-inner mt-3 space-y-2">
          <label className="text-sm font-semibold" htmlFor={`t-${r.item.id}`}>{mode === "edit" ? t("adv.editLabel") : t("adv.commentLabel")}</label>
          <textarea id={`t-${r.item.id}`} value={text} onChange={(e) => setText(e.target.value.slice(0, 700))} rows={mode === "edit" ? 5 : 2} className="ac-field" />
          {mode === "edit" && (
            <>
              <label className="text-sm font-semibold" htmlFor={`r-${r.item.id}`}>{t("cr.reason")}</label>
              <input id={`r-${r.item.id}`} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} placeholder={t("cr.reason.ph")} className="ac-field !min-h-12" />
            </>
          )}
          {blocked && <p role="alert" className="rounded-xl bg-[#F6E4E1] p-2 text-sm font-medium text-[#8E1B1B]">{t("adv.editBlocked")}</p>}
          <div className="flex flex-wrap gap-2">
            <Btn variant="secondary" small onClick={() => setMode(null)}>{t("common.cancel")}</Btn>
            <Btn
              small
              disabled={!text.trim() || (mode === "edit" && !reason.trim())}
              onClick={() => {
                if (mode === "comment") {
                  void act(wf.decide(c.id, r.item.id, r.decision, text.trim()));
                  setMode(null);
                  return;
                }
                // The server runs the same guardrails on an adviser's edit; a blocked edit is not saved but is audit-logged.
                void wf.edit(c.id, r.item.id, text, lang, takeDwell()).then(async (res) => {
                  const wasBlocked = !!res.data?.blocked;
                  setBlocked(wasBlocked);
                  if (!wasBlocked) {
                    // the reason travels with the edit, as the item's note, so the audit record shows why
                    if (res.ok) await act(wf.decide(c.id, r.item.id, "edited", reason.trim()));
                    setMode(null);
                  }
                });
              }}
            >
              {t("common.save")}
            </Btn>
          </div>
        </div>
      )}
    </li>
  );
}

function Review({ c }: { c: Case }) {
  const { t, lang, reviews } = useApp();
  const wf = useWorkflow();
  const w = useCaseWork(c);
  const engine = useMemo(() => runEngine(c.profile), [c.profile]);
  const quality = useMemo(() => assessProfile(c.profile, engine, { reviews }), [c.profile, engine, reviews]);
  const notConfirmed = useMemo(() => unconfirmed(c.profile), [c.profile]);
  const [ret, setRet] = useState(false);
  const [q, setQ] = useState("");
  const id = encodeURIComponent(c.id);
  const ref = caseRef(c.id);
  const f = engine.flat;
  const loc = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
  const lead = engine.ladder.steps.find((s) => s.id === (engine.ladder.firstBlocker ?? engine.ladder.firstOpen));
  const actioned = w.rows.length - w.pending;
  const levels = Object.values(quality.metrics).map((m) => m.level);
  const overall = levels.includes("low") ? "low" : levels.includes("medium") ? "medium" : "high";
  const assumptionIds = [...new Set(w.rows.flatMap((r) => assumptionIdsFor(engine, r.item.evidenceRefs)))].slice(0, 4);
  const sourceKey = `cr.src.${c.planSource ?? "mock"}`;
  const claim = w.mine ? t("cr.claim.mine") : c.claimedBy ? t("cr.claim.other", { name: c.claimedBy.name }) : t("cr.claim.none");
  useDocTitle(t("cr.title", { ref, name: c.profile.name || t("intake.friend") }));

  const row = "flex items-baseline justify-between gap-3";
  return (
    <>
      {!w.approved && <DraftWatermark />}
      <div className="ac-wrap pb-12">
        <Crumb items={[{ label: t("nav2.cases"), href: "/adviser" }, { label: t("case.ref", { ref }), href: `/adviser/case/${id}` }, { label: t("cr.crumb") }]} />
        {w.heldByOther && <p role="status" className="mb-3 rounded-2xl border-2 border-[#E0A800] bg-[#2A2418] p-3 text-sm font-semibold text-[#F3E2B3]">{t("adv.heldBy", { name: c.claimedBy!.name })}</p>}
        {w.err && <p role="alert" className="mb-3 rounded-2xl border-2 border-[#F0A3A3] bg-[#2A1A1A] p-3 text-sm font-semibold text-[#F0A3A3]">{w.err}</p>}
        {c.flagged && c.flagNote && <p role="alert" data-testid="flagged-note" className="mb-3 rounded-2xl border-2 border-[#E0A800] bg-[#2A2418] p-3 text-sm font-semibold text-[#F3E2B3]">{t("adv.flagged", { note: c.flagNote })}</p>}
        <PageHead
          title={t("cr.title", { ref, name: c.profile.name || t("intake.friend") })}
          sub={t("cr.sub", { v: c.planVersion ?? 1, source: t(sourceKey), claim, date: new Date(c.createdAt).toLocaleString(loc, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) })}
          actions={
            <>
              <LinkBtn href={`/adviser/case/${id}/copilot`} variant="secondary" small>{t("cr.btn.copilot")}</LinkBtn>
              <LinkBtn href={`/adviser/case/${id}/audit`} variant="secondary" small>{t("cr.btn.audit")}</LinkBtn>
              {w.canAct && <Btn variant="secondary" small onClick={() => setRet(true)}>{t("cr.btn.return")}</Btn>}
              <LinkBtn href={`/adviser/case/${id}/approve`} variant="lime" small aria-disabled={!(w.canAct && w.pending === 0)} onClick={(e) => { if (!(w.canAct && w.pending === 0)) e.preventDefault(); }}>
                {t("cr.btn.continue")}
              </LinkBtn>
            </>
          }
        />
        {w.approved && <div className="mt-4"><StatusBanner kind="approved" chip={<Chip tone="ok">✓ {t("status.s.APPROVED")}</Chip>}>{t("adv.approvedMsg")}</StatusBanner></div>}

        <div className="mt-6 grid items-start gap-5 wd:grid-cols-[320px_minmax(0,1fr)_300px]">
          {/* left: the facts the adviser needs without leaving the page, including what the client never confirmed */}
          <aside className="flex min-w-0 flex-col gap-4">
            <Card tone="dark" small className="!p-6">
              <h2 className="t-h4">{t("cr.summary")}</h2>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <div className={row}><span className="text-muted">{t("cr.income")}</span><b className="num">{inr(c.profile.monthlyIncome)} · {t(c.profile.incomeStable ? "intake.income.stable" : "intake.income.irregular")}</b></div>
                <div className={row}><span className="text-muted">{t("cr.essential")}</span><b className="num">{inr(c.profile.essentialExpenses)}</b></div>
                <div className={row}><span className="text-muted">{t("cr.reserve")}</span><b className="num">{t("cr.reserve.of", { have: formatValue(f["ef.months"], "months"), target: formatValue(f["ef.target"], "months") })}</b></div>
                <div className={row}><span className="text-muted">{t("cr.blocker")}</span><b>{lead ? t(`ladder.step.${lead.id}`) : "—"}</b></div>
                <div className={row}><span className="text-muted">{t("cr.lang")}</span><b>{c.profile.language.toUpperCase()}</b></div>
              </div>
              <details className="mt-3" data-testid="adviser-score">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-lime">{t("stand.about")}</summary>
                <p className="num text-sm font-semibold">{t("snap.score")}: {f["health.score"]}</p>
                <p className="text-xs text-muted">{t("snap.scoreNote")}</p>
                <UnverifiedTag ids={["score.w_emergency", "score.w_insurance", "score.w_debt", "score.w_savings", "score.w_diversification"]} className="mt-1" />
              </details>
              {c.userReply && <p className="mt-2 rounded-xl bg-[#2e2e2e] p-2 text-sm"><b>{t("adv.clientReply")}: </b>{c.userReply}</p>}
            </Card>
            <Card tone="dark" small className="!p-6" data-testid="dq-card">
              <h2 className="t-h4">{t("cr.dq")}</h2>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <div className={row}><span>{t("cr.dq.conf")}</span><Chip tone={overall === "high" ? "ok" : overall === "medium" ? "warn" : "err"}>{t(`conf.${overall}`)}</Chip></div>
                <div className={row}><span>{t("cr.dq.unconf")}</span><b>{t("cr.dq.fields", { n: notConfirmed.length })}</b></div>
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                {quality.issues.filter((i) => i.kind !== "default").map((i) => <li key={i.code}>• {t(`dq.issue.${i.code}`, { fields: i.fields.map((x) => t(`dq.field.${x}`)).join(", ") })}</li>)}
              </ul>
              <p data-testid="confirmation-status" className="mt-2 text-xs text-muted">
                {c.profile.confirmed === undefined ? t("adv.noConfirmation") : notConfirmed.length ? t("adv.notConfirmed", { fields: notConfirmed.map((x) => t(`dq.field.${x}`)).join(", ") }) : t("adv.allConfirmed")}
              </p>
            </Card>
            {assumptionIds.length > 0 && (
              <Card tone="dark" small className="!p-6">
                <h2 className="t-h4">{t("cr.assump")}</h2>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {assumptionIds.map((a) => {
                    const s = statusOf(a, reviews);
                    return <li key={a} className="flex items-center justify-between gap-2"><span className="min-w-0 break-all font-mono text-xs">{a}</span><Chip tone={s === "reviewed" ? "ok" : "warn"} className="!min-h-[22px]">{s === "reviewed" ? t("assump.reviewed") : t("assump.unverified").toUpperCase()}</Chip></li>;
                  })}
                </ul>
                <Link href="/assumptions" className="und mt-3 inline-block min-h-11 text-sm text-lime">{t("cr.assump.review")}</Link>
              </Card>
            )}
            <Card tone="lav" small className="!p-6">
              <h2 className="t-h4">{t("cr.suit")}</h2>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                <li>• {c.risk?.confirmedAt ? t("cr.suit.riskYes") : t("cr.suit.riskNo")}</li>
                <li>• {t(c.profile.incomeStable ? "cr.suit.stable" : "cr.suit.irregular", { n: c.profile.dependents })}</li>
                {c.profile.risk.followsTips && <li>• {t("cr.suit.tips")}</li>}
              </ul>
            </Card>
            <RiskCard c={c} />
          </aside>

          {/* the main column: every item, with the original AI text beside the adviser's edit */}
          <div className="flex min-w-0 flex-col gap-5">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="t-h3">{t("cr.items")}</h2>
                <Chip tone="warn" data-testid="actioned">{t("cr.actioned", { n: actioned, total: w.rows.length })}</Chip>
              </div>
              <p className="mt-2 text-sm text-muted">{t("cr.items.sub")}</p>
              <ol className="mt-3">
                {w.rows.map((r, i) => (
                  <ItemReview key={r.item.id} n={i + 1} c={c} r={r} engine={engine} locked={w.approved || !w.canAct} act={w.act} />
                ))}
              </ol>
            </Card>
            <p className="text-xs text-muted"><Legal k="demoWorkflow" /></p>
          </div>

          <aside className="flex min-w-0 flex-col gap-4 wd:sticky wd:top-28">
            <Card tone="lime" small className="!p-6">
              <h2 className="t-h3">{t("cr.ready")}</h2>
              <p className="mt-2 text-sm text-muted">{w.pending > 0 ? t("cr.ready.open", { n: w.pending }) : t("cr.ready.done")}</p>
              <Meter value={w.rows.length ? actioned / w.rows.length : 0} tone="lime" className="mt-3" label={t("cr.actioned", { n: actioned, total: w.rows.length })} />
              <p className="mt-2 text-xs text-muted">{t("cr.actioned", { n: actioned, total: w.rows.length })}</p>
              <LinkBtn href={`/adviser/case/${id}/approve`} block className="mt-4" aria-disabled={!(w.canAct && w.pending === 0)} onClick={(e) => { if (!(w.canAct && w.pending === 0)) e.preventDefault(); }} data-testid="continue-approval">
                {t("cr.btn.continue")}
              </LinkBtn>
              <p className="mt-2 text-xs text-muted">{t("cr.cta.hint")}</p>
            </Card>
            <Card tone="dark" small className="!p-6">
              <h2 className="t-h4">{t("cr.other")}</h2>
              <div className="mt-3 flex flex-col gap-2">
                {w.canAct && <Btn variant="secondary" small block onClick={() => setRet(true)}>{t("cr.btn.return")}</Btn>}
                <LinkBtn href={`/adviser/case/${id}/copilot`} variant="secondary" small block>{t("cr.btn.copilot")}</LinkBtn>
                <LinkBtn href={`/adviser/case/${id}/audit`} variant="secondary" small block>{t("cr.btn.audit")}</LinkBtn>
              </div>
            </Card>
            <Card tone="dark" small className="!border-lav !p-6">
              <h2 className="t-h4">{t("cr.locked")}</h2>
              <p className="mt-2 text-sm text-muted">{w.approved ? t("cr.locked.approved") : t("cr.locked.body")}</p>
            </Card>
          </aside>
        </div>
      </div>

      <Sheet open={ret} onClose={() => setRet(false)} title={t("adv.return")}>
        <label className="block text-sm font-semibold" htmlFor="ret-q">{t("adv.returnQ")}</label>
        <textarea id="ret-q" value={q} onChange={(e) => setQ(e.target.value.slice(0, 300))} rows={3} className="ac-field mt-1" />
        <Btn
          block
          className="mt-3"
          disabled={!q.trim()}
          onClick={() => {
            void w.act(wf.returnForInfo(c.id, q.trim()));
            setQ("");
            setRet(false);
          }}
        >
          {t("adv.returnSend")}
        </Btn>
      </Sheet>
    </>
  );
}

export default function CaseReview() {
  return <AdviserCaseGate>{(c) => <Review c={c} />}</AdviserCaseGate>;
}
