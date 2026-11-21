"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdviserCaseGate } from "@/components/AdviserGate";
import { ActorChip, ChainBadge, DiffText } from "@/components/audit";
import { Check, Chip, Crumb, useDocTitle } from "@/components/ds";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { reviewedItems } from "@/lib/cases";
import { caseRef } from "@/lib/nav";
import { useTrail } from "@/lib/useTrail";
import type { AuditRec } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import type { Case } from "@/types";

type Filter = "all" | "ai" | "adviser" | "customer" | "system" | "disclosures";
const FILTERS: Filter[] = ["all", "ai", "adviser", "customer", "system", "disclosures"];
const matches = (f: Filter, a: AuditRec) =>
  f === "all" ? true : f === "ai" ? a.actor === "ai" : f === "adviser" ? a.actor === "adviser" : f === "customer" ? a.actor === "user" : f === "system" ? a.actor === "system" : a.disclosuresShown.length > 0;
const mono = "font-mono text-xs";

function Audit({ c }: { c: Case }) {
  const { t, lang } = useApp();
  const trail = useTrail(c);
  const [filter, setFilter] = useState<Filter>("all");
  const [item, setItem] = useState(0);
  const id = encodeURIComponent(c.id);
  const ref = caseRef(c.id);
  const loc = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
  const when = (iso: string) => new Date(iso).toLocaleString(loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const approved = c.status === "APPROVED";
  const version = c.planVersion ?? 1;
  const rows = useMemo(() => reviewedItems(c), [c]);
  const sel = rows[Math.min(item, rows.length - 1)];
  const audit = useMemo(() => trail?.audit ?? [], [trail]);
  // newest first, as on the customer's page; the entry number is the record's own sequence
  const events = useMemo(() => [...audit].reverse().filter((a) => matches(filter, a)), [audit, filter]);
  const entry = (action: string) => audit.find((a) => a.action === action)?.seq;
  useDocTitle(t("aa.title", { ref }));

  const exportRecord = () => {
    const blob = new Blob([JSON.stringify({ caseId: c.id, chain: trail?.chain, entries: audit }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case-${ref}-audit.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const detail = (a: AuditRec) => (a.after ? (a.after.length > 90 ? `${a.after.slice(0, 90)}…` : a.after) : "—");
  const short = (s: string) => (s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-2)}` : s);

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.cases"), href: "/adviser" }, { label: t("case.ref", { ref }), href: `/adviser/case/${id}` }, { label: t("nav2.audit") }]} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><Chip tone="neu">{t("aa.readonly")}</Chip><ChainBadge chain={trail?.chain ?? null} /></div>
          <h1 className="t-h1 mt-3">{t("aa.title", { ref })}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="secondary" small disabled={!trail} onClick={exportRecord}>{t("aa.export")}</Btn>
          <LinkBtn href={`/adviser/case/${id}`} variant="secondary" small>{t("aa.back")}</LinkBtn>
        </div>
      </div>

      {/* table first: actor, role, action, reason, request and record reference. Read-only: nothing here can be edited. */}
      <Card className="mt-6 !p-6 max-md:!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="t-h3">{t("aa.events")}</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("aa.events")}>
            {FILTERS.map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className="ac-chip ac-chip-neui min-h-11 px-3.5">
                {f === "all" ? t("ad.f.all") : f === "disclosures" ? t("au.f.disclosures") : t(`aa.f.${f}`)}
              </button>
            ))}
          </div>
        </div>
        {events.length === 0 ? (
          <p className="ac-ph mt-4 p-6 text-center text-sm">{trail ? t("aa.empty") : t("app.loading")}</p>
        ) : (
          <div className="ac-scrollx mt-3">
            <table className="ac-tbl min-w-[960px]" data-testid="audit-table">
              <thead>
                <tr><th scope="col">#</th><th scope="col">{t("aa.h.time")}</th><th scope="col">{t("aa.h.actor")}</th><th scope="col">{t("aa.h.role")}</th><th scope="col">{t("aa.h.action")}</th><th scope="col">{t("aa.h.detail")}</th><th scope="col">{t("aa.h.request")}</th><th scope="col">{t("aa.h.ref")}</th></tr>
              </thead>
              <tbody>
                {events.map((a) => (
                  <tr key={`${a.chainId}-${a.seq}`} className="text-[13px]">
                    <td>{a.seq}</td>
                    <td className="whitespace-nowrap">{when(a.ts)}</td>
                    <td>{a.actor === "adviser" ? "Dr. M. Iyer (synthetic)" : t(`actor.${a.actor}`)}</td>
                    <td><ActorChip actor={a.actor} /></td>
                    <td><b>{t(`action.${a.action}`)}</b></td>
                    <td className="max-w-[26ch] break-words">{detail(a)}</td>
                    <td className={mono}>{short(a.requestId)}</td>
                    <td className={mono}>{short(a.hash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6 grid items-start gap-6 wd:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="t-h3">{t("aa.versions")}</h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("aa.versions")}>
              {rows.map((r, i) => (
                <button key={r.item.id} type="button" aria-pressed={i === item} onClick={() => setItem(i)} aria-label={`${t("au.cmp.title")} ${i + 1}`} className="ac-chip ac-chip-neui min-h-11 px-3.5">#{i + 1}</button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="ac-inner">
              <div className="t-label">{t("aa.versions.list")}</div>
              <ul className="mt-2 flex flex-col gap-2 text-sm">
                <li className="flex items-center justify-between"><b>v{version}</b>{approved ? <Chip tone="ok" className="!min-h-[22px]">{t("aa.v.approved")}</Chip> : <Chip tone="warn" className="!min-h-[22px]">{t("aa.v.draft")}</Chip>}</li>
                {version > 1 && <li className="flex items-center justify-between"><b>v1</b><Chip tone="warn" className="!min-h-[22px]">{t("aa.v.draft")}</Chip></li>}
              </ul>
            </div>
            {sel && (
              <>
                <div className="ac-inner border-2 border-dashed border-[#E0A800] bg-[#F3EAD0]">
                  <Chip tone="warn">{t("aa.v.orig")}</Chip>
                  <p className="mt-2 text-sm">{sel.edited ? <DiffText draft={sel.item.rationale} reviewed={sel.rationale} side="draft" /> : sel.decision === "rejected" ? <del className="ac-del">{sel.item.rationale}</del> : sel.item.rationale}</p>
                </div>
                <div className={`ac-inner border-2 ${approved ? "border-[#2F8F5B] bg-[#E3EFE6]" : "border-dashed border-[#9a968a]"}`}>
                  <Chip tone={approved ? "ok" : "neui"}>{approved ? t("aa.v.rev", { v: version }) : t("au.cmp.pending")}</Chip>
                  <p className="mt-2 text-sm">{!approved ? sel.item.rationale : sel.edited ? <DiffText draft={sel.item.rationale} reviewed={sel.rationale} side="reviewed" /> : sel.decision === "rejected" ? <b>{t("au.cmp.removed")}</b> : sel.item.rationale}</p>
                  {sel.comment && <p className="mt-2 text-xs"><b>{t("adv.comment")}:</b> {sel.comment}</p>}
                </div>
              </>
            )}
          </div>
          <p className="mt-3 text-sm text-muted">{t("aa.v.note")}</p>
        </Card>

        <div className="flex flex-col gap-4">
          <Card tone="dark" small className="!p-6">
            <h2 className="t-h4">{t("aa.integrity")}</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">{t("aa.entries")}</dt><dd><b>{trail?.chain.entries ?? "—"}</b></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">{t("aa.head")}</dt><dd className={`${mono} font-bold`}>{trail?.chain.head ? short(trail.chain.head) : "—"}</dd></div>
            </dl>
            <p className="mt-3 text-sm text-muted">{t("aa.integrity.note")}</p>
          </Card>
          <Card tone="dark" small className="!p-6">
            <h2 className="t-h4">{t("aa.approvals")}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {([["approved_demo", "aa.ap"], ["checklist_set", "aa.disc"], ["plan_requested", "aa.consent"]] as const).map(([action, key]) => {
                const n = entry(action);
                return <li key={action} className="flex items-center gap-2"><Check on={n !== undefined} /> {n !== undefined ? t(key, { n }) : `${t(key, { n: "—" })} · ${t("aa.none")}`}</li>;
              })}
            </ul>
          </Card>
          <p className="text-xs text-muted"><Link href="/compliance" className="und">{t("menu.compliance")}</Link></p>
        </div>
      </div>
    </div>
  );
}

export default function AdviserAudit() {
  return <AdviserCaseGate>{(c) => <Audit c={c} />}</AdviserCaseGate>;
}
