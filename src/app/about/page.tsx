"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chip, Crumb, useDocTitle } from "@/components/ds";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { pickPersona } from "@/lib/session";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";

/** What the product does, does not do, and how people and AI share the work. No team photos, no invented credentials. */
export default function About() {
  const { t, state, lang, update } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  useDocTitle(t("nav2.about"));
  const start = async () => {
    if (!state) return;
    await wf.signIn("fresh", lang);
    update((s) => pickPersona(s, "fresh"));
    router.push("/intake");
  };
  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/" }, { label: t("nav2.about") }]} />
      <h1 className="t-display mt-4 max-w-[1100px] text-[clamp(2.5rem,7vw,5.25rem)]">
        {t("ab.h1.pre")} <span className="hl">{t("ab.h1.hl")}</span>
      </h1>
      <p className="t-lead mt-6 max-w-[700px] text-base md:text-[1.1875rem]">{t("ab.lead")}</p>

      {/* the product boundary in one view: do and do-not as equal-weight cards (the do-not card first on a phone for readers who arrive from a warning) */}
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <Card className="!p-9 max-md:order-2 max-md:!p-5">
          <Chip tone="ok">{t("ab.does.title")}</Chip>
          <ul className="mt-4 flex flex-col gap-3 text-[17px]">{[1, 2, 3, 4, 5].map((k) => <li key={k}>• {t(`ab.does.${k}`)}</li>)}</ul>
        </Card>
        <Card tone="dark" className="!p-9 max-md:order-1 max-md:!p-5">
          <Chip tone="err">{t("ab.dont.title")}</Chip>
          <ul className="mt-4 flex flex-col gap-3 text-[17px] text-muted">{[1, 2, 3, 4, 5].map((k) => <li key={k}>• {t(`ab.dont.${k}`)}</li>)}</ul>
        </Card>
      </div>

      <Card tone="lav" className="mt-5 !p-10 max-md:!p-5">
        <h2 className="t-h1">{t("ab.share.title")}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([["neui", 1], ["warn", 2], ["neui", 3], ["ok", 4]] as const).map(([tone, k]) => (
            <div key={k} className="ac-inner">
              <Chip tone={tone}>{t(`ab.share.${k}`)}</Chip>
              <p className="mt-2 text-sm">{t(`ab.share.${k}d`)}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Card tone="dark">
          <h2 className="t-h3">{t("ab.for.title")}</h2>
          <p className="mt-3 text-sm text-muted">{t("ab.for.body")}</p>
        </Card>
        <Card tone="burg">
          <h2 className="t-h3 !text-[#EAE7DD]">{t("ab.pro.title")}</h2>
          <p className="mt-3 text-sm text-[#D8C7C1]">{t("ab.pro.body")}</p>
        </Card>
        <Card tone="lime">
          <h2 className="t-h3">{t("ab.principles.title")}</h2>
          <p className="mt-3 text-sm">{t("ab.principles.body")}</p>
          <Link href="/compliance" className="und mt-3 inline-block min-h-11 text-sm">{t("ab.principles.link")}</Link>
        </Card>
      </div>

      <Card tone="lime" className="mt-6 flex flex-wrap items-center justify-between gap-4 !p-9 max-md:!p-5">
        <div className="t-h1">{t("ab.cta.title")}</div>
        <div className="flex flex-col gap-3 sm:flex-row max-sm:w-full">
          <Btn onClick={() => void start()} disabled={!state} className="max-sm:w-full">{t("lp.cta.start")}</Btn>
          <LinkBtn href="/compliance" variant="secondary" className="max-sm:w-full">{t("footer.compliance")}</LinkBtn>
        </div>
      </Card>
    </div>
  );
}
