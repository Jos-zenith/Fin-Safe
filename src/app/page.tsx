"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { Chip, Meter } from "@/components/ds";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { CORE_STEPS } from "@/components/IntakeInput";
import { ADVISER } from "@/data/adviser";
import { pickPersona } from "@/lib/session";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { PersonaId } from "@/types";

const PEOPLE: { id: Exclude<PersonaId, "fresh">; name: string }[] = [
  { id: "priya", name: "Priya" },
  { id: "ramesh", name: "Ramesh" },
  { id: "anita", name: "Anita" },
];

const Section = ({ children, className = "" }: { children: ReactNode; className?: string }) => <section className={`ac-wrap ${className}`}>{children}</section>;

export default function Landing() {
  const { t, state, lang, update } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  // The page is in the first HTML, before the saved state is loaded; the shortcuts that need it wait for it.
  const loading = !state;
  const go = async (id: PersonaId) => {
    if (loading) return;
    // "Continue as <persona>": a real server session for that demo account (no password)
    await wf.signIn(id, lang);
    update((s) => pickPersona(s, id));
    router.push("/intake");
  };
  const resume = state?.profile && state.intakeDone;
  const n = CORE_STEPS.length;

  return (
    <div className="pb-4">
      {/* 1 · hero: the promise, two entry points, and three tiles that show the product idea without card or coin imagery */}
      <Section className="pb-10 pt-8 md:pt-14">
        <div className="grid items-stretch gap-8 wd:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] wd:gap-12">
          <div className="flex min-w-0 flex-col justify-between gap-7">
            <div>
              <Chip tone="neu" className="mb-4">
                {t("lp.kicker")}
              </Chip>
              <h1 className="t-display">
                {t("lp.h1.pre")} <span className="hl">{t("lp.h1.hl")}</span>
                <br className="max-sm:hidden" /> {t("lp.h1.post")}
              </h1>
              <p className="t-lead mt-6 max-w-[600px] text-base md:text-[1.1875rem]">{t("lp.lead")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Btn variant="lime" disabled={loading} onClick={() => void go("fresh")} className="max-sm:w-full">
                  {t("lp.cta.start")}
                </Btn>
                <LinkBtn href="/second-opinion" variant="secondary" className="max-sm:w-full">
                  {t("nav2.explore")}
                </LinkBtn>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Chip tone="neu">{t("lp.chip.time")}</Chip>
                <Chip tone="neu">{t("lp.chip.noacct")}</Chip>
                <Chip tone="lav">{t("app.demoPill")}</Chip>
              </div>
            </div>

            {/* demo shortcuts: a returning visitor, three sample people and the demo adviser (all demo sign-ins, no password) */}
            <div className="flex flex-col gap-3" data-testid="demo-shortcuts">
              {resume && (
                <Link href="/dashboard" className="s-dark ac-bordered flex items-center gap-3 rounded-2xl bg-[#242424] p-3 hover:border-lime">
                  <Avatar name={state.profile!.name || "?"} size={44} />
                  <span className="min-w-0 flex-1 font-semibold">{t("landing.continue", { name: state.profile!.name || "—" })}</span>
                  <span aria-hidden>→</span>
                </Link>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="t-label">{t("lp.sample")}</span>
                <ul className="flex flex-wrap gap-2">
                  {PEOPLE.map((p, i) => (
                    <li key={p.id}>
                      <button type="button" disabled={loading} onClick={() => void go(p.id)} className="ac-chip ac-chip-outline min-h-11 gap-2 px-3.5 disabled:opacity-60" aria-label={`${p.name}: ${t(`persona.${p.id}`)}`}>
                        <Avatar name={p.name} size={26} tone={i} />
                        <span className="font-bold">{p.name}</span>
                        <span className="text-muted max-sm:hidden">{t(`persona.${p.id}`)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="min-h-11 font-semibold text-lav underline underline-offset-4"
                  onClick={async () => {
                    if (await wf.signIn("adviser", lang)) router.push("/adviser");
                  }}
                >
                  {t("landing.adviser")} · {ADVISER.name.replace("Dr. ", "")} ({t("landing.adviserSub")})
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Card tone="lime" className="!p-8 max-md:!p-6">
              <div className="t-label">{t("lp.tile.label")}</div>
              <div className="num text-[clamp(3.5rem,9vw,4.875rem)] leading-none">1.8</div>
              <div className="t-h3 mt-1">{t("lp.tile.sub")}</div>
              <Meter value={0.3} tone="lime" className="mt-4" label={t("lp.tile.label")} />
              <div className="mt-2 text-xs text-muted">{t("lp.tile.note")}</div>
            </Card>
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
              <Card tone="burg" small className="!p-6">
                <div className="t-h3">{t("lp.tile.ai")}</div>
              </Card>
              <Card tone="lav" small className="!p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone="warn">{t("lp.tile.draft")}</Chip>
                  <span aria-hidden className="text-lg">→</span>
                  <Chip tone="ok">{t("lp.tile.reviewed")}</Chip>
                </div>
                <p className="mt-3 text-sm">{t("lp.tile.which")}</p>
              </Card>
            </div>
          </div>
        </div>
      </Section>

      {/* 2 · the journey: five steps that match the app navigation (a vertical timeline on a phone) */}
      <Section className="py-4">
        <Card className="!p-9 max-md:!p-5" aria-labelledby="journey-h">
          <h2 id="journey-h" className="t-label !text-fg">
            {t("lp.journey.title")}
          </h2>
          <ol className="mt-6 hidden flex-wrap items-start justify-between gap-4 md:flex">
            {([1, 2, 3, 4, 5] as const).map((k) => (
              <li key={k} className="flex w-[180px] flex-col items-center gap-3 text-center">
                <span className={`ac-ic ${k === 1 ? "ac-ic-on" : ""} !size-16 text-[22px]`} aria-hidden>
                  {k}
                </span>
                <b>{t(`lp.j${k}.t`)}</b>
                <span className="text-sm text-muted">{t(`lp.j${k}.d`, { n })}</span>
              </li>
            ))}
          </ol>
          <ol className="ac-tl mt-5 md:hidden">
            {([1, 2, 3, 4, 5] as const).map((k) => (
              <li key={k} className={`ac-ev ${k === 1 ? "ac-ev-now" : ""}`} style={k === 5 ? { paddingBottom: 0 } : undefined}>
                <b>{t(`lp.j${k}.t`)}</b>
                <div className="text-sm text-muted">{t(`lp.j${k}.d`, { n })}</div>
              </li>
            ))}
          </ol>
        </Card>
      </Section>

      {/* 3 · built to be checked: an asymmetric row of four tiles */}
      <Section className="pt-8">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="t-h1">
            {t("lp.trust.pre")} <span className="hl">{t("lp.trust.hl")}</span>
          </h2>
          <span className="text-sm text-muted">{t("lp.trust.sub")}</span>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.2fr]">
          <Card tone="dark" className="min-h-[250px]">
            <span className="ac-ic text-lime" aria-hidden>∑</span>
            <h3 className="t-h3 mt-4">{t("lp.t1.t")}</h3>
            <p className="mt-2 text-sm text-muted">{t("lp.t1.d")}</p>
          </Card>
          <Card tone="lav" className="min-h-[250px]">
            <span className="ac-ic" aria-hidden>✓</span>
            <h3 className="t-h3 mt-4">{t("lp.t2.t")}</h3>
            <p className="mt-2 text-sm">{t("lp.t2.d")}</p>
          </Card>
          <Card tone="burg" className="min-h-[250px]">
            <span className="ac-ic" aria-hidden>?</span>
            <h3 className="t-h3 mt-4">{t("lp.t3.t")}</h3>
            <p className="mt-2 text-sm text-muted">{t("lp.t3.d")}</p>
          </Card>
          <Card tone="dark" className="min-h-[250px]">
            <span className="ac-ic text-lime" aria-hidden>₹</span>
            <h3 className="t-h3 mt-4">{t("lp.t4.t")}</h3>
            <p className="mt-2 text-sm text-muted">{t("lp.t4.d")}</p>
            <Link href="/transparency" className="und mt-4 inline-block min-h-11 text-xs text-lime">
              {t("lp.t4.link")}
            </Link>
          </Card>
        </div>
      </Section>

      {/* 4 · AI versus humans: two visibly different cards that preview the draft and approved styles used on every plan page */}
      <Section className="pt-14">
        <div className="grid items-start gap-8 wd:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <span className="t-label">{t("lp.split.kicker")}</span>
            <h2 className="t-h1 mt-3">
              {t("lp.split.t1")}
              <br />
              {t("lp.split.t2")}
            </h2>
            <p className="t-lead mt-4">{t("lp.split.lead")}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="s-dark ac-card ac-draft bg-[#2A2418]">
              <Chip tone="warn">{t("lp.draft.chip")}</Chip>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-muted">
                {[1, 2, 3, 4].map((k) => (
                  <li key={k}>• {t(`lp.draft.${k}`)}</li>
                ))}
              </ul>
            </div>
            <div className="s-ivory ac-card ac-approved !bg-[#E3EFE6]">
              <Chip tone="ok">{t("lp.appr.chip")}</Chip>
              <ul className="mt-4 flex flex-col gap-2 text-sm text-muted">
                {[1, 2, 3, 4].map((k) => (
                  <li key={k}>• {t(`lp.appr.${k}`)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      {/* 5 · the three content labels, introduced here and repeated as chips everywhere */}
      <Section className="pt-14">
        <Card tone="dark" className="!p-9 max-md:!p-5">
          <h2 className="t-h2">{t("lp.labels.title")}</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <div>
              <Chip tone="info">EDUCATION</Chip>
              <p className="mt-2 text-sm text-muted">{t("lp.labels.edu")}</p>
            </div>
            <div>
              <Chip tone="neu" style={{ background: "#555" }}>ANALYSIS</Chip>
              <p className="mt-2 text-sm text-muted">{t("lp.labels.ana")}</p>
            </div>
            <div>
              <Chip tone="ok">REVIEWED (DEMO)</Chip>
              <p className="mt-2 text-sm text-muted">{t("lp.labels.rev")}</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-muted">{t("lp.labels.note")}</p>
        </Card>
      </Section>

      {/* 6 · the closing call to action: the one lime block of the lower page */}
      <Section className="pt-8">
        <Card tone="lime" className="flex flex-wrap items-center justify-between gap-6 !p-11 max-md:!p-6">
          <div>
            <div className="t-h1">{t("lp.final.t")}</div>
            <div className="mt-2 text-sm text-muted">{t("lp.final.d")}</div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row max-sm:w-full">
            <Btn disabled={loading} onClick={() => void go("fresh")} className="max-sm:w-full">
              {t("lp.cta.start")}
            </Btn>
            <LinkBtn href="/second-opinion" variant="secondary" className="max-sm:w-full">
              {t("nav2.explore")}
            </LinkBtn>
          </div>
        </Card>
      </Section>
    </div>
  );
}
