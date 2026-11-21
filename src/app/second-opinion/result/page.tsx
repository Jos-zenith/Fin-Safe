"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Chip, Crumb, MainSide, PageHead, useDocTitle, type ChipTone } from "@/components/ds";
import { SourceTag } from "@/components/SourceTag";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { appendMissed, readMissed } from "@/lib/missedScams";
import { resetOpinion, useOpinion } from "@/lib/opinionStore";
import { inspectLinks, LINK_REASON_TEXT } from "@/lib/scam/urls";
import { browserStores } from "@/lib/storage";
import { useApp } from "@/store/AppProvider";

type Sev = "low" | "medium" | "high";
// "low" is deliberately NOT a green tick: nothing found is not the same as safe
const SEV_CHIP: Record<Sev, ChipTone> = { high: "err", medium: "warn", low: "info" };

/** The pasted message with each flagged quote marked: filled, underlined and numbered, so it reads without colour. */
function Marked({ text, quotes }: { text: string; quotes: string[] }) {
  const spans: { a: number; b: number; n: number }[] = [];
  quotes.forEach((q, i) => {
    const at = q ? text.indexOf(q) : -1;
    if (at >= 0) spans.push({ a: at, b: at + q.length, n: i + 1 });
  });
  spans.sort((x, y) => x.a - y.a);
  const merged: { a: number; b: number; n: number }[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.a <= last.b) last.b = Math.max(last.b, s.b);
    else merged.push({ ...s });
  }
  const out: React.ReactNode[] = [];
  let pos = 0;
  merged.forEach((m, i) => {
    out.push(<Fragment key={`t${i}`}>{text.slice(pos, m.a)}</Fragment>);
    out.push(
      <mark key={`m${i}`} className="rounded bg-[#F0C4C4] px-1 py-px font-semibold text-[#4A0F0F] underline decoration-2 underline-offset-2">
        {text.slice(m.a, m.b)}
        <sup className="ml-0.5 text-[10px] font-extrabold">{m.n}</sup>
      </mark>,
    );
    pos = m.b;
  });
  out.push(<Fragment key="end">{text.slice(pos)}</Fragment>);
  return <>{out}</>;
}

