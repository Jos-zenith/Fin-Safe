"use client";
import { ArrowLeft, BadgeCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { ASSUMPTIONS, statusOf } from "@/config/assumptions";
import { groupOf } from "@/config/assumptionGroups";
import { Btn, Card, Page } from "@/components/ui";
import { formatValue } from "@/lib/format";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Unit } from "@/types";


/** Plain-language list of every assumption behind the numbers. Public: anyone can see what is unverified. */
export default function Assumptions() {
  const { t, reviews } = useApp();
  const wf = useWorkflow();
  const groups = [...new Set(ASSUMPTIONS.map((a) => groupOf(a.id)))];
  const open = ASSUMPTIONS.filter((a) => !a.notModelled && statusOf(a.id, reviews) === "unverified").length;
  return (
    <Page size="lg">
      <Link href="/dashboard" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft size={16} aria-hidden /> {t("common.back")}
      </Link>
      <h1 className="text-2xl font-bold">{t("assump.title")}</h1>
      <p className="mt-1 text-muted">{t("assump.sub")}</p>
      <p role="status" className="mt-3 rounded-xl bg-draft-soft p-3 text-sm font-medium text-draft" data-testid="assump-summary">
        {t("assump.summary", { open, total: ASSUMPTIONS.filter((a) => !a.notModelled).length })}
      </p>
      <p className="mt-2 text-xs text-muted">{t("assump.english")}</p>
      {wf.role === "adviser" && (
        <p className="mt-2 rounded-xl bg-primary-soft p-3 text-sm" data-testid="assump-adviser-note">
          {t("assump.adviserNote")}
        </p>
      )}

      {groups.map((g) => (
        <section key={g} className="mt-6">
          <h2 className="mb-2 text-lg font-bold">{t(g)}</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {ASSUMPTIONS.filter((a) => groupOf(a.id) === g).map((a) => {
              const reviewed = statusOf(a.id, reviews) === "reviewed";
              const r = reviews[a.id];
              return (
                <li key={a.id} id={a.id}>
                  <Card className={a.notModelled ? "border-draft/40" : ""}>
                    <div className="flex items-start justify-between gap-2">
                      <code className="text-xs text-muted">{a.id}</code>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${a.notModelled ? "bg-line text-muted" : reviewed ? "bg-reviewed-soft text-reviewed" : "bg-draft-soft text-draft"}`}
                      >
                        {a.notModelled ? t("assump.notModelled") : reviewed ? <BadgeCheck size={12} aria-hidden /> : <TriangleAlert size={12} aria-hidden />}
                        {a.notModelled ? "" : reviewed ? t("assump.reviewed") : t("assump.unverified")}
                      </span>
                    </div>
                    <p className="mt-1 font-medium">{a.description}</p>
                    {!a.notModelled && (
                      <p className="num mt-1 text-2xl font-bold">{a.unit === "none" ? a.value : formatValue(a.value, a.unit as Unit)}</p>
                    )}
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                      <dt>{t("assump.source")}</dt>
                      <dd className="text-fg">{a.source}</dd>
                      <dt>{t("assump.asOf")}</dt>
                      <dd className="text-fg">{a.asOf}</dd>
                      <dt>{t("assump.applies")}</dt>
                      <dd className="text-fg">{a.applicability}</dd>
                      <dt>{t("assump.confidence")}</dt>
                      <dd className="text-fg">{a.confidence}</dd>
                      {reviewed && r && (
                        <>
                          <dt>{t("assump.reviewedBy")}</dt>
                          <dd className="text-fg">
                            {r.by} · {r.on}
                          </dd>
                        </>
                      )}
                    </dl>
                    {wf.role === "adviser" && !a.notModelled && !reviewed && (
                      <Btn variant="soft" className="mt-3 min-h-11 w-full text-sm" onClick={() => void wf.reviewAssumption(a.id)}>
                        {t("assump.markReviewed")}
                      </Btn>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Page>
  );
}
