"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdviserGate } from "@/components/AdviserGate";
import { Chip, Crumb, PageHead, useDocTitle, type ChipTone } from "@/components/ds";
import { Btn, Card, Empty, LinkBtn } from "@/components/ui";
import { runEngine } from "@/lib/engine";
import { caseRef } from "@/lib/nav";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case } from "@/types";
import { ClipboardCheck } from "lucide-react";

type StatusFilter = "all" | "review" | "changes";
type PriorityFilter = "any" | "high" | "normal";
const STATUS_TONE: Record<Case["status"], ChipTone> = { INTAKE_DONE: "neui", DRAFT_READY: "warn", IN_REVIEW: "warn", CHANGES_REQUESTED: "info", APPROVED: "ok" };

const sameDay = (iso: string | undefined) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

function Console() {
  const { t, lang } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const view = useSearchParams().get("view");
  const mineOnly = view === "mine";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("any");
  const [language, setLanguage] = useState("all");
  useDocTitle(t(mineOnly ? "ad.titleMine" : "ad.title"));

  const queue = wf.queue;
  const pool = mineOnly ? queue.filter((c) => c.claimedBy?.id === wf.me?.id) : queue;
  const loc = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
  const age = (c: Case) => {
    const m = c.waitingMinutes ?? Math.max(0, Math.round((Date.now() - new Date(c.createdAt).getTime()) / 60000));
    return m < 60 ? t("ad.age.min", { n: m }) : m < 1440 ? t("ad.age.hour", { n: Math.round(m / 60) }) : t("ad.age.day", { n: Math.round(m / 1440) });
  };
  const when = (c: Case) => new Date(c.updatedAt).toLocaleString(loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const action = (c: Case) =>
    c.status === "APPROVED"
      ? t("ad.act.none")
      : c.status === "CHANGES_REQUESTED"
        ? t("ad.act.waiting")
        : c.claimedBy && c.claimedBy.id !== wf.me?.id
          ? t("ad.act.heldBy", { name: c.claimedBy.name })
          : c.overdue
            ? t("ad.act.overdue")
            : c.claimedBy
              ? t("ad.act.progress")
              : t("ad.act.claim");
  // the top flag of the case, in words, next to a high priority (text as well as colour)
  const topFlag = (c: Case) => runEngine(c.profile).flags.find((f) => f.severity === "high");

  const counts = {
    pending: queue.filter((c) => c.status === "DRAFT_READY" || c.status === "IN_REVIEW").length,
    overdue: queue.filter((c) => c.overdue && c.status !== "APPROVED").length,
    changes: queue.filter((c) => c.status === "CHANGES_REQUESTED").length,
    approved: queue.filter((c) => c.status === "APPROVED" && sameDay(c.reviewedAt)).length,
  };

  const languages = [...new Set(queue.map((c) => c.profile.language))];
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pool.filter((c) => {
      if (status === "review" && !(c.status === "DRAFT_READY" || c.status === "IN_REVIEW")) return false;
      if (status === "changes" && c.status !== "CHANGES_REQUESTED") return false;
      const high = c.urgent || !!c.flags?.some((f) => f.severity === "high");
      if (priority === "high" && !high) return false;
      if (priority === "normal" && high) return false;
      if (language !== "all" && c.profile.language !== language) return false;
      if (!needle) return true;
      return `${caseRef(c.id)} ${c.profile.name} ${c.status}`.toLowerCase().includes(needle);
    });
  }, [pool, q, status, priority, language]);

  const next = queue.find((c) => c.status === "DRAFT_READY" && !c.claimedBy) ?? queue.find((c) => c.status === "DRAFT_READY");
  const recent = [...queue].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  const firstAudit = queue[0]?.id;

  const exportList = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ["case", "client", "status", "priority", "language", "age", "assigned", "action", "updated"].join(",");
    const body = rows.map((c) => [caseRef(c.id), c.profile.name, c.status, c.urgent ? "high" : "normal", c.profile.language, age(c), c.claimedBy?.name ?? "", action(c), c.updatedAt].map((v) => esc(String(v))).join(","));
    const blob = new Blob([[head, ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cases.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const priorityChip = (c: Case) => {
    const f = topFlag(c);
    return c.urgent || f ? <Chip tone="err">{t("ad.f.high")}{f ? ` · ${t(`eflag.${f.id}`)}` : ""}</Chip> : c.status === "APPROVED" ? <Chip tone="neui">{t("ad.status.closed")}</Chip> : <Chip tone="lav">{t("ad.f.normal")}</Chip>;
  };

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("ad.crumb") }, { label: t(mineOnly ? "ad.titleMine" : "ad.title") }]} />
      <PageHead
        title={t(mineOnly ? "ad.titleMine" : "ad.title")}
        sub={t("ad.sub")}
        actions={
          <>
            <Btn variant="secondary" small onClick={exportList} disabled={!rows.length}>{t("ad.export")}</Btn>
            <Btn variant="lime" small disabled={!next} onClick={() => next && router.push(`/adviser/case/${encodeURIComponent(next.id)}`)}>{t("ad.next")}</Btn>
          </>
        }
      />

      {/* four counts only, each one says it is demo data */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="kpis">
        {([
          ["pending", counts.pending, t("ad.k.demo"), null],
          ["overdue", counts.overdue, null, counts.overdue ? <Chip key="c" tone="warn">{t("ad.k.needs")}</Chip> : null],
          ["changes", counts.changes, t("ad.k.waiting"), null],
          ["approved", counts.approved, t("ad.k.demo"), null],
        ] as const).map(([k, n, note, chip]) => (
          <div key={k} className="s-dark rounded-[20px] border border-[#383838] bg-[#242424] px-5 py-[18px]">
            <div className="t-label">{t(`ad.k.${k}`)}</div>
            <div className="num text-[2.75rem] leading-[1.15]">{n}</div>
            {note && <div className="text-xs text-muted">{note}</div>}
            {chip}
          </div>
        ))}
      </div>

      <Card className="mt-6 !p-6 max-md:!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative flex min-w-[260px] max-w-[420px] flex-1 items-center">
            <Search size={16} className="pointer-events-none absolute left-4 text-muted" aria-hidden />
            <span className="sr-only">{t("ad.search")}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ad.search")} className="ac-field !min-h-11 !pl-10 text-sm" />
          </label>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2" role="group" aria-label={t("ad.f.status")}>
            <span className="t-label">{t("ad.f.status")}</span>
            {(["all", "review", "changes"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)} className="ac-chip ac-chip-neui min-h-11 px-3.5">
                {k === "all" ? t("ad.f.all") : k === "review" ? t("ad.f.review") : t("ad.k.changes")}
              </button>
            ))}
            <span className="t-label ml-2">{t("ad.f.priority")}</span>
            {(["high", "normal"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={priority === k} onClick={() => setPriority(priority === k ? "any" : k)} className="ac-chip ac-chip-neui min-h-11 px-3.5">
                {k === "high" ? t("ad.f.high") : t("ad.f.normal")}
              </button>
            ))}
            <label className="t-label ml-2 flex items-center gap-2">
              {t("ad.f.lang")}
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="ac-chip ac-chip-neui min-h-11 px-3">
                <option value="all">{t("ad.f.all")}</option>
                {languages.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </label>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="mt-6"><Empty icon={<ClipboardCheck size={26} />} title={t("adv.empty")} body={t("adv.emptyBody")} /></div>
        ) : rows.length === 0 ? (
          <p className="ac-ph mt-6 p-6 text-center text-sm" role="status">{t("ad.none.filter")}</p>
        ) : (
          <>
            {/* a professional table from a tablet up; one card per case on a phone */}
            <div className="ac-scrollx mt-4 max-md:hidden">
              <table className="ac-tbl min-w-[1000px]" data-testid="case-table">
                <thead>
                  <tr>
                    {(["case", "client", "status", "priority", "lang", "age", "assigned", "action", "updated"] as const).map((h) => <th key={h} scope="col">{t(`ad.h.${h}`)}</th>)}
                    <th scope="col"><span className="sr-only">{t("ad.open")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const mine = c.claimedBy?.id === wf.me?.id;
                    const readOnly = c.status === "APPROVED" || (!!c.claimedBy && !mine);
                    return (
                      <tr key={c.id} data-testid={`row-${c.id}`} className="text-[13.5px]">
                        <td><b>{caseRef(c.id)}</b></td>
                        <td>{c.profile.name || t("intake.friend")} {c.profile.isSynthetic && <Chip tone="neui" className="!min-h-5 !px-2 text-[10px]">{t("ad.synthetic")}</Chip>}</td>
                        <td><Chip tone={STATUS_TONE[c.status]}>{t(`status.s.${c.status}`)}</Chip></td>
                        <td>{priorityChip(c)}</td>
                        <td>{c.profile.language.toUpperCase()}</td>
                        <td className="whitespace-nowrap" data-testid={`sla-${c.id}`}>{age(c)}{c.overdue && c.status !== "APPROVED" ? ` · ${t("ad.k.needs")}` : ""}</td>
                        <td className={c.claimedBy ? "" : "text-muted"}>{c.claimedBy?.name ?? t("ad.unassigned")}</td>
                        <td>{action(c)}</td>
                        <td className="whitespace-nowrap">{when(c)}</td>
                        <td><LinkBtn href={`/adviser/case/${encodeURIComponent(c.id)}`} small variant={readOnly ? "secondary" : "primary"}>{c.status === "APPROVED" ? t("ad.view") : t("ad.open")}</LinkBtn></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="mt-4 flex flex-col gap-3 md:hidden">
              {rows.map((c) => (
                <li key={c.id} className="ac-inner">
                  <div className="flex items-start justify-between gap-3">
                    <div><b>{caseRef(c.id)} · {c.profile.name || t("intake.friend")}</b><div className="text-xs text-muted">{age(c)} · {c.profile.language.toUpperCase()}</div></div>
                    <Chip tone={STATUS_TONE[c.status]}>{t(`status.s.${c.status}`)}</Chip>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">{priorityChip(c)}</div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted">{t("ad.h.assigned")}</dt><dd>{c.claimedBy?.name ?? t("ad.unassigned")}</dd>
                    <dt className="text-muted">{t("ad.h.action")}</dt><dd>{action(c)}</dd>
                    <dt className="text-muted">{t("ad.h.updated")}</dt><dd>{when(c)}</dd>
                  </dl>
                  <LinkBtn href={`/adviser/case/${encodeURIComponent(c.id)}`} small block className="mt-3">{c.status === "APPROVED" ? t("ad.view") : t("ad.open")}</LinkBtn>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-3 text-sm text-muted">{t("ad.showing", { n: rows.length, total: pool.length })}</p>
      </Card>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Card tone="dark" small className="!p-6">
          <h2 className="t-h4">{t("ad.recent")}</h2>
          <ol className="ac-tl mt-4 text-sm">
            {recent.map((c) => (
              <li key={c.id} className="ac-ev ac-ev-done" style={{ paddingBottom: 16 }}>
                <b>{caseRef(c.id)}</b> {c.status === "APPROVED" ? t("ad.recent.approved") : c.status === "CHANGES_REQUESTED" ? t("ad.recent.returned") : t("ad.recent.submitted")} <span className="text-muted">{when(c)}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card tone="dark" small className="!p-6">
          <h2 className="t-h4">{t("ad.short")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkBtn href="/adviser?view=mine" variant="secondary" small>{t("ad.short.queue")}</LinkBtn>
            <LinkBtn href="/assumptions" variant="secondary" small>{t("ad.short.assump")}</LinkBtn>
            {firstAudit && <LinkBtn href={`/adviser/case/${encodeURIComponent(firstAudit)}/audit`} variant="secondary" small>{t("ad.short.audit")}</LinkBtn>}
            <LinkBtn href="/metrics" variant="secondary" small>{t("ad.short.metrics")}</LinkBtn>
          </div>
          <p className="mt-4 text-sm text-muted">{t("ad.short.note")}</p>
        </Card>
      </div>
      <p className="mt-6 text-xs text-muted"><Link href="/settings" className="und">{t("nav2.settings")}</Link></p>
    </div>
  );
}

export default function Adviser() {
  return (
    <AdviserGate>
      {/* the console reads ?view=mine, which needs a Suspense boundary */}
      <Suspense fallback={null}>
        <Console />
      </Suspense>
    </AdviserGate>
  );
}
