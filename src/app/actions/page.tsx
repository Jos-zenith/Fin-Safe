"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Chip, Crumb, MainSide, Meter, PageHead, useDocTitle, useToast } from "@/components/ds";
import { IntakeInput } from "@/components/IntakeInput";
import { Sheet } from "@/components/Sheet";
import { DraftWatermark } from "@/components/Watermark";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { planHref } from "@/lib/nav";
import { api } from "@/lib/workflow/client";
import type { AuditRec } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { UserProfile } from "@/types";

interface ActionView {
  id: string;
  findingId: string;
  severity: "high" | "medium" | "low";
  textKey: string;
  params: Record<string, string>;
  status: "suggested" | "planned" | "done" | "skipped";
  followupOn: string | null;
  active: boolean;
}
interface Payload {
  actions: ActionView[];
  changes: AuditRec[];
  caseStatus: string | null;
}
type Tab = "open" | "snoozed" | "done";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const inDays = (n: number) => iso(new Date(Date.now() + n * 86_400_000));

/**
 * The action center: planning steps for the top findings, as small reminders with a reason. Mark complete, snooze and
 * dismiss are first-class, and each can be undone. (Server states: suggested = open, planned = snoozed with a follow-up
 * date, done, skipped = dismissed.) Nothing here is an instruction to buy or sell.
 */
