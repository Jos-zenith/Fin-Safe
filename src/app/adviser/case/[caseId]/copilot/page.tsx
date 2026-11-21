"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdviserCaseGate } from "@/components/AdviserGate";
import { Check, Chip, Crumb, PageHead, Panel, useDocTitle, useToast } from "@/components/ds";
import { Sheet } from "@/components/Sheet";
import { SourceTag } from "@/components/SourceTag";
import { Btn, Card, LinkBtn, Skeleton } from "@/components/ui";
import { runEngine } from "@/lib/engine";
import { formatValue } from "@/lib/format";
import { caseRef } from "@/lib/nav";
import { assessProfile } from "@/lib/quality";
import { useCaseWork } from "@/lib/useCaseWork";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case } from "@/types";

const block = "s-ivory relative rounded-[22px] border-[1.5px] border-dashed border-[#9a968a] bg-ivory p-[22px]";

function Copilot({ c }: { c: Case }) {
  const { t, lang, reviews } = useApp();
  const wf = useWorkflow();
  const toast = useToast();
  const w = useCaseWork(c);
  const id = encodeURIComponent(c.id);
  const ref = caseRef(c.id);
  const engine = useMemo(() => runEngine(c.profile), [c.profile]);
  const quality = useMemo(() => assessProfile(c.profile, engine, { reviews }), [c.profile, engine, reviews]);
  const co = c.copilot;
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [ret, setRet] = useState(false);
  const [q, setQ] = useState("");
  const f = engine.flat;
  const lead = engine.ladder.steps.find((s) => s.id === (engine.ladder.firstBlocker ?? engine.ladder.firstOpen));
  useDocTitle(t("cp.title", { ref }));

  // what the client told us, quoted from the answers (never interpreted), and what the case is still missing
  const concerns = [
    ...engine.flags.filter((x) => x.severity === "high").map((x) => t(`eflag.${x.id}`)),
    ...(c.profile.risk.followsTips ? [t("cr.suit.tips")] : []),
    `${t("cr.lang")}: ${c.profile.language.toUpperCase()}`,
  ];
  const missing = quality.issues.flatMap((i) => i.fields.map((x) => t(`dq.field.${x}`)));
  const missingUnique = [...new Set(missing)];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(notes);
      toast.show(t("cp.copied"));
    } catch {
      /* the browser did not allow the clipboard: the notes stay on screen */
    }
  };

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.cases"), href: "/adviser" }, { label: t("case.ref", { ref }), href: `/adviser/case/${id}` }, { label: t("nav2.copilot") }]} />
      <PageHead
        title={t("cp.title", { ref })}
        sub={t("cp.sub")}
        actions={
          <>
            <LinkBtn href={`/adviser/case/${id}`} variant="secondary" small>{t("cp.back")}</LinkBtn>
            <Btn variant="secondary" small disabled={!w.canAct} onClick={() => void wf.copilot(c.id, lang)}>{t("cp.regen")}</Btn>
          </>
        }
      />
      {/* a persistent "AI assistance, not a conclusion" banner: dashed neutral edges and a DRAFT chip, so these blocks never resemble approved content */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-[#E0A800] bg-[#2A2418] px-[18px] py-3">
        <Chip tone="warn">{t("cp.banner.chip")}</Chip>
        <span className="min-w-0 flex-1 basis-72 text-sm text-[#F3E2B3]">{t("cp.banner.body")}</span>
      </div>

      <div className="mt-6 grid items-start gap-6 wd:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {!w.canAct && !co && <p role="status" className="ac-ph p-5 text-center text-sm">{t("cp.unavailable")}</p>}
          {w.canAct && !co && (
            <div role="status" aria-live="polite" className="grid gap-4 md:grid-cols-2">
              <p className="sr-only">{t("adv.copilotLoading")}</p>
              <Skeleton className="h-40" /><Skeleton className="h-40" />
            </div>
          )}
          {co && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <section className={block}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="t-h3">{t("adv.agenda")}</h2><Chip tone="neui">{t("cp.draft")}</Chip></div>
                  <ol className="mt-3 flex flex-col gap-2 text-sm">{co.agenda.map((a, i) => <li key={a}>{i + 1}. {a}</li>)}</ol>
                  <Btn small className="mt-4" onClick={() => setNotes((n) => `${n}${n ? "\n\n" : ""}${co.agenda.map((a, i) => `${i + 1}. ${a}`).join("\n")}`)}>{t("cp.notes.use")}</Btn>
                </section>
                <section className={block}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="t-h3">{t("cp.concerns")}</h2><Chip tone="neui">{t("cp.concerns.chip")}</Chip></div>
                  <ul className="mt-3 flex flex-col gap-2 text-sm">{concerns.map((x) => <li key={x}>• “{x}”</li>)}</ul>
                  <p className="mt-3 text-xs text-muted">{t("cp.concerns.note")}</p>
                </section>
              </div>
              <section className={block}>
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="t-h3">{t("cp.rationale")}</h2><Chip tone="neui">{t("cp.draft")}</Chip></div>
                <p className="mt-3 text-sm">{co.rationaleSummary}</p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <Link href={`/adviser/case/${id}`} className="und inline-flex min-h-11 items-center">{t("cp.rationale.figures")}</Link>
                  <Link href="/assumptions" className="und inline-flex min-h-11 items-center">{t("cr.assump")}</Link>
                </div>
              </section>
              <div className="grid gap-4 md:grid-cols-2">
                <section className="s-ivory relative rounded-[22px] border-[1.5px] border-dashed border-[#E0A800] bg-[#F3EAD0] p-[22px]">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="t-h3">{t("cp.missing")}</h2><Chip tone="warn">{t("cp.missing.n", { n: missingUnique.length })}</Chip></div>
                  {missingUnique.length ? (
                    <>
                      <ul className="mt-3 flex flex-col gap-2 text-sm">{missingUnique.map((x) => <li key={x}>• {x}</li>)}</ul>
                      <Btn small className="mt-4" disabled={!w.canAct} onClick={() => { setQ(missingUnique.join(", ")); setRet(true); }}>{t("cp.missing.btn")}</Btn>
                    </>
                  ) : (
                    <p className="mt-3 text-sm">{t("cp.missing.none")}</p>
                  )}
                </section>
                <section className={block}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="t-h3">{t("cp.topics")}</h2><Chip tone="neui">{t("cp.draft")}</Chip></div>
                  <ul className="mt-3 flex flex-col gap-2 text-sm">{c.plan.adviserQuestions.map((x) => <li key={x}>• {x}</li>)}</ul>
                </section>
              </div>
              <section className={block}>
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="t-h3">{t("cp.notes")}</h2><Chip tone="neui">{t("cp.notes.chip")}</Chip></div>
                <label className="sr-only" htmlFor="cp-notes">{t("cp.notes")}</label>
                <textarea id="cp-notes" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 4000))} rows={6} placeholder={t("cp.notes.ph")} className="ac-field mt-3 !min-h-[130px] text-sm" />
                <p className="mt-2 text-xs text-muted">{co.meetingNotes}</p>
                <div className="mt-3 flex flex-wrap gap-2"><Btn small onClick={() => void copy()} disabled={!notes}>{t("cp.notes.copy")}</Btn></div>
              </section>
              <SourceTag source={co.source} />
            </>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Panel tone="dark" title={t("cp.follow")} small className="!p-6">
            <ul className="flex flex-col gap-3 text-sm">
              {(co?.followUps ?? []).map((x) => (
                <li key={x}>
                  <button type="button" role="checkbox" aria-checked={!!done[x]} onClick={() => setDone((d) => ({ ...d, [x]: !d[x] }))} className="flex min-h-11 w-full items-center gap-2 text-left">
                    <Check on={!!done[x]} />
                    <span className={done[x] ? "text-muted" : ""}>{x}</span>
                  </button>
                </li>
              ))}
              {!co && <li className="text-muted">—</li>}
            </ul>
          </Panel>
          <Card tone="lav" small className="!p-6">
            <h2 className="t-h4">{t("cp.snapshot")}</h2>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3"><span>{t("cr.reserve")}</span><b>{formatValue(f["ef.months"], "months")} {t("unit.months")}</b></div>
              <div className="flex justify-between gap-3"><span>{t("cr.blocker")}</span><b>{lead ? t(`ladder.step.${lead.id}`) : "—"}</b></div>
              <div className="flex justify-between gap-3"><span>{t("cr.lang")}</span><b>{c.profile.language.toUpperCase()}</b></div>
            </div>
          </Card>
          <Card tone="dark" small className="!p-6">
            <h2 className="t-h4">{t("cp.goto")}</h2>
            <div className="mt-3 flex flex-col gap-2">
              <LinkBtn href={`/adviser/case/${id}`} variant="lime" small block>{t("cp.back")}</LinkBtn>
              <LinkBtn href={`/adviser/case/${id}/approve`} variant="secondary" small block>{t("cp.checklist")}</LinkBtn>
            </div>
          </Card>
        </aside>
      </div>

      <Sheet open={ret} onClose={() => setRet(false)} title={t("adv.return")}>
        <label className="block text-sm font-semibold" htmlFor="cp-ret">{t("adv.returnQ")}</label>
        <textarea id="cp-ret" value={q} onChange={(e) => setQ(e.target.value.slice(0, 300))} rows={3} className="ac-field mt-1" />
        <Btn block className="mt-3" disabled={!q.trim()} onClick={() => { void w.act(wf.returnForInfo(c.id, q.trim())); setQ(""); setRet(false); }}>
          {t("adv.returnSend")}
        </Btn>
      </Sheet>
    </div>
  );
}

export default function CopilotPage() {
  return <AdviserCaseGate>{(c) => <Copilot c={c} />}</AdviserCaseGate>;
}
