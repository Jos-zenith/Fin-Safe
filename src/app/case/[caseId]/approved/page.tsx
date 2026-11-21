"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { DiffText } from "@/components/audit";
import { CaseGate } from "@/components/CaseGate";
import { Check, Chip, Crumb, MainSide, PageHead, StatusBanner, useDocTitle } from "@/components/ds";
import { Ask } from "@/components/Ask";
import { AssetChip } from "@/components/plan";
import { Legal } from "@/components/Legal";
import { Sheet } from "@/components/Sheet";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { ADVISER } from "@/data/adviser";
import { changeSummary, reviewedItems, type ReviewedItem } from "@/lib/cases";
import { CHECKLIST_IDS } from "@/config/workflow";
import { findResult, runEngine } from "@/lib/engine";
import { itemInLang } from "@/lib/plan";
import { caseRef } from "@/lib/nav";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case } from "@/types";

function ReviewedItemCard({ n, c, r }: { n: number; c: Case; r: ReviewedItem }) {
  const { t, lang } = useApp();
  const engine = useMemo(() => runEngine(c.profile), [c.profile]);
  const item = itemInLang(c, r.item, lang);
  const [showRemoved, setShowRemoved] = useState(false);
  if (r.decision === "rejected") {
    return (
      <article className="s-ivory ri relative rounded-[22px] border-2 border-[#9a968a] bg-ivory p-[26px] opacity-90 max-md:p-5" data-testid={`reviewed-item-${r.item.id}`} data-decision="rejected">
        <div className="flex flex-wrap items-center gap-2">
          <b className="num text-xl">{n}</b>
          <Chip tone="err">{t("rv.removed")}</Chip>
        </div>
        <h3 className="t-h3 mt-2 line-through">{item.title}</h3>
        <div className="mt-2 text-sm text-muted">
          {r.comment ? (
            <>
              {t("rv.note")}: “{r.comment}”{" "}
            </>
          ) : null}
          <button type="button" aria-expanded={showRemoved} onClick={() => setShowRemoved((s) => !s)} className="und min-h-11 font-semibold">
            {showRemoved ? t("rv.hideRemoved") : t("rv.showRemoved")}
          </button>
        </div>
        {showRemoved && <p className="ac-inner mt-2 text-sm line-through">{item.rationale}</p>}
      </article>
    );
  }
  return (
    <article className="s-ivory relative rounded-[22px] border-2 border-[#2F8F5B] bg-ivory p-[26px] max-md:p-5" data-testid={`reviewed-item-${r.item.id}`} data-decision={r.decision}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <b className="num text-xl">{n}</b>
          <AssetChip cls={item.assetClass} />
          {r.edited && <Chip tone="ok">{t("rv.edited")}</Chip>}
        </div>
        <Chip tone="ok">REVIEWED (DEMO)</Chip>
      </div>
      <h3 className="t-h2 mt-3">{item.title}</h3>
      <p className="mt-2 text-base leading-relaxed">{r.edited ? <DiffText draft={r.item.rationale} reviewed={r.rationale} side="reviewed" /> : item.rationale}</p>
      {r.edited && <p className="mt-1 text-xs text-muted">{t("plan.editedNote")}</p>}
      {item.rangeNote && <p className="ac-inner mt-3 text-sm font-medium">{item.rangeNote}</p>}
      {r.comment && <p className="ac-inner mt-3 text-sm"><b>{t("plan.adviserNote")}:</b> {r.comment}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="ac-inner">
          <div className="t-label">{t("adv2.whyThis")}</div>
          <div className="mt-2 break-words text-sm">{(item.evidenceRefs[0] && findResult(engine, item.evidenceRefs[0])?.formula) || "—"}</div>
        </div>
        <div className="ac-inner">
          <div className="t-label">{t("adv2.risks")}</div>
          <div className="mt-2 text-sm">{item.risks}</div>
        </div>
      </div>
    </article>
  );
}

function Body({ c }: { c: Case }) {
  const { t, lang } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const id = encodeURIComponent(c.id);
  const ref = caseRef(c.id);
  const loc = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [rest, setRest] = useState(false);
  const approved = c.status === "APPROVED";
  const accepted = !!c.acceptedAt;
  const rows = useMemo(() => reviewedItems(c), [c]);
  const summary = changeSummary(c);
  const unchanged = rows.filter((r) => r.decision !== "edited" && r.decision !== "rejected");
  const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(loc, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  useDocTitle(t("rv.title"));

  // a plan that is not approved yet is not "reviewed advice": send the person to the draft instead
  // (after the person reports an error the plan goes back to review; the confirmation stays up until they close it)
  useEffect(() => {
    if (!approved && !sent) router.replace(`/advice/${id}`);
  }, [approved, sent, id, router]);
  if (!approved && !sent) return null;

  // the first item of each kind is always shown; the rest of the unchanged ones fold away
  const numbered = rows.map((r, i) => ({ r, n: i + 1 }));
  const visible = numbered.filter(({ r }) => rest || r.decision === "edited" || r.decision === "rejected" || r.item.id === unchanged[0]?.item.id);
  const hidden = numbered.length - visible.length;
  const checked = CHECKLIST_IDS.filter((k) => c.checklist[k] && k !== "demo_ack").map((k) => t(`adv.check.${k}`));

  return (
    <>
      <StatusBanner kind="approved" chip={<Chip tone="ok" className="!min-h-[30px]">{t("rv.banner")}</Chip>} meta={t("rv.banner.meta", { ref, v: c.planVersion ?? 1 })}>
        <Legal k="reviewed" /> {t("rv.banner.date", { date: day(c.reviewedAt) })}
      </StatusBanner>
      <div className="ac-wrap pb-12">
        <Crumb items={[{ label: t("case.crumb"), href: `/case/${id}` }, { label: t("case.ref", { ref }), href: `/case/${id}` }, { label: t("rv.title") }]} />
        <PageHead
          title={<span data-testid="reviewed-title">{t("rv.title")}</span>}
          sub={accepted ? t("plan.acceptedOn", { date: day(c.acceptedAt) }) : t("plan.awaiting")}
          subTestId={accepted ? "accepted-note" : undefined}
          actions={
            <>
              <Btn variant="secondary" small data-no-print onClick={() => window.print()}>{t("rv.print")}</Btn>
              {!accepted && <Btn variant="lime" onClick={() => void wf.acceptPlan(c.id)} data-testid="accept-top">{t("plan.accept")}</Btn>}
            </>
          }
        />

        <MainSide
          className="mt-8"
          main={
            <>
              {/* accountability first: who approved, when, which version and what was checked. A persona never has a registration number. */}
              <Card tone="dark">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar name={ADVISER.name} size={64} tone={1} />
                  <div className="min-w-[240px] flex-1">
                    <div className="t-h3">{ADVISER.name}</div>
                    <div className="text-sm text-muted"><Legal k="adviserCard" /> <Legal k="noReg" /></div>
                    <p className="mt-1 text-xs text-muted" data-testid="adviser-identity-note">{t("adviser.realNote")}</p>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <div className="flex gap-3"><span className="text-muted">{t("rv.approved")}</span><b>{when(c.reviewedAt)}</b></div>
                    <div className="flex gap-3"><span className="text-muted">{t("rv.version")}</span><b>{c.planVersion ?? 1}</b></div>
                  </div>
                </div>
                <hr className="ac-hr mt-4" />
                <p className="mt-3 text-sm text-muted">{t("rv.checked")}: {checked.join(" · ")}.</p>
                <p className="mt-2 text-sm font-medium" data-testid="plan-changes">
                  {summary.changed || summary.removed ? t("audit.changes", summary) : t("audit.noChanges")}
                </p>
              </Card>

              <ol className="flex flex-col gap-5">
                {visible.map(({ r, n }) => (
                  <li key={r.item.id}>
                    <ReviewedItemCard n={n} c={c} r={r} />
                  </li>
                ))}
              </ol>
              {hidden > 0 && (
                <div className="s-dark ac-card-s ac-bordered bg-[#242424] text-center">
                  <button type="button" aria-expanded={rest} onClick={() => setRest(true)} className="und min-h-11 font-semibold text-lime">
                    {t("rv.unchanged", { n: hidden })}
                  </button>
                </div>
              )}
              <Ask />
              <p className="text-xs text-muted"><Legal k="demoWorkflow" /></p>
              <Link href={`/case/${id}/audit`} className="und inline-flex min-h-11 items-center text-lime">{t("plan.trail")}</Link>
            </>
          }
          side={
            <>
              <Card tone="lime" small className="!p-6">
                <div className="t-h3">{t("rv.accept.title")}</div>
                <p className="mt-2 text-sm text-muted">{t("rv.accept.body")}</p>
                {accepted ? (
                  <p className="mt-4 flex items-center gap-2 text-sm font-bold"><Check on /> {t("plan.acceptedOn", { date: day(c.acceptedAt) })}</p>
                ) : (
                  <Btn block className="mt-4" data-testid="accept-plan" onClick={() => void wf.acceptPlan(c.id)}>{t("plan.accept")}</Btn>
                )}
                <Btn variant="secondary" block className="mt-2" onClick={() => { setSent(false); setReporting(true); }}>{t("plan.report")}</Btn>
              </Card>
              <Card tone="burg" small className="!p-6">
                <div className="t-h4">{t("rv.fee.title")}</div>
                <p className="mt-2 text-sm text-muted">{t("rv.fee.body")}</p>
                <Link href="/transparency" className="und mt-2 inline-block min-h-11 text-sm text-lime">{t("nav2.earn")}</Link>
              </Card>
              <Card small className="!p-6">
                <div className="t-h4">{t("rv.disc.title")}</div>
                <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
                  {[1, 2, 3].map((k) => <li key={k}>• {t(`rv.disc.${k}`)}</li>)}
                </ul>
                {c.consent && <p className="mt-3 flex items-center gap-2 text-sm"><Check on /> {t("rv.disc.seen", { date: when(c.consent.at) })}</p>}
              </Card>
              <Card tone="dark" small className="!p-6">
                <div className="t-h4">{t("rv.record.title")}</div>
                <p className="mt-2 text-sm text-muted">{summary.changed || summary.removed ? t("audit.changes", summary) : t("audit.noChanges")}</p>
                <div className="mt-3 flex flex-col gap-1 text-sm">
                  <Link href={`/case/${id}/audit`} className="und inline-flex min-h-11 items-center text-lime">{t("case.auditLink")}</Link>
                  <Link href={`/case/${id}/audit#compare`} className="und inline-flex min-h-11 items-center text-lime">{t("rv.record.compare")}</Link>
                </div>
              </Card>
              <Card tone="lav" small className="!p-6">
                <div className="t-h4">{t("rv.next.title")}</div>
                <p className="mt-2 text-sm">{t("rv.next.body")}</p>
                <LinkBtn href="/actions" small className="mt-3">{t("rv.next.open")}</LinkBtn>
              </Card>
            </>
          }
        />
      </div>

      <Sheet
        open={reporting}
        onClose={() => {
          setReporting(false);
          if (sent) router.replace(`/advice/${id}`);
        }}
        title={t("plan.report")}
      >
        {sent ? (
          <p className="rounded-xl bg-[#16301F] p-3 font-medium text-[#CDEBD8]" role="status">
            {t("plan.reported")}
          </p>
        ) : (
          <div>
            <label htmlFor="report-note" className="text-sm font-semibold">
              {t("plan.report")}
            </label>
            <textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={4} placeholder={t("plan.reportPh")} className="ac-field mt-1" />
            <Btn
              block
              className="mt-3"
              disabled={!note.trim()}
              onClick={async () => {
                const r = await wf.reportError(c.id, note.trim());
                if (r.ok) {
                  setSent(true);
                  setNote("");
                }
              }}
            >
              {t("plan.reportSend")}
            </Btn>
          </div>
        )}
      </Sheet>
    </>
  );
}

export default function Approved() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useApp();
  return (
    <CaseGate caseId={decodeURIComponent(caseId)} crumb={t("rv.title")}>
      {(c) => <Body c={c} />}
    </CaseGate>
  );
}