export default function Actions() {
  const { state, t, lang, update } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("open");
  const [type, setType] = useState("all");
  const [snoozing, setSnoozing] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [step, setStep] = useState<null | "savings" | "debts">(null);
  const [changed, setChanged] = useState<{ key: string; before: string; after: string }[] | null>(null);
  useDocTitle(t("ac.crumb"));

  useEffect(() => {
    if (state && !state.profile) router.replace("/");
  }, [state, router]);

  const load = useCallback(async () => {
    const r = await api<Payload>("GET", "me/actions");
    if (r.ok && r.data) {
      setData(r.data);
      setFailed(false);
    } else setFailed(true);
  }, []);
  const ready = wf.loaded && wf.role === "customer" && !!state?.profile;
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => void load(), 400); // after the profile has reached the server
    return () => window.clearTimeout(id);
  }, [ready, load, state?.profile]);

  const all = useMemo(() => data?.actions ?? [], [data]);
  const active = useMemo(() => all.filter((a) => a.active), [all]);
  const resolved = useMemo(() => all.filter((a) => !a.active), [all]);
  const counts = {
    open: active.filter((a) => a.status === "suggested").length,
    snoozed: active.filter((a) => a.status === "planned").length,
    done: active.filter((a) => a.status === "done" || a.status === "skipped").length,
  };
  const inTab = (a: ActionView) => (tab === "open" ? a.status === "suggested" : tab === "snoozed" ? a.status === "planned" : a.status === "done" || a.status === "skipped");
  const shown = active.filter(inTab).filter((a) => type === "all" || a.findingId === type);
  const types = [...new Set(active.map((a) => a.findingId))];

  if (!state?.profile || !wf.loaded) return null;
  const approved = data?.caseStatus === "APPROVED";
  const loc = lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "ta-IN";
  const dayText = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" });
  const c = wf.myCase;

  const setAction = async (a: ActionView, body: { status?: string; followupOn?: string | null }, msg: string) => {
    const before = { status: a.status, followupOn: a.followupOn };
    await api("POST", `me/actions/${a.id}`, body);
    await load();
    // every change can be undone: the toast puts the step back exactly as it was
    toast.show(msg, {
      label: t("ac.undo"),
      onClick: () => void api("POST", `me/actions/${a.id}`, { status: before.status, followupOn: before.followupOn }).then(() => load()),
    });
  };

  const saveProfile = async (next: UserProfile) => {
    update((s) => ({ ...s, touched: true, profile: next }));
    setStep(null);
    // the sync effect sends it; ask the server directly so the before / after can be shown right away
    const r = await api<{ changes: { key: string; before: string; after: string }[] }>("PUT", "me/profile", next);
    if (r.ok && r.data) setChanged(r.data.changes);
    await load();
  };
  const metric = (k: string) => t(`imp.metric.${k}`);
  const doneCount = counts.done;
  const total = active.length;

  return (
    <div className="ac-wrap pb-12">
      {data?.caseStatus && !approved && <DraftWatermark />}
      <Crumb items={[{ label: t("nav2.home"), href: "/dashboard" }, { label: t("ac.crumb") }]} />
      <PageHead
        title={t("ac.title")}
        sub={t("ac.counts", counts)}
        actions={
          <>
            <div role="group" aria-label={t("ac.crumb")} className="flex flex-wrap gap-2">
              {(["open", "snoozed", "done"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className="ac-chip ac-chip-neu min-h-11 px-4 text-[13px]" data-testid={`tab-${k}`}>
                  {t(`ac.tab.${k}`)}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="ac-type">{t("ac.filter.label")}</label>
            <select id="ac-type" value={type} onChange={(e) => setType(e.target.value)} className="ac-chip ac-chip-neu min-h-11 px-3 text-[13px]">
              <option value="all">{t("ac.filter")}</option>
              {types.map((k) => (
                <option key={k} value={k}>{t(`eflag.${k}`)}</option>
              ))}
            </select>
          </>
        }
      />

      {failed && !data && <p role="alert" className="mt-4 rounded-2xl border-2 border-[#F0A3A3] bg-[#2A1A1A] p-3 text-sm text-[#E8CFCF]">{t("ac.loadfail")}</p>}

      <MainSide
        className="mt-6"
        main={
          <>
            <Card className="!px-7 !py-3 max-md:!px-4" data-testid="actions-list">
              {shown.length === 0 ? (
                <div className="py-8 text-center">
                  <h2 className="t-h4">{tab === "open" ? t("ac.empty.title") : ""}</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted">{tab === "open" ? t("ac.empty.body") : tab === "snoozed" ? t("ac.empty.snoozed") : t("ac.empty.done")}</p>
                  {tab === "open" && <LinkBtn href="/dashboard" variant="secondary" small className="mt-4">{t("ac.plan.back")}</LinkBtn>}
                </div>
              ) : (
                <ol>
                  {shown.map((a) => (
                    <li key={a.id} data-testid={`action-${a.findingId}`} className="flex items-start gap-4 border-t border-line py-5 first:border-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={a.status === "done"}
                        aria-label={a.status === "done" ? t("imp.reopen") : t("ac.complete")}
                        onClick={() => void (a.status === "done" ? setAction(a, { status: "suggested" }, t("ac.t.back")) : setAction(a, { status: "done" }, t("ac.t.done")))}
                        className="mt-0.5 grid size-11 shrink-0 place-items-center"
                      >
                        <Check on={a.status === "done"} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <b className={`text-[17px] ${a.status === "done" || a.status === "skipped" ? "text-muted line-through" : ""}`}>{t(a.textKey, a.params)}</b>
                          <Chip tone={a.status === "planned" ? "info" : "warn"} data-testid="action-status">
                            {a.status === "planned" ? t("ac.returns", { date: a.followupOn ? dayText(a.followupOn) : "—" }) : a.status === "done" || a.status === "skipped" ? t(`imp.s.${a.status}`) : a.followupOn ? t("ac.due", { date: dayText(a.followupOn) }) : t("ac.noDue")}
                          </Chip>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Chip tone="neui">{t(`eflag.${a.findingId}`)}</Chip>
                          {data?.caseStatus ? (approved ? <Chip tone="ok">{t("ac.fromReviewed")}</Chip> : <Chip tone="warn">{t("ac.fromDraft")}</Chip>) : <Chip tone="neui">{t("ac.fromNone")}</Chip>}
                        </div>
                        <div className="ac-inner mt-3 text-sm">
                          <b>{t("ac.why")}</b>
                          <br />
                          {t("ac.whyBody", { flag: t(`eflag.${a.findingId}`) })}{" "}
                          <Link href="/dashboard" className="und">{t("ac.seeFigures")}</Link>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {a.status === "suggested" && (
                            <>
                              <Btn small onClick={() => void setAction(a, { status: "done" }, t("ac.t.done"))}>{t("ac.complete")}</Btn>
                              <Btn small variant="secondary" aria-expanded={snoozing === a.id} onClick={() => { setSnoozing(snoozing === a.id ? null : a.id); setDate(inDays(7)); }}>
                                {t("ac.snooze")} ▾
                              </Btn>
                              <Btn small variant="ghost" onClick={() => void setAction(a, { status: "skipped" }, t("ac.t.dismissed"))}>{t("ac.dismiss")}</Btn>
                            </>
                          )}
                          {a.status === "planned" && <Btn small variant="secondary" onClick={() => void setAction(a, { status: "suggested", followupOn: null }, t("ac.t.back"))}>{t("ac.bringBack")}</Btn>}
                          {(a.status === "done" || a.status === "skipped") && <Btn small variant="secondary" onClick={() => void setAction(a, { status: "suggested" }, t("ac.t.back"))}>{t("imp.reopen")}</Btn>}
                        </div>
                        {snoozing === a.id && (
                          <div className="ac-inner mt-3 flex flex-wrap items-end gap-2" role="group" aria-label={t("ac.snooze")}>
                            <Btn small variant="secondary" onClick={() => { const d = inDays(3); setSnoozing(null); void setAction(a, { status: "planned", followupOn: d }, t("ac.t.snoozed", { date: dayText(d) })); }}>{t("ac.snooze.3d")}</Btn>
                            <Btn small variant="secondary" onClick={() => { const d = inDays(7); setSnoozing(null); void setAction(a, { status: "planned", followupOn: d }, t("ac.t.snoozed", { date: dayText(d) })); }}>{t("ac.snooze.1w")}</Btn>
                            <label className="flex flex-col text-xs font-semibold">
                              {t("ac.snooze.pick")}
                              <input type="date" value={date} min={inDays(1)} onChange={(e) => setDate(e.target.value)} className="ac-field !min-h-11 !px-3 text-sm" />
                            </label>
                            <Btn small disabled={!date} onClick={() => { setSnoozing(null); void setAction(a, { status: "planned", followupOn: date }, t("ac.t.snoozed", { date: dayText(date) })); }}>{t("ac.snooze.apply")}</Btn>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            {resolved.length > 0 && (
              <ul className="flex flex-col gap-2" data-testid="resolved-actions">
                {resolved.map((a) => (
                  <li key={a.id} className="s-dark rounded-xl bg-[#16301F] p-3 text-sm text-[#CDEBD8]">
                    <b>{t(`eflag.${a.findingId}`)}</b> · {t("imp.resolved")}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">{t("imp.nudgeNote")}</p>
          </>
        }
        side={
          <>
            <Card tone="lime" small className="!p-6">
              <div className="num text-[2.75rem] leading-none">{t("ac.progress", { done: doneCount, total })}</div>
              <div className="t-h4 mt-2">{t("ac.progress.label")}</div>
              <Meter value={total ? doneCount / total : 0} tone="lime" className="mt-3" label={t("ac.progress.label")} />
              <div className="mt-2 text-xs text-muted">{t("ac.progress.note")}</div>
            </Card>
            <Card tone="lav" small className="!p-6">
              <h3 className="t-h4">{t("ac.calm.title")}</h3>
              <p className="mt-2 text-sm">{t("ac.calm.body")}</p>
            </Card>
            <Card tone="dark" small className="!p-6">
              <h3 className="t-h4">{t("ac.update.title")}</h3>
              <p className="mt-2 text-sm text-muted">{t("imp.updateSub")}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Btn variant="secondary" small onClick={() => setStep("savings")}>{t("imp.btn.savings")}</Btn>
                <Btn variant="secondary" small onClick={() => setStep("debts")}>{t("imp.btn.debts")}</Btn>
              </div>
              {changed && (
                <div className="mt-3 rounded-xl bg-[#2e2e2e] p-3" data-testid="before-after">
                  <p className="text-sm font-semibold">{t("imp.changes")}</p>
                  {changed.length === 0 ? (
                    <p className="text-sm text-muted">{t("imp.changesEmpty")}</p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-sm">
                      {changed.map((x) => (
                        <li key={x.key} className="flex flex-wrap items-center gap-1">
                          <span className="font-medium">{metric(x.key)}:</span>
                          <span className="num text-muted line-through">{x.before}</span>
                          <ArrowRight size={14} aria-hidden />
                          <span className="num font-bold">{x.after}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
            {(data?.changes ?? []).some((x) => x.action === "profile_updated") && (
              <Card tone="dark" small className="!p-6">
                <h3 className="t-h4">{t("ac.history")}</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {(data?.changes ?? []).filter((x) => x.action === "profile_updated").map((x) => (
                    <li key={`${x.chainId}-${x.seq}`} className="rounded-xl border border-[#383838] p-2">
                      <time dateTime={x.ts} className="num text-xs text-muted">{new Date(x.ts).toLocaleString(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                      <p><span className="font-semibold">{t("imp.before")}:</span> {x.before}</p>
                      <p><span className="font-semibold">{t("imp.after")}:</span> {x.after}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card tone="dark" small className="!p-6">
              <h3 className="t-h4">{t("ac.plan.title")}</h3>
              <div className="mt-3 flex flex-col gap-2">
                {c && <LinkBtn href={planHref(c)} variant="secondary" small block>{c.status === "APPROVED" ? t("ac.plan.reviewed") : t("ac.plan.status")}</LinkBtn>}
                {c && c.status !== "APPROVED" && <LinkBtn href={`/advice/${encodeURIComponent(c.id)}`} variant="secondary" small block>{t("ac.plan.draft")}</LinkBtn>}
                <LinkBtn href="/dashboard" variant="secondary" small block>{t("ac.plan.back")}</LinkBtn>
              </div>
            </Card>
          </>
        }
      />

      <Sheet open={step !== null} onClose={() => setStep(null)} title={step ? t(`intake.q.${step}`) : ""}>
        {step && state.profile && <IntakeInput key={step} step={step} p={state.profile} lang={lang} onNext={(p) => void saveProfile(p)} />}
      </Sheet>
    </div>
  );
}
