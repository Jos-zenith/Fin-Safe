"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Chip, Crumb, PageHead, useDocTitle } from "@/components/ds";
import { Card } from "@/components/ui";
import { COMPLIANCE_SECTIONS as S, COMPLIANCE_UPDATED } from "@/content/compliance";
import { useApp } from "@/store/AppProvider";

const IDS = ["demo", "synthetic", "privacy", "ai", "advice", "regulatory", "consent", "conflicts", "disclosures"] as const;
type Sid = (typeof IDS)[number];

/**
 * Plain-language summary of what the demo is, how data is handled and what the product does not claim. A section list
 * keeps a long page from feeling like a wall of text. No regulatory approval is claimed or implied anywhere on it.
 */
export default function Compliance() {
  const { t, lang } = useApp();
  const [active, setActive] = useState<Sid>("demo");
  useDocTitle(t("co.title"));

  // the section list follows the reader down the page
  useEffect(() => {
    const els = IDS.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id as Sid);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const updated = new Date(`${COMPLIANCE_UPDATED}T00:00:00`).toLocaleDateString(lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const sec = "scroll-mt-28 border-t border-line py-7 first:border-0 first:pt-3";

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/" }, { label: t("co.title") }]} />
      <PageHead title={t("co.title")} sub={t("co.sub", { date: updated })} actions={<Chip tone="warn">{t("co.chip")}</Chip>} />

      <div className="mt-6 grid items-start gap-7 wd:grid-cols-[250px_minmax(0,1fr)_310px]">
        <nav aria-label={t("co.toc")} className="hidden flex-col gap-1 wd:sticky wd:top-28 wd:flex">
          {IDS.map((id) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={active === id ? "true" : undefined}
              onClick={() => setActive(id)}
              className={`flex min-h-11 items-center rounded-xl border px-3.5 text-sm ${active === id ? "border-lav bg-[#242424] font-bold text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              {t(`co.s.${id}`)}
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <Card tone="lav" id="demo" className="scroll-mt-28">
            <h2 className="t-h2">{t("co.demo.title")}</h2>
            <p className="mt-3 max-w-[700px] text-base">{t("co.demo.body")}</p>
          </Card>
          <p className="text-xs text-muted" role="note">{t("co.english")}</p>
          <Card className="!px-8 !py-3 max-md:!px-5" lang="en">
            <section id="synthetic" className={sec}>
              <h3 className="t-h3">{t("co.s.synthetic")}</h3>
              <p className="mt-2 text-sm text-muted">{S.synthetic}</p>
            </section>
            <section id="privacy" className={sec}>
              <h3 className="t-h3">{t("co.s.privacy")}</h3>
              <ul className="mt-2 flex flex-col gap-2 text-sm text-muted">{S.privacy.map((x) => <li key={x}>• {x}</li>)}</ul>
              <Link href="/settings" className="und mt-2 inline-flex min-h-11 items-center text-sm font-semibold">{t("nav2.settings")}</Link>
            </section>
            <section id="ai" className={sec}>
              <h3 className="t-h3">{t("co.s.ai")}</h3>
              <ul className="mt-2 flex flex-col gap-2 text-sm text-muted">{S.ai.map((x) => <li key={x}>• {x}</li>)}</ul>
            </section>
            <section id="advice" className={sec}>
              <h3 className="t-h3">{t("co.s.advice")}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="ac-inner"><Chip tone="info">EDUCATION</Chip><p className="mt-2 text-xs">{t("lp.labels.edu")}</p></div>
                <div className="ac-inner"><Chip tone="neui">ANALYSIS</Chip><p className="mt-2 text-xs">{t("lp.labels.ana")}</p></div>
                <div className="ac-inner"><Chip tone="ok">REVIEWED (DEMO)</Chip><p className="mt-2 text-xs">{t("lp.labels.rev")}</p></div>
              </div>
            </section>
            <section id="regulatory" className={sec}>
              <h3 className="t-h3">{t("co.s.regulatory")}</h3>
              <p className="mt-2 text-sm text-muted">{S.regulatory}</p>
            </section>
            <section id="consent" className={sec}>
              <h3 className="t-h3">{t("co.s.consent")}</h3>
              <p className="mt-2 text-sm text-muted">{S.consent}</p>
            </section>
            <section id="conflicts" className={sec}>
              <h3 className="t-h3">{t("co.s.conflicts")}</h3>
              <p className="mt-2 text-sm text-muted">{S.conflicts}</p>
              <Link href="/transparency" className="und mt-2 inline-flex min-h-11 items-center text-sm font-semibold">{t("nav2.earn")}</Link>
            </section>
          </Card>
        </div>

        <aside id="disclosures" className="flex scroll-mt-28 flex-col gap-4">
          <Card tone="burg" small className="!p-6">
            <h2 className="t-h4">{t("co.s.disclosures")}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-[#D8C7C1]">{[1, 2, 3, 4].map((k) => <li key={k}>• {t(`co.d.${k}`)}</li>)}</ul>
          </Card>
          <Card tone="dark" small className="!p-6">
            <h2 className="t-h4">{t("co.related")}</h2>
            <div className="mt-3 flex flex-col text-sm">
              <Link href="/transparency" className="und inline-flex min-h-11 items-center text-lime">{t("nav2.earn")}</Link>
              <Link href="/sources" className="und inline-flex min-h-11 items-center text-lime">{t("footer.sources")}</Link>
              <Link href="/help" className="und inline-flex min-h-11 items-center text-lime">{t("footer.faq")}</Link>
              <Link href="/settings" className="und inline-flex min-h-11 items-center text-lime">{t("co.related.clear")}</Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
