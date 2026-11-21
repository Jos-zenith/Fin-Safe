"use client";
import { Send } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CaseGate } from "@/components/CaseGate";
import { Chip, Crumb, MainSide, PageHead, Timeline, useDocTitle, type ChipTone } from "@/components/ds";
import { Legal } from "@/components/Legal";
import { Card, LinkBtn } from "@/components/ui";
import { ADVISER } from "@/data/adviser";
import { statusForUser } from "@/lib/cases";
import { caseRef } from "@/lib/nav";
import { firstOf, lastOf, useTrail } from "@/lib/useTrail";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case } from "@/types";

const STEPS = ["draft", "submitted", "review", "changes", "approved"] as const;
const TONE: Record<Case["status"], ChipTone> = { INTAKE_DONE: "neui", DRAFT_READY: "info", IN_REVIEW: "warn", CHANGES_REQUESTED: "err", APPROVED: "ok" };

function Body({ c }: { c: Case }) {
  const { t, lang } = useApp();
  const wf = useWorkflow();
  const trail = useTrail(c);
  const [reply, setReply] = useState("");
  const loc = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
  const short = (iso?: string) => (iso ? new Date(iso).toLocaleString(loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
  const full = (iso?: string) => (iso ? new Date(iso).toLocaleString(loc, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const id = encodeURIComponent(c.id);
  const ref = caseRef(c.id);
  const idx = statusForUser(c.status);
  const audit = trail?.audit;
  // the time each step happened, from the server's record (a step with no record shows no time)
  const when: Record<(typeof STEPS)[number], string | undefined> = {
    draft: firstOf(audit, "draft_generated")?.ts ?? c.gen?.startedAt,
    submitted: firstOf(audit, "plan_requested")?.ts ?? c.createdAt,
    review: lastOf(audit, "case_opened")?.ts,
    changes: lastOf(audit, "changes_requested")?.ts,
    approved: c.reviewedAt ?? lastOf(audit, "approved_demo")?.ts,
  };
  const hadChanges = !!lastOf(audit, "changes_requested") || c.status === "CHANGES_REQUESTED";
  const stateOf = (k: (typeof STEPS)[number], i: number): "done" | "now" | "todo" | "skip" => {
    if (k === "changes" && !hadChanges && idx !== 3) return idx === 4 ? "skip" : "todo";
    return i < idx ? "done" : i === idx ? "now" : "todo";
  };
  const adviserName = c.claimedBy?.name;
  const statusText = t(`status.s.${c.status}`);
  useDocTitle(t("case.title", { ref, status: statusText }));
  const recent = [...(audit ?? [])].reverse().slice(0, 4);

  const tracker = STEPS.map((k, i) => ({ k, i, st: stateOf(k, i) }));
  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("case.crumb"), href: `/case/${id}` }, { label: t("case.ref", { ref }) }]} />
      <PageHead
        title={t("case.title", { ref, status: statusText })}
        sub={t("case.sub", { opened: full(c.createdAt), updated: full(c.updatedAt) })}
        actions={
          <>
            <LinkBtn href={c.status === "APPROVED" ? `/case/${id}/approved` : `/advice/${id}`} variant="secondary" small>
              {c.status === "APPROVED" ? t("case.openReviewed") : t("case.openDraft")}
            </LinkBtn>
            <LinkBtn href={`/case/${id}/audit`} variant="secondary" small>{t("case.auditLink")}</LinkBtn>
          </>
        }
      />

      {/* the five statuses: done = green + a tick, current = amber + its number, future = muted, and each says so in words */}
      <Card className="mt-6 !p-8 max-md:!p-5" data-testid="case-tracker" aria-label={t("case.step.tracker")} role="group">
        <ol className="hidden items-start md:flex">
          {tracker.map(({ k, i, st }, n) => (
            <li key={k} className="flex flex-1 items-start last:flex-none" aria-current={st === "now" ? "step" : undefined}>
              <div className={`min-w-[100px] flex-1 text-center ${st === "skip" || st === "todo" ? "text-[#77746a]" : ""}`}>
                <div
                  className={`mx-auto mb-2.5 grid size-[46px] place-items-center rounded-full border-2 text-base font-extrabold ${
                    st === "done" ? "border-[#9ADBB4] bg-[#9ADBB4] text-[#0B3B20]" : st === "now" ? "border-[#F2C14E] bg-[#F2C14E] text-[#3D2A00] shadow-[0_0_0_5px_rgba(242,193,78,0.2)]" : "border-[#BDB9AB] bg-[#EAE7DD] text-[#77746a]"
                  }`}
                >
                  {st === "done" ? "✓" : i + 1}
                </div>
                <b>{t(`case.step.${k}`)}</b>
                <div className="text-xs">
                  {st === "done" || st === "now" ? (when[k] ? (st === "now" && k === "review" ? t("case.step.since", { date: short(when[k]) }) : short(when[k])) : "") : k === "changes" ? t("case.step.onlyIf") : t("case.step.notYet")}
                </div>
              </div>
              {n < tracker.length - 1 && <div aria-hidden className={`mt-[23px] h-0.5 min-w-3 flex-[1_1_24px] ${i < idx ? "bg-[#9ADBB4]" : "bg-[#b9b5a8]"}`} />}
            </li>
          ))}
        </ol>
        <div className="md:hidden">
          <Timeline
            items={tracker.map(({ k, st }) => ({
              key: k,
              title: t(`case.step.${k}`),
              meta: st === "done" || st === "now" ? short(when[k]) : k === "changes" ? t("case.step.onlyIf") : t("case.step.notYet"),
              state: st === "skip" ? "todo" : st,
            }))}
          />
        </div>
      </Card>

      <MainSide
        className="mt-6"
        main={
          <>
            <Card tone="dark">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="t-h3">{t("case.now")}</h2>
                <Chip tone={TONE[c.status]}>{statusText}</Chip>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-[#2e2e2e] p-[18px]">
                  <div className="t-label">{t("case.owner")}</div>
                  {adviserName ? (
                    <div className="mt-2 flex items-center gap-3">
                      <Avatar name={ADVISER.name} size={44} tone={1} />
                      <div className="text-sm">
                        <b>{adviserName}</b>
                        <div className="text-muted"><Legal k="adviserCard" /> <Legal k="noReg" /></div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm">{t("case.ownerNone")}</p>
                  )}
                </div>
                <div className="rounded-2xl bg-[#2e2e2e] p-[18px]">
                  <div className="t-label">{t("case.next")}</div>
                  <p className="mt-2 text-sm">{t(`case.next.${c.status}`)}</p>
                  <p className="mt-2 text-xs text-muted">{t("case.noEta")}</p>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="t-h3">{t("case.wait")}</h2>
              <div className="mt-4 flex flex-col gap-3">
                <div className="ac-inner flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-60"><b>{t("case.wait.add")}</b><div className="text-sm text-muted">{t("case.wait.addD")}</div></div>
                  <LinkBtn href="/dashboard#data-quality" small>{t("case.wait.addBtn")}</LinkBtn>
                </div>
                <div className="ac-inner flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-60"><b>{t("case.wait.learn")}</b><div className="text-sm text-muted">{t("case.wait.learnD")}</div></div>
                  <LinkBtn href="/help" variant="secondary" small>{t("case.wait.learnBtn")}</LinkBtn>
                </div>
                <div className="ac-inner flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-60"><b>{t("case.wait.none")}</b><div className="text-sm text-muted">{c.status === "CHANGES_REQUESTED" ? t("case.next.CHANGES_REQUESTED") : t("case.wait.noneD")}</div></div>
                  {c.status !== "CHANGES_REQUESTED" && <Chip tone="ok">{t("case.wait.nothing")}</Chip>}
                </div>
              </div>
            </Card>

            <Card tone="dark">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="t-h3">{t("case.activity")}</h2>
                <Link href={`/case/${id}/audit`} className="und min-h-11 text-sm text-lime">{t("case.activity.full")}</Link>
              </div>
              <Timeline
                className="mt-4"
                items={recent.map((a, n) => ({
                  key: `${a.chainId}-${a.seq}`,
                  title: t(`action.${a.action}`),
                  meta: `${short(a.ts)} · ${t(`actor.${a.actor}`)}`,
                  state: n === 0 ? "now" : "done",
                }))}
              />
            </Card>
          </>
        }
        side={
          <>
            <Card tone="lav" small className="!p-6" aria-live="polite">
              <div className="t-h4">{t("case.returned.title")}</div>
              {c.status === "CHANGES_REQUESTED" && c.adviserQuestion ? (
                <>
                  <p className="mt-2 text-sm font-semibold">{t("plan.adviserAsks")}</p>
                  <p className="ac-inner mt-2 text-sm" data-testid="adviser-question">{c.adviserQuestion}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <input value={reply} onChange={(e) => setReply(e.target.value.slice(0, 300))} aria-label={t("plan.reply")} placeholder={t("plan.reply")} className="ac-field !min-h-12 flex-1 !rounded-full" />
                    <button
                      type="button"
                      disabled={!reply.trim()}
                      onClick={() => {
                        void wf.reply(c.id, reply.trim());
                        setReply("");
                      }}
                      aria-label={t("plan.send")}
                      className="ac-btn ac-btn-primary !size-12 !min-h-12 !p-0"
                    >
                      <Send size={20} aria-hidden />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm">{t("case.returned.body")}</p>
                  <p className="ac-inner mt-3 text-sm">{t("case.returned.none")}</p>
                </>
              )}
            </Card>
            <Card tone="dark" small className="!p-6">
              <div className="t-h4">{t("case.open.title")}</div>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                <li><Link href={`/advice/${id}`} className="und inline-flex min-h-11 items-center">{t("case.open.draft")}</Link></li>
                <li>
                  {c.status === "APPROVED" ? (
                    <Link href={`/case/${id}/approved`} className="und inline-flex min-h-11 items-center">{t("case.openReviewed")}</Link>
                  ) : (
                    <span className="text-muted">{t("case.open.reviewed")}</span>
                  )}
                </li>
                <li><Link href="/assumptions" className="und inline-flex min-h-11 items-center">{t("case.open.assumptions")}</Link></li>
              </ul>
            </Card>
            {c.flagged && (
              <p role="status" data-testid="flagged-banner" className="rounded-2xl border-2 border-[#E0A800] bg-[#2A2418] p-3 text-sm font-semibold text-[#F3E2B3]">
                {t("plan.flagged")}
              </p>
            )}
          </>
        }
      />
    </div>
  );
}

export default function CaseStatus() {
  const { caseId } = useParams<{ caseId: string }>();
  return <CaseGate caseId={decodeURIComponent(caseId)}>{(c) => <Body c={c} />}</CaseGate>;
}
