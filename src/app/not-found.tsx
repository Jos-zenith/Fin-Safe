"use client";
import Link from "next/link";
import { Crumb, useDocTitle } from "@/components/ds";
import { Card, LinkBtn } from "@/components/ui";
import { planHref } from "@/lib/nav";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";

/** A missing page: say what happened, say the person's data is safe, and offer the places most people want. */
export default function NotFound() {
  const { t, state } = useApp();
  const wf = useWorkflow();
  useDocTitle(t("nf.title"));
  const signedIn = !!state?.profile;
  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/" }, { label: t("nf.crumb") }]} />
      <div className="mt-3 grid items-stretch gap-6 wd:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card tone="lav" className="!p-12 max-md:!p-6" data-testid="not-found">
          <div className="num text-[clamp(6rem,16vw,9.375rem)] leading-[0.9] tracking-[-0.05em]" aria-hidden>{t("nf.code")}</div>
          <h1 className="t-h1 mt-4">{t("nf.title")}</h1>
          <p className="mt-3 max-w-[520px] text-lg">{t("nf.body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkBtn href={signedIn ? "/dashboard" : "/"}>{t("nf.home")}</LinkBtn>
            {signedIn && <LinkBtn href={planHref(wf.myCase)} variant="secondary">{t("nf.plan")}</LinkBtn>}
            <LinkBtn href="/help" variant="ghost">{t("nf.help")}</LinkBtn>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          {/* a simple geometric picture from the brand shapes: no faces, no jokes about money */}
          <Card tone="lime" className="grid min-h-[220px] flex-1 place-items-center" aria-hidden>
            <div className="relative h-[150px] w-[240px]">
              <i className="absolute bottom-0 left-0 h-[54px] w-[150px] -skew-x-[28deg] rounded-[10px] bg-burg" />
              <i className="absolute bottom-9 left-[70px] h-[54px] w-[150px] -skew-x-[28deg] rounded-[10px] bg-char" />
              <i className="absolute bottom-[72px] left-[120px] h-[54px] w-20 -skew-x-[28deg] rounded-[10px] bg-lav" />
            </div>
          </Card>
          <Card tone="dark" small className="!p-6">
            <b>{t("nf.looking")}</b>
            <div className="mt-3 flex flex-col gap-1 text-sm">
              <Link href="/second-opinion" className="und inline-flex min-h-11 items-center text-lime">{t("hp.quick.check")}</Link>
              <Link href="/learn" className="und inline-flex min-h-11 items-center text-lime">{t("footer.edu")}</Link>
              {wf.myCase && <Link href={planHref(wf.myCase)} className="und inline-flex min-h-11 items-center text-lime">{t("case.view")}</Link>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