export default function Result() {
  const { state, t, lang } = useApp();
  const router = useRouter();
  const { res } = useOpinion();
  const [reported, setReported] = useState<number | null>(null);
  const links = useMemo(() => (res ? inspectLinks(res.shown) : []), [res]);
  useDocTitle(t("so.r.title"));

  // with no result in memory (a reload, or a direct link) there is nothing to show: go back to the form
  useEffect(() => {
    if (!res) router.replace("/second-opinion");
  }, [res, router]);

  if (!res) {
    return (
      <div className="ac-wrap pb-12" role="status">
        <p className="ac-ph mt-8 p-6 text-center">{t("so.r.expired")}</p>
      </div>
    );
  }
  const out = res.out;
  const high = out.flags.filter((f) => f.severity === "high").length;
  const medium = out.flags.filter((f) => f.severity === "medium").length;
  const found = out.flags.length === 0 ? t("check.found.none") : out.flags.length === 1 ? t("check.found.one") : t("check.found.n", { n: out.flags.length });
  const report = () => {
    const n = appendMissed(res.shown, lang, out.overall, browserStores());
    setReported(n || readMissed(browserStores()).length);
  };
  const again = () => {
    resetOpinion();
    router.push("/second-opinion");
  };
  const askReviewer = state?.profile && state.intakeDone ? "/dashboard" : "/intake";

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.second"), href: "/second-opinion" }, { label: t("so.r.title") }]} />
      <PageHead
        title={t("so.r.title")}
        actions={
          <>
            <Chip tone="info">EDUCATION</Chip>
            <Btn variant="secondary" small onClick={again}>{t("so.r.another")}</Btn>
          </>
        }
      />

      <MainSide
        className="mt-6"
        main={
          <>
            {/* a calm burgundy block, not alarming red: "warning signs we detected", never a percentage chance of fraud */}
            <Card tone="burg" className="!p-9 max-md:!p-5" aria-live="polite">
              <div className="flex flex-wrap items-center gap-4">
                <span className="ac-ic !size-14 text-[26px] font-extrabold text-[#F0A3A3]" aria-hidden>!</span>
                <div className="min-w-0">
                  <div className="t-label">{t("so.r.assess")}</div>
                  <div className="t-h1 !text-[clamp(1.5rem,3.4vw,2.25rem)]" data-testid="overall">{t(`check.risk.${out.overall}`)}</div>
                </div>
                {out.flags.length > 0 && <Chip tone={SEV_CHIP[out.overall]} className="sm:ml-auto">{t("so.r.counts", { high, medium })}</Chip>}
              </div>
              <p className="mt-4 text-base" data-testid="check-found">{found}</p>
              <p className="mt-2 max-w-[720px] text-[17px]">{out.summary}</p>
            </Card>

            <Card>
              <div className="t-label !text-fg">{t("so.r.marked")}</div>
              <p className="ac-inner mt-3 whitespace-pre-wrap text-base leading-[1.7]">
                <Marked text={res.shown} quotes={out.flags.map((f) => f.quote)} />
              </p>
              <p className="mt-2 text-xs text-muted">{t("so.r.markedNote")}</p>
            </Card>

            {out.flags.length > 0 && (
              <Card>
                <h2 className="t-h3">{t("so.r.signs")}</h2>
                <ol className="mt-2">
                  {out.flags.map((f, i) => (
                    <li key={f.type} className={`py-4 ${i ? "border-t border-line" : ""}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="num grid size-6 place-items-center rounded-full bg-char text-xs text-lime" aria-hidden>{i + 1}</span>
                          <b>{t(`flag.${f.type}`)}</b>
                        </div>
                        <Chip tone={SEV_CHIP[f.severity]}>{t(`sev.${f.severity}`).toUpperCase()}</Chip>
                      </div>
                      {f.quote && <blockquote className="mt-2 inline-block rounded bg-[#F0C4C4] px-1.5 py-0.5 text-sm text-[#4A0F0F]">“{f.quote}”</blockquote>}
                      <p className="mt-2 text-sm text-muted">{f.explanation}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <Card tone="lav" small className="!p-6">
                <h3 className="t-h4">{t("so.r.questions")}</h3>
                <ul className="mt-3 flex flex-col gap-2 text-sm">{out.questions.map((q) => <li key={q}>• {q}</li>)}</ul>
              </Card>
              {out.overall !== "low" && (
                <Card tone="dark" small className="!p-6" data-testid="check-verify">
                  <h3 className="t-h4">{t("check.verify.title")}</h3>
                  <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-muted">{[1, 2, 3, 4].map((n) => <li key={n}>{t(`check.verify.${n}`)}</li>)}</ol>
                </Card>
              )}
            </div>

            {/* the limits are stated on the result itself, not on another page */}
            <Card small className="!p-6" data-testid="check-limits">
              <h3 className="t-h4">{t("check.couldNot.title")}</h3>
              <p className="mt-2 text-sm text-muted">{t("check.uncertainty")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">{[1, 2, 3, 4].map((n) => <li key={n}>{t(`check.couldNot.${n}`)}</li>)}</ul>
            </Card>

            {links.length > 0 && (
              <Card small className="!p-6" data-testid="check-links">
                <h3 className="t-h4">{t("check.links.title")}</h3>
                <ul className="mt-3 space-y-2">
                  {links.map((l) => (
                    <li key={l.raw} className="ac-inner text-sm">
                      <p className="break-all font-mono text-xs">{l.raw}</p>
                      <p className="mt-1 font-semibold">{l.level === "none" ? t("check.links.none") : t(`check.links.${l.level}`)}</p>
                      {l.reasons.length > 0 && <ul className="mt-1 list-disc pl-5 text-muted">{l.reasons.map((r) => <li key={r}>{LINK_REASON_TEXT[r][lang]}</li>)}</ul>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card small className="!p-6">
              <Chip tone="info">EDUCATION</Chip>
              <p className="mt-2 text-sm">{out.educationalNote}</p>
              <p className="mt-2 text-xs text-muted">{t("check.noVerdict")}</p>
              <SourceTag source={res.source} className="mt-2" />
            </Card>
          </>
        }
        side={
          <>
            <Card tone="dark" small className="!p-6">
              <h3 className="t-h4">{t("so.r.next")}</h3>
              <div className="mt-3 flex flex-col gap-3">
                <Btn variant="lime" block onClick={again}>{t("so.r.another")}</Btn>
                <LinkBtn href={askReviewer} variant="secondary" block>{t("so.r.ask")}</LinkBtn>
                <Btn variant="secondary" block onClick={report} disabled={reported !== null}>{t("check.report")}</Btn>
              </div>
              <p className="mt-3 text-xs text-muted" role="status">{reported === null ? t("check.report.hint") : `${t("check.report.done")} ${t("check.report.count", { n: reported })}`}</p>
            </Card>
            <Card small className="!p-6">
              <h3 className="t-h4">{t("so.r.learn")}</h3>
              <p className="mt-2 text-sm text-muted">{t("so.r.learnBody")}</p>
              <Link href="/learn" className="und mt-3 inline-block min-h-11 text-sm font-semibold">{t("so.r.learnBtn")}</Link>
            </Card>
            <Card tone="lav" small className="!p-6">
              <h3 className="t-h4">{t("so.r.low")}</h3>
              <p className="mt-2 text-sm">{t("so.r.lowBody")}</p>
            </Card>
          </>
        }
      />
    </div>
  );
}
