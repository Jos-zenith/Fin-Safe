"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ActorChip, ChainBadge, DiffText } from "@/components/audit";
import { CaseGate } from "@/components/CaseGate";
import { Check, Chip, Crumb, MainSide, PageHead, useDocTitle, type ChipTone } from "@/components/ds";
import { DraftWatermark } from "@/components/Watermark";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { ADVISER } from "@/data/adviser";
import { CHECKLIST_IDS } from "@/config/workflow";
import { reviewedItems } from "@/lib/cases";
import { caseRef } from "@/lib/nav";
import { itemInLang } from "@/lib/plan";
import { useTrail } from "@/lib/useTrail";
import type { AuditRec } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import type { Case } from "@/types";

type Filter = "all" | "ai" | "edits" | "approvals" | "disclosures";
const FILTERS: Filter[] = ["all", "ai", "edits", "approvals", "disclosures"];
const EDITS = ["item_accepted", "item_edited", "item_rejected", "item_comment"];
const APPROVALS = ["approved_demo", "changes_requested"];

const matches = (f: Filter, a: AuditRec) =>
  f === "all" ? true : f === "ai" ? a.actor === "ai" || a.action === "draft_generated" || a.action.startsWith("system_") : f === "edits" ? EDITS.includes(a.action) : f === "approvals" ? APPROVALS.includes(a.action) : a.disclosuresShown.length > 0;

function chipFor(a: AuditRec): { tone: ChipTone; key: string } {
  if (a.action === "approved_demo") return { tone: "ok", key: "au.f.approvals" };
  if (EDITS.includes(a.action)) return { tone: "info", key: "au.f.edits" };
  if (a.action === "draft_generated" || a.actor === "ai") return { tone: "warn", key: "au.f.ai" };
  return { tone: "neu", key: "" };
}

