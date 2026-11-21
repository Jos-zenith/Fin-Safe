"use client";
import { useState } from "react";
import { IntakeInput, OPTIONAL_STEPS, type OptionalStep } from "@/components/IntakeInput";
import { Sheet } from "@/components/Sheet";
import { Card } from "@/components/ui";
import { useApp } from "@/store/AppProvider";
import type { UserProfile } from "@/types";

/**
 * The first result needs only a few answers. These optional questions each sharpen it; until one is answered the
 * numbers use a stated default, and this card says so. Each one is a small "Add" task, not a wall of questions.
 */
export function ImproveAccuracy({ profile, limit = 4, id = "data-quality" }: { profile: UserProfile; limit?: number; id?: string }) {
  const { state, t, lang, update } = useApp();
  const [step, setStep] = useState<OptionalStep | null>(null);
  const [all, setAll] = useState(false);
  const done = new Set(state?.extras ?? []);
  const left = OPTIONAL_STEPS.filter((s) => !done.has(s));
  const shown = all ? left : left.slice(0, limit);
  return (
    <Card id={id} data-testid="improve-accuracy" className="scroll-mt-28">
      <h2 className="t-h4">{t("dash.dq.title")}</h2>
      {left.length ? (
        <>
          <p className="mt-2 text-sm text-muted">{t("dash.dq.sub")}</p>
          <ul className="mt-3 flex flex-col text-sm">
            {shown.map((s) => (
              <li key={s} className="flex items-center justify-between gap-3 border-b border-line py-1 last:border-0">
                <span className="min-w-0">
                  <span className="block font-medium">{t(`improve.l.${s}`)}</span>
                  <span className="block text-xs text-muted">{t(`improve.d.${s}`)}</span>
                </span>
                <button type="button" onClick={() => setStep(s)} className="und min-h-11 shrink-0 px-2 font-semibold" aria-label={`${t("dash.dq.add")}: ${t(`improve.l.${s}`)}`}>
                  {t("dash.dq.add")}
                </button>
              </li>
            ))}
          </ul>
          {left.length > limit && !all && (
            <button type="button" onClick={() => setAll(true)} aria-label={t("dash.dq.more", { n: left.length - limit })} className="und mt-1 min-h-11 text-sm font-semibold">
              +{left.length - limit}
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">{t("dash.dq.allDone")}</p>
      )}
      <p className="mt-3 text-xs text-muted">{t("dash.dq.notmodelled")}</p>
      <Sheet open={step !== null} onClose={() => setStep(null)} title={step ? t(`intake.q.${step}`) : ""}>
        {step && (
          <div>
            <p className="mb-3 text-sm text-muted">{t(`intake.hint.${step}`)}</p>
            <IntakeInput
              key={step}
              step={step}
              p={profile}
              lang={lang}
              onNext={(next) => {
                update((s) => ({ ...s, touched: true, profile: next, extras: [...new Set([...(s.extras ?? []), step])] }));
                setStep(null);
              }}
            />
          </div>
        )}
      </Sheet>
    </Card>
  );
}
