"use client";
// The adviser's working state for one case. This is the logic that used to live inside the single adviser screen, moved
// here unchanged so the review, copilot, approval and audit pages can share it: opening a waiting case CLAIMS it on the
// server (exactly one adviser can win), the copilot is drafted once the case is mine, and a checklist tick shows at once
// but only counts after the server confirms it.
import { useEffect, useMemo, useState } from "react";
import { CHECKLIST_IDS, checklistComplete, reviewedItems } from "@/lib/cases";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case } from "@/types";

export type ActResult = { ok: boolean; error?: string };

export function useCaseWork(c: Case) {
  const { t, lang } = useApp();
  const wf = useWorkflow();
  const [err, setErr] = useState<string | null>(null);
  const approved = c.status === "APPROVED";
  const mine = c.claimedBy?.id === wf.me?.id;
  const heldByOther = !!c.claimedBy && !mine;
  const canAct = mine && c.status === "IN_REVIEW";
  const rows = useMemo(() => reviewedItems(c), [c]);

  const said = (code?: string) =>
    code === "already_claimed"
      ? t("adv.err.claimed")
      : code && ["items_pending", "risk_not_confirmed", "risk_incomplete", "consent_missing"].includes(code)
        ? t(`adv.err.${code}`)
        : code
          ? t("adv.err.generic")
          : null;

  // Opening a waiting case CLAIMS it on the server. Exactly one adviser can win the claim.
  useEffect(() => {
    if (c.status !== "DRAFT_READY") return;
    let live = true;
    wf.claim(c.id).then((r) => live && setErr(r.ok ? null : said(r.error)));
    return () => {
      live = false;
    };
    // the case can return to the queue while it is open (the customer replied), so claim again whenever it is waiting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, c.status]);

  // Copilot: drafted on the server once the case is mine.
  useEffect(() => {
    if (c.copilot || !canAct) return;
    void wf.copilot(c.id, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, canAct, lang]);

  const act = async (p: Promise<ActResult>) => {
    const r = await p;
    setErr(r.ok ? null : said(r.error));
    return r;
  };

  // A tick shows at once and is sent to the server. It stays in force until the case the server sends is NEWER than the
  // one the tick was made on (every change bumps the version), so a poll that was already in flight, carrying the older
  // state, cannot un-tick the box. Approve waits for the server.
  const [opt, setOpt] = useState<Record<string, { value: boolean; v: number }>>({});
  const tickPending = (id: string) => {
    const o = opt[id];
    return o && (c.version ?? 0) <= o.v ? o : undefined;
  };
  const on = (id: string) => tickPending(id)?.value ?? !!c.checklist[id];
  const tick = async (id: string) => {
    const next = !on(id);
    setOpt((o) => ({ ...o, [id]: { value: next, v: c.version ?? 0 } }));
    const r = await act(wf.setChecklist(c.id, id, next));
    if (!r.ok) setOpt((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== id)));
  };
  const saving = CHECKLIST_IDS.some((id) => tickPending(id) !== undefined);
  // every plan item needs a decision (accept, edit or reject) before Approve is possible, and the server enforces it too
  const pending = rows.filter((r) => r.decision === "pending").length;
  const ticked = CHECKLIST_IDS.filter((id) => on(id)).length;
  const done = checklistComplete(c) && !saving && pending === 0;

  return { err, setErr, approved, mine, heldByOther, canAct, rows, act, said, on, tick, saving, pending, ticked, total: CHECKLIST_IDS.length, done };
}
