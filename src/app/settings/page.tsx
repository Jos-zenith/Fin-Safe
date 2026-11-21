"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Chip, Crumb, useDocTitle, useToast } from "@/components/ds";
import { Sheet } from "@/components/Sheet";
import { Btn, Card } from "@/components/ui";
import { CONSTANTS } from "@/config/constants";
import { RETENTION_HOURS } from "@/config/workflow";
import { LANGS } from "@/i18n";
import { setPrefs, usePrefs, type Prefs } from "@/lib/prefs";
import { api } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";

const SECTIONS = ["language", "a11y", "data", "ai", "privacy"] as const;
type Section = (typeof SECTIONS)[number];
const SIZES: Prefs["text"][] = ["md", "lg", "xl"];
const PCT = { md: 100, lg: 112, xl: 125 } as const;

/** A labelled on/off switch: the state is spoken (aria-checked) and written ("On" / "Off"), never colour alone. */
function Switch({ on, onChange, label, hint, id }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; id: string }) {
  const { t } = useApp();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-4 first:border-0">
      <div className="min-w-0 flex-1 basis-60">
        <b id={`${id}-l`}>{label}</b>
        {hint && <div className="text-sm text-muted">{hint}</div>}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold" aria-hidden>{on ? t("st.on") : t("st.off")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-l`}
          onClick={() => onChange(!on)}
          className={`relative h-7 w-12 shrink-0 rounded-full ${on ? "bg-char" : "bg-[#BDB9AB]"} after:absolute after:top-[3px] after:size-[22px] after:rounded-full after:transition-all ${on ? "after:right-[3px] after:bg-lime" : "after:left-[3px] after:bg-white-ac"}`}
        />
      </div>
    </div>
  );
}

