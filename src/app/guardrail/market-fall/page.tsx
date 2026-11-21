"use client";
import { Wind } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Chip, Crumb, useDocTitle, useToast } from "@/components/ds";
import { Btn, Card, LinkBtn } from "@/components/ui";
import { SAMPLE_PORTFOLIO } from "@/data/personas";
import { marketFall } from "@/lib/engine";
import { useEngine } from "@/lib/hooks";
import { planHref } from "@/lib/nav";
import { api } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";

const PAUSE_SECONDS = 300;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Interrupts a panic-driven decision with calm facts. Deliberately quieter than the rest of the product: a darker
 * ground, no lime, three equal options and no way to sell. Showing it is recorded as a "cooling-off shown" event.
 */
export default function Guardrail() {
  const { state, t, lang } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const toast = useToast();
  const profile = state?.profile ?? null;
  const engine = useEngine(profile);
  const [left, setLeft] = useState<number | null>(null);
  const [donePause, setDonePause] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const logged = useRef(false);
  const c = wf.myCase;
  useDocTitle(t("gd.crumb"));

  useEffect(() => {
    document.documentElement.dataset.calm = "1";
    return () => {
      delete document.documentElement.dataset.calm;
    };
  }, []);

  // the pause itself is the cooling-off: record that it was shown, once (the server keeps it in the audit trail)
  useEffect(() => {
    if (logged.current || !profile || !wf.loaded || wf.role !== "customer") return;
    logged.current = true;
    void api("POST", "me/events", { kind: "cooling_off_shown" });
  }, [profile, wf.loaded, wf.role]);

  // a quiet five-minute countdown; nothing is asked of the person while it runs
  useEffect(() => {
    if (left === null) return;
    const id = window.setTimeout(() => {
      if (left <= 1) {
        setLeft(null);
        setDonePause(true);
      } else setLeft(left - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  if (!state) return null;
  const holdings = profile?.holdings.length ? profile.holdings : SAMPLE_PORTFOLIO;
  const fall = marketFall(holdings).value as Record<string, number>;
  const years = profile?.goals.length ? [...profile.goals.map((g) => g.years)].sort((a, b) => a - b) : [];
  const goalsText = years.length >= 2 ? t("gd.goals.two", { a: years[0], b: years[years.length - 1] }) : years.length === 1 ? t("gd.goals.one", { a: years[0] }) : t("gd.goals.none");

  const talk = async () => {
    if (!profile) return;
    setBusy(true);
    const r = await wf.escalate(lang);
    setBusy(false);
    if (!r.ok) {
      // no case yet: the customer must first answer the risk questions and consent, then the priority case is created
      if (r.error === "consent_required" || r.error === "risk_incomplete") router.push("/agreement?then=escalate");
      return;
    }
    setSent(true);
    toast.show(t("cool.sent"));
  };

  const fact = "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1";
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-12 md:px-6">
      <Crumb items={[{ label: t("nav2.home"), href: "/dashboard" }, { label: t("gd.crumb") }]} />
      <div className="pb-2 pt-8 md:pt-10">
        <Chip tone="lav">{t("gd.chip")}</Chip>
        <h1 className="t-display mt-6 text-[clamp(2.25rem,6.5vw,4.25rem)]">
          {t("gd.h1.a")} <span className="text-lav">{t("gd.h1.b")}</span>
        </h1>
        <p className="t-lead mt-6 max-w-[700px] text-[1.0625rem] md:text-[1.3125rem]">{t("gd.lead")}</p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card tone="dark" className="!bg-[#1d1d1d]">
          <div className="t-label">{t("gd.know")}</div>
          <div className="mt-4 flex flex-col gap-4">
            <div className={fact}><span className="text-muted">{t("gd.goals")}</span><b className="num text-[1.375rem]">{goalsText}</b></div>
            <hr className="ac-hr" />
            <div className={fact}>
              <span className="text-muted">{t("gd.reserve")}</span>
              <b className="num text-[1.375rem]">{engine ? `${(engine.flat["ef.months"] ?? 0).toFixed(1)} ${t("unit.months")}` : "—"}</b>
            </div>
            <hr className="ac-hr" />
            <div className={fact}><span className="text-muted">{t("gd.fall")}</span><b className="num text-[1.375rem]">{fall.drop}%</b></div>
          </div>
          <Link href="/sources" className="und mt-4 inline-block min-h-11 text-sm text-lav">{t("gd.src")}</Link>
        </Card>
        <Card tone="dark" className="!bg-[#1d1d1d]">
          <div className="t-label">{t("gd.nobody")}</div>
          <ul className="mt-4 flex flex-col gap-3 text-base text-muted">{[1, 2, 3].map((k) => <li key={k}>• {t(`gd.nobody.${k}`)}</li>)}</ul>
          <p className="mt-4 text-sm text-[#EAE7DD]">{t("gd.nobody.note")}</p>
        </Card>
      </div>

      <section className="mt-10" aria-labelledby="choose-h">
        <h2 id="choose-h" className="t-label">{t("gd.choose")}</h2>
        {/* three equal options, none highlighted; talking to a person is always available */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border-[1.5px] border-[#4a4a4a] px-6 py-5 max-md:px-4 hover:border-lav">
            <div className="min-w-0 flex-1 basis-72">
              <h3 className="t-h3">{t("gd.o1.t")}</h3>
              <p className="mt-2 text-sm text-muted">{left !== null ? t("gd.pause.left", { time: clock(left) }) : donePause ? t("gd.pause.done") : t("gd.o1.d")}</p>
              {left !== null && (
                <div className="breathe mt-4 grid size-20 place-items-center rounded-full bg-lav/20 text-lav" aria-hidden>
                  <Wind size={30} />
                </div>
              )}
            </div>
            {left !== null ? (
              <Btn variant="secondary" onClick={() => setLeft(null)}>{t("gd.pause.end")}</Btn>
            ) : (
              <Btn variant="secondary" onClick={() => { setDonePause(false); setLeft(PAUSE_SECONDS); }}>{t("gd.o1.b")}</Btn>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border-[1.5px] border-[#4a4a4a] px-6 py-5 max-md:px-4 hover:border-lav">
            <div className="min-w-0 flex-1 basis-72"><h3 className="t-h3">{t("gd.o2.t")}</h3><p className="mt-2 text-sm text-muted">{t("gd.o2.d")}</p></div>
            <LinkBtn href={planHref(c)} variant="secondary">{t("gd.o2.b")}</LinkBtn>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border-[1.5px] border-[#4a4a4a] px-6 py-5 max-md:px-4 hover:border-lav">
            <div className="min-w-0 flex-1 basis-72">
              <h3 className="t-h3">{t("gd.o3.t")}</h3>
              <p className="mt-2 text-sm text-muted">{t("gd.o3.d")}</p>
              {!profile && <p className="mt-2 text-xs text-muted">{t("gd.needProfile")}</p>}
              {sent && (
                <p role="status" className="mt-3 text-sm font-semibold text-[#9ADBB4]">
                  {t("cool.sent")}{" "}
                  {c && <Link href={`/case/${encodeURIComponent(c.id)}`} className="und">{t("gd.sent.link")}</Link>}
                </p>
              )}
            </div>
            <Btn variant="secondary" disabled={busy || !profile || sent} onClick={() => void talk()}>
              {busy ? t("status.preparing") : t("gd.o3.b")}
            </Btn>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted">{t("gd.nosell")}</p>
      </section>
    </div>
  );
}
