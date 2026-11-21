"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdviserCaseGate } from "@/components/AdviserGate";
import { Chip, Crumb, Meter, PageHead, useDocTitle, useToast } from "@/components/ds";
import { Legal } from "@/components/Legal";
import { Sheet } from "@/components/Sheet";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { CHECKLIST_IDS } from "@/config/workflow";
import { caseRef } from "@/lib/nav";
import { useCaseWork } from "@/lib/useCaseWork";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case } from "@/types";

function Approve({ c }: { c: Case }) {
  const { t } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const toast = useToast();
  const w = useCaseWork(c);
  const [confirm, setConfirm] = useState(false);
  const id = encodeURIComponent(c.id);
  const ref = caseRef(c.id);
  const remaining = w.total - w.ticked;
  const count = (k: string) => w.rows.filter((r) => r.decision === k).length;
  // a check the server would refuse is shown as blocked, with the reason, instead of failing quietly
  const blockedReason = (cid: string) => (cid === "risk" && !c.risk ? t("ap.blocked.risk") : (cid === "conflicts" || cid === "fee") && !c.consent ? t("ap.blocked.consent") : null);
  useDocTitle(t("ap.title", { ref }));

  const approve = async () => {
    setConfirm(false);
    const r = await w.act(wf.approve(c.id));
    if (r.ok) {
      toast.show(t("ap.toast"));
      router.push(`/adviser/case/${id}/audit`);
    }
  };

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.cases"), href: "/adviser" }, { label: t("case.ref", { ref }), href: `/adviser/case/${id}` }, { label: t("cr.crumb"), href: `/adviser/case/${id}` }, { label: t("ap.crumb") }]} />
      <PageHead title={t("ap.title", { ref })} sub={t("ap.sub")} actions={<LinkBtn href={`/adviser/case/${id}`} variant="secondary" small>{t("cp.back")}</LinkBtn>} />
      {w.err && <p role="alert" className="mt-4 rounded-2xl border-2 border-[#F0A3A3] bg-[#2A1A1A] p-3 text-sm font-semibold text-[#F0A3A3]">{w.err}</p>}
      {w.approved && <p role="status" className="mt-4 rounded-2xl bg-[#16301F] p-3 text-sm font-semibold text-[#CDEBD8]">{t("ap.readonly")}</p>}
      {!w.approved && !w.canAct && <p role="status" className="mt-4 rounded-2xl bg-[#2A2418] p-3 text-sm font-semibold text-[#F3E2B3]">{t("ap.notyours")}</p>}

      <div className="mt-6 grid items-start gap-6 wd:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="!px-7 !py-3 max-md:!px-4" data-testid="checklist">
          <ul>
            {CHECKLIST_IDS.map((cid) => {
              const on = w.on(cid);
              const blocked = !on ? blockedReason(cid) : null;
              const editable = w.canAct && !w.approved;
              return (
                <li key={cid} className={`flex items-start gap-4 py-[18px] ${blocked ? "-mx-4 rounded-[14px] bg-[#F6E4E1] px-4" : "border-t border-line first:border-0"}`}>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-4" style={{ minHeight: 44 }}>
                    <input type="checkbox" checked={on} disabled={!editable} onChange={() => void w.tick(cid)} className="ac-check mt-0.5 !size-[26px]" />
                    <span className="min-w-0 flex-1">
                      <b className="block">{cid === "demo_ack" ? <Legal k="ack" /> : t(`adv.check.${cid}`)}</b>
                      {cid !== "demo_ack" && <span className="block text-sm text-muted">{t(`ap.d.${cid}`)}</span>}
                      {blocked && <span className="ac-err mt-2 block">{blocked}</span>}
                    </span>
                  </label>
                  <Chip tone={on ? "ok" : blocked ? "err" : "warn"}>{on ? t("ap.done") : blocked ? t("ap.blocked") : t("ap.open")}</Chip>
                </li>
              );
            })}
          </ul>
        </Card>

        <aside className="flex flex-col gap-4 wd:sticky wd:top-28">
          <Card tone="lime" small className="!p-6">
            <div className="num text-[3.25rem] leading-none" data-testid="check-count">{t("ap.count", { n: w.ticked, total: w.total })}</div>
            <div className="t-h4 mt-2">{t("ap.count.label")}</div>
            <Meter value={w.ticked / w.total} tone="lime" className="mt-3" label={t("ap.count.label")} />
            <Btn block className="mt-5" disabled={!w.done || !w.canAct || w.approved} onClick={() => setConfirm(true)} aria-describedby="approve-hint" data-testid="approve">
              {t("adv.approve")}
            </Btn>
            <p id="approve-hint" className="mt-2 text-xs text-muted">
              {w.pending > 0 ? t("adv.pending", { n: w.pending }) : remaining > 0 ? t("ap.remain", { n: remaining }) : ""}
            </p>
            <LinkBtn href={`/adviser/case/${id}`} variant="secondary" block className="mt-3">{t("cr.btn.return")}</LinkBtn>
            <LinkBtn href="/adviser" variant="ghost" block className="mt-2">{t("ap.save")}</LinkBtn>
          </Card>
          <Card small className="!p-6">
            <h2 className="t-h4">{t("ap.evidence")}</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex justify-between"><dt>{t("ap.ev.accepted")}</dt><dd><b>{count("accepted")}</b></dd></div>
              <div className="flex justify-between"><dt>{t("ap.ev.edited")}</dt><dd><b>{count("edited")}</b></dd></div>
              <div className="flex justify-between"><dt>{t("ap.ev.removed")}</dt><dd><b>{count("rejected")}</b></dd></div>
              <div className="flex justify-between"><dt>{t("ap.ev.pending")}</dt><dd><b>{count("pending")}</b></dd></div>
            </dl>
          </Card>
        </aside>
      </div>

      {/* the confirmation says what approval does: it creates an audit entry that cannot be changed */}
      <Sheet open={confirm} onClose={() => setConfirm(false)} title={t("ap.confirm.title")}>
        <p className="rounded-xl bg-[#2A2418] p-3 font-medium text-[#F3E2B3]"><Legal k="demoWorkflow" /></p>
        <p className="mt-3 text-sm text-muted">{t("ap.confirm.body", { v: c.planVersion ?? 1, ref })}</p>
        <p className="mt-2 text-sm text-muted">{t("adv.confirmUndecided")}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Btn variant="secondary" autoFocus onClick={() => setConfirm(false)}>{t("common.cancel")}</Btn>
          <Btn variant="lime" onClick={() => void approve()}>{t("adv.approve")}</Btn>
        </div>
      </Sheet>
    </div>
  );
}

export default function ApprovePage() {
  return <AdviserCaseGate>{(c) => <Approve c={c} />}</AdviserCaseGate>;
}
