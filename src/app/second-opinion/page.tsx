"use client";
import { Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Chip, Crumb, MainSide, useDocTitle } from "@/components/ds";
import { Btn, Card } from "@/components/ui";
import { SAMPLES } from "@/data/samples";
import { callAI } from "@/lib/ai/client";
import type { SecondOpinionResult } from "@/lib/ai/schemas";
import { setOpinion, useOpinion } from "@/lib/opinionStore";
import { redact } from "@/lib/redact";
import { useApp } from "@/store/AppProvider";

const MAX = 3000;

export default function SecondOpinion() {
  const { t, lang } = useApp();
  const router = useRouter();
  const { text, busy, failed } = useOpinion();
  const redacted = useMemo(() => redact(text), [text]);
  useDocTitle(t("nav2.second"));

  // Pasted text lives only in memory until the person chooses "Report a missed message" on the result page, which saves
  // the REDACTED text on this device for at most 24 hours.
  const run = async () => {
    if (!text.trim() || busy) return;
    setOpinion({ busy: true, failed: false });
    try {
      const shown = redact(text);
      const r = await callAI({ task: "secondOpinion", language: lang, text: shown });
      setOpinion({ res: { shown, out: r.data as SecondOpinionResult, source: r.source }, busy: false });
      router.push("/second-opinion/result");
    } catch {
      // the message is kept so the person can try again
      setOpinion({ busy: false, failed: true });
    }
  };

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/" }, { label: t("nav2.second") }]} />
      <MainSide
        className="mt-4"
        cols="minmax(0,1.5fr) minmax(0,1fr)"
        main={
          <div>
            <span className="t-label">{t("so.kicker")}</span>
            <h1 className="t-display mt-4 text-[clamp(2.5rem,7vw,4.5rem)]">
              {t("so.h1.pre")} <span className="hl">{t("so.h1.hl")}</span>
              {t("so.h1.post") ? ` ${t("so.h1.post")}` : ""}
            </h1>
            <p className="t-lead mt-4 max-w-[620px] text-base md:text-[1.1875rem]">{t("so.lead")}</p>

            <Card className="mt-8 !p-8 max-md:!p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="so-text" className="t-label !text-fg">
                  {t("so.label")}
                </label>
                <span className={`text-xs ${text.length >= MAX ? "font-bold text-danger" : "text-muted"}`}>{t("so.counter", { n: text.length.toLocaleString("en-IN"), max: MAX.toLocaleString("en-IN") })}</span>
              </div>
              <textarea
                id="so-text"
                value={text}
                onChange={(e) => setOpinion({ text: e.target.value.slice(0, MAX) })}
                rows={9}
                aria-describedby="so-privacy"
                placeholder={t("check.paste")}
                className="ac-field mt-2 !min-h-[220px]"
              />
              <div className="mt-4 flex flex-wrap gap-3">
                <Btn
                  variant="secondary"
                  small
                  onClick={async () => {
                    try {
                      const clip = await navigator.clipboard.readText();
                      setOpinion({ text: clip.slice(0, MAX) });
                    } catch {
                      /* the browser did not allow reading the clipboard: the person can paste into the box */
                    }
                  }}
                >
                  {t("so.paste")}
                </Btn>
                <Btn variant="secondary" small onClick={() => setOpinion({ text: "", failed: false })} disabled={!text}>
                  {t("so.clear")}
                </Btn>
              </div>
              <div className="ac-inner mt-4 flex items-center gap-3 !bg-[#DDD9CC]" id="so-privacy">
                <span className="ac-ic !size-9 shrink-0" aria-hidden><Info size={16} /></span>
                <p className="text-sm">{t("check.privacy")}</p>
              </div>
              {redacted !== text && <p className="mt-2 text-xs text-muted">{t("check.redacted")}</p>}
              {failed && (
                <p role="alert" className="mt-3 rounded-xl bg-[#F6E4E1] p-3 text-sm font-semibold text-[#8E1B1B]">
                  {t("so.error")}
                </p>
              )}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <span className="max-w-md text-sm text-muted">{t("so.takes")}</span>
                <Btn variant="lime" disabled={!text.trim() || busy} onClick={() => void run()} className="max-sm:w-full" data-testid="analyze">
                  {busy ? t("so.analyzing") : t("so.analyze")}
                </Btn>
              </div>
            </Card>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="t-label">{t("so.examples")}</span>
              {SAMPLES.map((s) => (
                <button key={s.id} type="button" onClick={() => setOpinion({ text: s.text, failed: false })} className="ac-chip ac-chip-neu min-h-11 px-4 text-[13px] hover:brightness-125">
                  {s.label[lang]}
                </button>
              ))}
            </div>
          </div>
        }
        side={
          <>
            <Card tone="lav" small className="!p-6">
              <h2 className="t-h3">{t("so.get.title")}</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">{[1, 2, 3, 4].map((k) => <li key={k}>• {t(`so.get.${k}`)}</li>)}</ul>
            </Card>
            <Card tone="dark" small className="!p-6">
              <h2 className="t-h3">{t("so.not.title")}</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">{[1, 2, 3].map((k) => <li key={k}>• {t(`so.not.${k}`)}</li>)}</ul>
            </Card>
            <Card small className="!p-6">
              <Chip tone="info">EDUCATION</Chip>
              <p className="mt-2 text-sm text-muted">{t("so.edu")}</p>
              <Link href="/compliance#privacy" className="und mt-2 inline-block min-h-11 text-sm">{t("so.privacyLink")}</Link>
            </Card>
          </>
        }
      />
    </div>
  );
}