export default function Settings() {
  const { state, t, lang, setLang, setRemember } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const toast = useToast();
  const prefs = usePrefs();
  const [confirm, setConfirm] = useState<null | "clear" | "reset">(null);
  const [section, setSection] = useState<Section>("language");
  const [ai, setAi] = useState<{ mode: "mock" | "live"; fellBackToMock: boolean } | null>(null);
  const [last, setLast] = useState<{ n: number; live: number; template: number; fallback: number } | null>(null);
  useDocTitle(t("nav2.settings"));
  useEffect(() => {
    let live = true;
    fetch("/api/ai")
      .then((r) => r.json())
      .then((j) => live && setAi(j))
      .catch(() => live && setAi({ mode: "mock", fellBackToMock: false }));
    return () => {
      live = false;
    };
  }, []);
  // which of the last AI outputs on this server were live, template or fallback (counts only; signed-in people)
  useEffect(() => {
    let live = true;
    api<{ last: { n: number; live: number; template: number; fallback: number } }>("GET", "ai/status").then((r) => live && r.data && setLast(r.data.last));
    return () => {
      live = false;
    };
  }, [wf.myCase?.version]);
  if (!state) return null;

  const change = (patch: Partial<Prefs>) => {
    setPrefs(patch);
    toast.show(t("st.saved"));
  };
  const jump = (s: Section) => {
    setSection(s);
    document.getElementById(`st-${s}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/dashboard" }, { label: t("nav2.settings") }]} />
      <h1 className="t-h1">{t("st.title")}</h1>

      <div className="mt-6 grid items-start gap-6 wd:grid-cols-[240px_minmax(0,1fr)_340px] wd:gap-7">
        {/* the section list is a column on a wide screen and a single select on a phone */}
        <nav aria-label={t("st.nav.label")} className="wd:sticky wd:top-28">
          <div className="hidden flex-col gap-2 wd:flex">
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                aria-current={section === s ? "true" : undefined}
                onClick={() => jump(s)}
                className={`min-h-11 rounded-[14px] border px-4 py-3 text-left text-sm ${section === s ? "border-lime bg-[#242424] font-bold text-fg" : "border-transparent text-muted hover:text-fg"}`}
              >
                {t(`st.nav.${s}`)}
              </button>
            ))}
          </div>
          <label className="wd:hidden">
            <span className="sr-only">{t("st.nav.label")}</span>
            <select value={section} onChange={(e) => jump(e.target.value as Section)} className="ac-field s-dark w-full">
              {SECTIONS.map((s) => <option key={s} value={s}>{t(`st.nav.${s}`)}</option>)}
            </select>
          </label>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          <Card id="st-language" className="scroll-mt-28">
            <h2 className="t-h3">{t("st.nav.language")}</h2>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
              <div className="min-w-0 flex-1 basis-60"><b>{t("st.lang.title")}</b><div className="text-sm text-muted">{t("st.lang.hint")}</div></div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("st.lang.title")}>
                {LANGS.map((l) => (
                  <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} className="ac-chip ac-chip-neui min-h-11 px-4 text-[13px]">
                    {l.full}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4" data-testid="translation-note">
              <div className="min-w-0 flex-1 basis-60">
                <b>{t("st.lang.status")}</b>
                <div className="text-sm text-muted">
                  {t("settings.langReview")}
                  {lang !== "en" && <span lang="en" className="mt-0.5 block">Hindi and Tamil text are pending native-speaker review.</span>}
                </div>
              </div>
              <Chip tone="warn">{t("st.lang.pending")}</Chip>
            </div>
          </Card>

          <Card id="st-a11y" className="scroll-mt-28">
            <h2 className="t-h3">{t("st.nav.a11y")}</h2>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4 pb-4">
              <div className="min-w-0 flex-1 basis-60"><b>{t("st.a11y.text")}</b><div className="text-sm text-muted">{t("st.a11y.textHint")}</div></div>
              <div className="flex items-center gap-3">
                <button type="button" aria-label={t("st.a11y.smaller")} disabled={prefs.text === "md"} onClick={() => change({ text: SIZES[Math.max(0, SIZES.indexOf(prefs.text) - 1)] })} className="ac-ic !size-11 text-[13px] disabled:opacity-40">A−</button>
                <b className="num min-w-[3.25rem] text-center" aria-live="polite">{PCT[prefs.text]}%</b>
                <button type="button" aria-label={t("st.a11y.larger")} disabled={prefs.text === "xl"} onClick={() => change({ text: SIZES[Math.min(2, SIZES.indexOf(prefs.text) + 1)] })} className="ac-ic ac-ic-on !size-11 text-[17px] disabled:opacity-40">A+</button>
              </div>
            </div>
            <Switch id="sw-contrast" on={prefs.contrast} onChange={(v) => change({ contrast: v })} label={t("st.a11y.contrast")} hint={t("st.a11y.contrastHint")} />
            <Switch id="sw-motion" on={prefs.motion} onChange={(v) => change({ motion: v })} label={t("st.a11y.motion")} hint={t("st.a11y.motionHint")} />
            <Switch id="sw-hints" on={prefs.hints} onChange={(v) => change({ hints: v })} label={t("st.a11y.hints")} hint={t("st.a11y.hintsHint")} />
            <p className="mt-2 text-xs text-muted">{t("st.a11y.note")}</p>
          </Card>

          <Card id="st-data" className="scroll-mt-28">
            <h2 className="t-h3">{t("st.nav.data")}</h2>
            <p className="mt-2 text-sm text-muted">{t("settings.dataBody", { hours: CONSTANTS.rememberHours, minutes: CONSTANTS.idleMinutes })}</p>
            <p data-testid="retention-demo" className="mt-3 rounded-xl bg-[#F3EAD0] p-2.5 text-sm font-medium text-[#4A2D00]">{t("settings.retentionDemo", { hours: RETENTION_HOURS })}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-b border-line py-4">
              <div className="min-w-0 flex-1 basis-60"><b>{t("st.data.reset")}</b><div className="text-sm text-muted">{t("st.data.resetHint")}</div></div>
              <Btn variant="secondary" small onClick={() => setConfirm("reset")}>{t("menu.reset")}</Btn>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4">
              <div className="min-w-0 flex-1 basis-60"><b>{t("st.data.clear")}</b><div className="text-sm text-muted">{t("st.data.clearHint")}</div></div>
              <Btn variant="danger" small onClick={() => setConfirm("clear")}>{t("menu.clear")}</Btn>
            </div>
            <Switch id="sw-remember" on={state.remember} onChange={(v) => setRemember(v)} label={t("settings.remember")} hint={t("settings.rememberHint", { hours: CONSTANTS.rememberHours })} />
          </Card>

          <Card id="st-ai" className="scroll-mt-28">
            <h2 className="t-h3">{t("settings.aiMode")}</h2>
            <p className="mt-2 text-sm" data-testid="ai-mode">
              {ai === null ? "…" : ai.fellBackToMock ? t("settings.aiFallback") : ai.mode === "live" ? t("settings.aiLive") : t("settings.aiMock")}
            </p>
            {last && (
              <p className="mt-2 text-sm font-medium" data-testid="ai-status" data-live={last.live} data-template={last.template} data-fallback={last.fallback}>
                {last.n === 0 ? t("settings.aiStatusNone") : t("settings.aiStatus", { n: last.n, live: last.live, template: last.template, fallback: last.fallback })}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">{t("settings.aiStatusHint")}</p>
          </Card>

          <Card id="st-privacy" className="scroll-mt-28">
            <h2 className="t-h3">{t("st.nav.privacy")}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">{[1, 2, 3].map((k) => <li key={k}>• {t(`st.privacy.${k}`)}</li>)}</ul>
            <p className="mt-3 text-xs text-muted">{t("settings.constants")}</p>
            <div className="mt-2 flex flex-wrap gap-x-5">
              <Link href="/compliance" className="und inline-flex min-h-11 items-center text-sm font-semibold">{t("st.privacy.link")}</Link>
              <Link href="/sources" className="und inline-flex min-h-11 items-center text-sm font-semibold">{t("footer.sources")}</Link>
              <Link href="/transparency" className="und inline-flex min-h-11 items-center text-sm font-semibold">{t("menu.howWeEarn")}</Link>
            </div>
            <p className="mt-3 text-xs text-muted">{t("legal.demoStatement")}</p>
          </Card>
        </div>

        <aside className="flex flex-col gap-5">
          <Card tone="lav" small className="!p-6">
            <b>{t("st.rail.saved")}</b>
            <p className="mt-2 text-sm">{t("st.rail.savedBody")}</p>
          </Card>
          <Card tone="dark" small className="!p-6">
            <p className="text-sm text-muted">{t("st.rail.help")}</p>
            <Link href="/help" className="und mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-lime">{t("menu.help")}</Link>
          </Card>
        </aside>
      </div>

      {/* every destructive action asks first, with Cancel as the default focus (Escape also cancels) */}
      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "clear" ? t("clear.title") : t("reset.title")}>
        <p className="text-muted">{confirm === "clear" ? t("clear.body") : t("reset.body")}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Btn variant="secondary" autoFocus onClick={() => setConfirm(null)}>{t("common.cancel")}</Btn>
          <Btn
            variant="danger"
            onClick={() => {
              if (confirm === "clear") void wf.deleteMyData();
              else void wf.resetMyDemo();
              setConfirm(null);
              router.push("/");
            }}
          >
            {confirm === "clear" ? t("clear.confirm") : t("reset.confirm")}
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}
