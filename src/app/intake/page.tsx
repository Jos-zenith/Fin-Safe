"use client";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Chip, Crumb, Meter, PageHead, useDocTitle, useToast } from "@/components/ds";
import { CORE_STEPS, IntakeInput, intakeSummary, OPTIONAL_STEPS, type Step } from "@/components/IntakeInput";
import { Btn, Card } from "@/components/ui";
import { completeIntake } from "@/lib/session";
import { useApp } from "@/store/AppProvider";
import type { UserProfile } from "@/types";

// First result after the core answers. Everything else is asked later, on the dashboard, as "Improve accuracy".
const STEPS: readonly Step[] = CORE_STEPS;

export default function Intake() {
  const { state, update, t, lang } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<UserProfile | null>(state?.profile ?? null);
  const [i, setI] = useState(state?.intakeStep ?? 0);
  useDocTitle(t("ip.title"));

  useEffect(() => {
    if (state && !state.profile) router.replace("/");
  }, [state, router]);
  useEffect(() => {
    // each question starts at the top of its card, so the question being asked is never below the fold
    window.scrollTo({ top: 0 });
  }, [i]);

  const answers = useMemo(() => (draft ? STEPS.slice(0, i).map((s) => ({ s, a: intakeSummary(s, draft, t) })) : []), [draft, i, t]);
  if (!state || !draft) return null;
  const p = draft;
  const step: Step | null = i < STEPS.length ? STEPS[i] : null;
  const total = STEPS.length;

  const go = (n: number) => {
    setI(n);
    update((s) => ({ ...s, intakeStep: n }));
  };
  const advance = (next: UserProfile) => {
    setDraft(next);
    const n = i + 1;
    setI(n);
    update((s) => ({ ...s, touched: true, profile: next, intakeStep: n }));
  };
  // "Use demo answers" fills in everything for a persona, so no "Improve accuracy" steps are left for them.
  const finish = (profile = p, everything = false) => {
    update((s) => completeIntake(s, profile, everything ? [...OPTIONAL_STEPS] : undefined));
    router.push("/dashboard");
  };
  const persona = state.personaId !== "fresh";

  const stepList = (
    <ol className="flex flex-col gap-2" aria-label={t("ip.steps")}>
      {[...STEPS, "done" as const].map((s, k) => {
        const done = k < i;
        const now = k === i;
        const label = s === "done" ? t("ip.step.done") : t(`ip.step.${s}`);
        const body = (
          <>
            <span className={`grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] text-xs font-bold ${now ? "border-lime bg-lime text-char" : done ? "border-[#9ADBB4] bg-[#9ADBB4] text-[#0B3B20]" : "border-[#6a6a6a]"}`}>
              {done ? "✓" : k + 1}
            </span>
            <span className={now ? "font-bold" : done ? "text-muted" : ""}>{label}</span>
          </>
        );
        const cls = `flex items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-sm ${now ? "border border-lime bg-[#242424]" : "border border-transparent"}`;
        return (
          <li key={s} aria-current={now ? "step" : undefined}>
            {done ? (
              <button type="button" onClick={() => go(k)} className={`${cls} min-h-11 w-full text-left hover:bg-white/5`} aria-label={`${t("ip.known.edit")}: ${label}`}>
                {body}
              </button>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="ac-wrap pb-24 md:pb-10">
      <Crumb items={[{ label: t("nav2.home"), href: "/dashboard" }, { label: t("ip.title") }]} />
      <PageHead
        title={t("ip.title")}
        actions={
          <span className="text-sm text-muted" role="status">
            {t("ip.progress", { n: Math.min(i + 1, total), total })}
          </span>
        }
      />
      <Meter className="mt-4" value={i / total} label={t("intake.progressLabel")} />
      <p className="mt-2 text-xs text-muted wd:hidden">
        {step ? t(`ip.step.${step}`) : t("ip.step.done")} · {t("ip.mobile.left", { left: Math.max(0, total - i) })}
      </p>

      <div className="mt-6 grid items-start gap-6 wd:grid-cols-[260px_minmax(0,1fr)_320px] wd:gap-7">
        {/* the step list: all stages without all fields; the current one has the lime outline, done ones a tick and the word */}
        <aside className="hidden flex-col gap-3 wd:flex" aria-label={t("ip.steps")}>
          {stepList}
          <p className="px-3.5 text-xs text-muted">{t("ip.legend")}</p>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className="!p-10 max-md:!p-5" aria-live="polite">
            {step ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Chip tone="neui">{t("ip.required")}</Chip>
                </div>
                <h2 className="t-h1 mt-4 text-[clamp(1.5rem,4.5vw,2.5rem)]">{t(`intake.q.${step}`)}</h2>
                <p className="mt-3 text-base text-muted">{t(`intake.hint.${step}`)}</p>
                <div className="mx-auto mt-7 w-full max-w-md">
                  <IntakeInput key={step} step={step} p={p} onNext={advance} lang={lang} />
                </div>
              </>
            ) : (
              <>
                <h2 className="t-h1 text-[clamp(1.5rem,4.5vw,2.5rem)]">{t("intake.done")}</h2>
                <div className="mt-7">
                  <Btn onClick={() => finish()} className="ac-btn-block sm:w-auto">
                    {t("intake.seeHealth")}
                  </Btn>
                </div>
              </>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {i > 0 && (
                  <Btn variant="secondary" onClick={() => go(i - 1)}>
                    ← {t("ip.back")}
                  </Btn>
                )}
              </div>
              <Btn
                variant="ghost"
                onClick={() => {
                  toast.show(t("ip.saved"));
                  router.push("/");
                }}
              >
                {t("ip.saveLater")}
              </Btn>
            </div>
          </Card>
          <Card tone="dark" small className="!px-6 !py-5">
            <b>{t("ip.next.title")}</b>
            <p className="mt-1 text-sm text-muted">{t("ip.next.body")}</p>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <Card tone="dark" small className="!p-6" data-testid="known-so-far">
            <h2 className="t-h4">{t("ip.known.title")}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {answers.map(({ s, a }, k) => (
                <li key={s} className="flex items-baseline justify-between gap-3">
                  <span className="text-muted">{t(`ip.step.${s}`)}</span>
                  <span className="flex items-center gap-2">
                    <b className="num text-right text-sm">{a}</b>
                    <button type="button" onClick={() => go(k)} className="min-h-11 px-1 text-xs font-semibold text-lime underline underline-offset-2" aria-label={`${t("ip.known.edit")}: ${t(`ip.step.${s}`)}`}>
                      {t("ip.known.edit")}
                    </button>
                  </span>
                </li>
              ))}
              {step && (
                <li className="flex items-baseline justify-between gap-3">
                  <span className="text-muted">{t(`ip.step.${step}`)}</span>
                  <b className="text-muted">{t("ip.known.pending")}</b>
                </li>
              )}
            </ul>
            {persona && (
              <button type="button" onClick={() => finish(p, true)} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-lime">
                <Sparkles size={14} aria-hidden /> {t("intake.useDemo")}
              </button>
            )}
          </Card>
          {step && (
            <Card tone="lav" small className="!p-6">
              <h2 className="t-h4">{t("ip.why.title")}</h2>
              <p className="mt-2 text-sm">{t(`ip.why.${step}`)}</p>
            </Card>
          )}
          <Card tone="dark" small className="!p-6">
            <h2 className="t-h4">{t("ip.data.title")}</h2>
            <p className="mt-2 text-sm text-muted">{t("intake.privacy")}</p>
            <Link href="/compliance" className="und mt-3 inline-block min-h-11 text-xs text-lav">
              {t("ip.data.link")}
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