function Body({ c }: { c: Case }) {
  const { t, lang } = useApp();
  const trail = useTrail(c);
  const [filter, setFilter] = useState<Filter>("all");
  const [item, setItem] = useState(0);
  const [what, setWhat] = useState(false);
  const id = encodeURIComponent(c.id);
  const ref = caseRef(c.id);
  const loc = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(loc, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const approved = c.status === "APPROVED";
  const rows = useMemo(() => reviewedItems(c), [c]);
  const sel = rows[Math.min(item, rows.length - 1)];
  const events = useMemo(() => [...(trail?.audit ?? [])].reverse().filter((a) => matches(filter, a)), [trail, filter]);
  const ticked = CHECKLIST_IDS.filter((k) => c.checklist[k]).length;
  const version = c.planVersion ?? 1;
  useDocTitle(t("au.title"));

  // the record can be saved as a file: exactly what the server returned, nothing added
  const download = () => {
    const blob = new Blob([JSON.stringify({ caseId: c.id, chain: trail?.chain, entries: trail?.audit ?? [] }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case-${ref}-audit.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selItem = sel ? itemInLang(c, sel.item, lang) : null;

  return (
    <div className="ac-wrap pb-12">
      {!approved && <DraftWatermark />}
      <Crumb items={[{ label: t("case.crumb"), href: `/case/${id}` }, { label: t("case.ref", { ref }), href: `/case/${id}` }, { label: t("case.auditLink") }]} />
      <PageHead
        title={t("au.title")}
        sub={t("au.sub")}
        actions={
          <>
            <Btn variant="secondary" small disabled={!trail} onClick={download}>{t("au.download")}</Btn>
            <LinkBtn href={approved ? `/case/${id}/approved` : `/advice/${id}`} variant="secondary" small>{t("au.back")}</LinkBtn>
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t("case.activity")} className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="ac-chip ac-chip-neu min-h-11 px-4 text-[13px]">
              {t(`au.f.${f}`)}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <ChainBadge chain={trail?.chain ?? null} />
        <button type="button" aria-expanded={what} onClick={() => setWhat((w) => !w)} className="und min-h-11 text-sm text-lav">{t("au.what")}</button>
      </div>
      {what && <p className="s-lav ac-card-s mt-3 text-sm">{t("au.whatBody")}</p>}

      <MainSide
        className="mt-6"
        cols="minmax(0,1.1fr) minmax(0,1.2fr)"
        main={
          <div className="min-w-0">
            {events.length === 0 ? (
              <p className="ac-ph p-6 text-center text-sm">{trail ? t("au.f.none") : t("app.loading")}</p>
            ) : (
              <ol className="ac-tl" data-testid="audit-events">
                {events.map((a, n) => {
                  const chip = chipFor(a);
                  const edited = a.action === "item_edited";
                  return (
                    <li key={`${a.chainId}-${a.seq}`} className={`ac-ev ${n === 0 ? "ac-ev-now" : "ac-ev-done"}`}>
                      <div className="s-dark rounded-[18px] border border-[#383838] bg-[#242424] px-[18px] py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <b>{t(`action.${a.action}`)}</b>
                            <div className="text-xs text-muted">{when(a.ts)} · {t(`actor.${a.actor}`)}</div>
                          </div>
                          {chip.key ? <Chip tone={chip.tone}>{t(chip.key)}</Chip> : <ActorChip actor={a.actor} />}
                        </div>
                        {a.disclosuresShown.length > 0 && (
                          <p className="mt-2 flex flex-wrap gap-1.5">
                            {a.disclosuresShown.map((d) => (
                              <Chip key={d} tone="outline" className="!min-h-[22px] text-[11px]">{t(`disc.${d}`)}</Chip>
                            ))}
                          </p>
                        )}
                        {(a.before || a.after) && (
                          <details className="mt-2">
                            <summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-lime">{edited ? t("au.cmp.title") : t("activity.details")}</summary>
                            <dl className="space-y-1.5 text-sm text-muted">
                              {a.before && <div><dt className="text-xs">{t("activity.before")}</dt><dd className="break-words">{a.before.length > 240 ? `${a.before.slice(0, 240)}…` : a.before}</dd></div>}
                              {a.after && <div><dt className="text-xs">{t("activity.after")}</dt><dd className="break-words">{a.after.length > 240 ? `${a.after.slice(0, 240)}…` : a.after}</dd></div>}
                            </dl>
                          </details>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {trail && trail.audit.length === 1 && <p className="mt-3 text-sm text-muted">{t("au.single")}</p>}
          </div>
        }
        side={
          <>
            <Card id="compare" className="scroll-mt-28">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="t-h3">{t("au.cmp.title")}</h2>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("au.cmp.title")}>
                  {rows.map((r, i) => (
                    <button key={r.item.id} type="button" aria-pressed={i === item} onClick={() => setItem(i)} aria-label={`${t("au.cmp.title")} ${i + 1}`} className="ac-chip ac-chip-neui min-h-11 px-3.5">
                      #{i + 1}
                    </button>
                  ))}
                </div>
              </div>
              {sel && selItem && (
                <>
                  <p className="mt-3 text-sm font-semibold">{selItem.title}</p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="ac-inner border-2 border-dashed border-[#E0A800] bg-[#F3EAD0]">
                      <Chip tone="warn">{t("au.cmp.draft", { v: 1 })}</Chip>
                      <p className="mt-3 text-sm">
                        {sel.edited ? <DiffText draft={sel.item.rationale} reviewed={sel.rationale} side="draft" /> : sel.decision === "rejected" ? <del className="ac-del">{sel.item.rationale}</del> : sel.item.rationale}
                      </p>
                    </div>
                    <div className={`ac-inner border-2 ${approved ? "border-solid border-[#2F8F5B] bg-[#E3EFE6]" : "border-dashed border-[#9a968a]"}`}>
                      <Chip tone={approved ? "ok" : "neui"}>{approved ? t("au.cmp.reviewed", { v: version }) : t("au.cmp.pending")}</Chip>
                      <p className="mt-3 text-sm">
                        {!approved ? sel.item.rationale : sel.edited ? <DiffText draft={sel.item.rationale} reviewed={sel.rationale} side="reviewed" /> : sel.decision === "rejected" ? <b>{t("au.cmp.removed")}</b> : sel.item.rationale}
                      </p>
                      {approved && (
                        <p className="mt-2 text-xs font-bold">{sel.edited ? t("au.cmp.changed") : sel.decision === "rejected" ? t("au.cmp.removed") : t("au.cmp.same")}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
              <p className="mt-3 text-sm text-muted">{t("au.cmp.note")}</p>
            </Card>

            <div className="grid gap-5 sm:grid-cols-2">
              <Card tone="dark" small className="!p-6">
                <h3 className="t-h4">{t("au.appr.title")}</h3>
                {approved ? (
                  <dl className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-muted">{t("au.appr.by")}</dt><dd className="text-right font-bold">{ADVISER.name} ({t("role.adviser").toLowerCase()})</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">{t("au.appr.date")}</dt><dd className="font-bold">{when(c.reviewedAt)}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">{t("au.appr.version")}</dt><dd className="font-bold">{version}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">{t("au.appr.checks")}</dt><dd className="font-bold">{ticked} / {CHECKLIST_IDS.length}</dd></div>
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-muted">{t("au.appr.none")}</p>
                )}
              </Card>
              <Card tone="dark" small className="!p-6">
                <h3 className="t-h4">{t("au.disc.title")}</h3>
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  <li className="flex items-center gap-2"><Check on={!!c.consent} /> {t("au.disc.terms")}</li>
                  <li className="flex items-center gap-2"><Check on={!!c.consent} /> {t("au.disc.fee")}</li>
                  <li className="flex items-center gap-2"><Check on={!!c.checklist.conflicts && !!c.checklist.fee} /> {t("au.disc.rev")}</li>
                </ul>
              </Card>
            </div>
            <Card tone="lav" small className="!p-6">
              <h3 className="t-h4">{t("au.about.title")}</h3>
              <p className="mt-2 text-sm">{t("au.whatBody")}</p>
              <Link href="/compliance" className="und mt-2 inline-block min-h-11 text-sm">{t("menu.compliance")}</Link>
            </Card>
          </>
        }
      />
    </div>
  );
}

export default function CaseAudit() {
  const { caseId } = useParams<{ caseId: string }>();
  return <CaseGate caseId={decodeURIComponent(caseId)}>{(c) => <Body c={c} />}</CaseGate>;
}
