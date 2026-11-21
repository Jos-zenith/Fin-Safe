"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CaseGate } from "@/components/CaseGate";
import { Chip, Crumb, MainSide, Panel, Timeline, useDocTitle } from "@/components/ds";
import { Card, LinkBtn } from "@/components/ui";
import { caseRef } from "@/lib/nav";
import { useApp } from "@/store/AppProvider";
import type { Case } from "@/types";

function dateTime(iso: string | undefined, lang: string) {
  if (!iso) return "—";
  const loc = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
  return new Date(iso).toLocaleString(loc, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Body({ c }: { c: Case }) {
  const { t, lang } = useApp();
  const id = encodeURIComponent(c.id);
  const ref = caseRef(c.id);
  const generating = c.status === "INTAKE_DONE";
  const day = c.consent ? new Date(c.consent.at).toLocaleDateString(lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN") : "—";
  useDocTitle(`${t("rr.title.pre")} ${t("rr.title.hl")}`);

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("case.crumb"), href: `/case/${id}` }, { label: t("case.ref", { ref }), href: `/case/${id}` }, { label: `${t("rr.title.pre")} ${t("rr.title.hl").replace(".", "")}` }]} />
      <MainSide
        className="mt-3" cols="minmax(0,1.4fr) minmax(0,1fr)"
        main={
          <>
            {/* one clear confirmation with the case reference and time: the single lime block, one primary action */}
            <Card tone="lime" className="!p-12 max-md:!p-6" data-testid="review-requested">
              <span className="ac-ic !size-16 !border-char text-[30px]" aria-hidden>✓</span>
              <h1 className="t-display mt-6 text-[clamp(2.5rem,7vw,4rem)]">
                {t("rr.title.pre")} <span className="hl-dark">{t("rr.title.hl")}</span>
              </h1>
              <p className="mt-4 max-w-[560px] text-[1.1875rem] text-muted">{generating ? t("rr.lead.gen") : t("rr.lead")}</p>
              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
                <div>
                  <dt className="text-sm text-muted">{t("rr.ref")}</dt>
                  <dd className="num text-[1.625rem]">{ref}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">{t("rr.requested")}</dt>
                  <dd className="num text-[1.625rem]">{dateTime(c.createdAt, lang)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">{t("rr.status")}</dt>
                  <dd className="mt-1.5">
                    <Chip tone="ink">{t(`status.s.${c.status}`)}</Chip>
                  </dd>
                </div>
              </dl>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkBtn href={`/case/${id}`}>{t("case.view")}</LinkBtn>
                <LinkBtn href="/dashboard" variant="secondary">{t("rr.back")}</LinkBtn>
              </div>
            </Card>
            {/* the draft status is repeated in a separate dashed panel, not in small print */}
            <div className="s-dark ac-card ac-draft bg-[#2A2418]">
              <div className="flex flex-wrap items-center gap-3">
                <Chip tone="warn">{t("rr.still.chip")}</Chip>
                <b>{t("rr.still.title")}</b>
              </div>
              <p className="mt-2 text-sm text-[#F3E2B3]">{t("rr.still.body")}</p>
            </div>
          </>
        }
        side={
          <>
            <Card>
              <h2 className="t-h3">{t("rr.next.title")}</h2>
              <Timeline
                className="mt-4"
                items={[
                  { key: "1", title: t("rr.next.1"), meta: t("rr.next.1d"), state: "now" },
                  { key: "2", title: t("rr.next.2"), meta: t("rr.next.2d") },
                  { key: "3", title: t("rr.next.3"), meta: t("rr.next.3d") },
                  { key: "4", title: t("rr.next.4") },
                ]}
              />
              <p className="mt-3 text-xs text-muted">{t("rr.next.noeta")}</p>
            </Card>
            <Panel tone="dark" title={t("rr.while.title")} className="!p-6">
              <div className="flex flex-col gap-3">
                <LinkBtn href="/second-opinion" variant="secondary" block>{t("rr.while.check")}</LinkBtn>
                <LinkBtn href="/learn" variant="secondary" block>{t("rr.while.learn")}</LinkBtn>
                <LinkBtn href="/actions" variant="secondary" block>{t("rr.while.actions")}</LinkBtn>
              </div>
            </Panel>
            <Card tone="lav" small className="!p-6">
              <div className="t-h4">{t("rr.fee.title")}</div>
              <p className="mt-2 text-sm">{t("rr.fee.body", { date: day })}</p>
              <Link href="/transparency" className="und mt-2 inline-block min-h-11 text-sm">{t("nav2.earn")}</Link>
            </Card>
          </>
        }
      />
    </div>
  );
}

export default function ReviewRequested() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useApp();
  return (
    <CaseGate caseId={decodeURIComponent(caseId)} crumb={`${t("rr.title.pre")} ${t("rr.title.hl").replace(".", "")}`}>
      {(c) => <Body c={c} />}
    </CaseGate>
  );
}
