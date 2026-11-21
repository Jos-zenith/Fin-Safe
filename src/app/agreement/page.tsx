"use client";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Card, Page } from "@/components/ui";
import { ECONOMICS } from "@/config/economics";
import { CONSENT_VERSION } from "@/config/workflow";
import { useEngine } from "@/lib/hooks";
import { riskComplete, RISK_OPTIONS, RISK_QUESTIONS, scoreRisk, type RiskAnswers } from "@/lib/risk";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";

/**
 * Before a case can enter the adviser's queue: a short risk questionnaire and the customer's DEMO consent. The server
 * refuses to create the case without both. Ticking the box is not an e-signature and creates nothing binding.
 */
export default function Agreement() {
  const { state, t, lang } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const profile = state?.profile ?? null;
  const engine = useEngine(profile);
  const [answers, setAnswers] = useState<RiskAnswers>({});
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // once this page has submitted, it leaves for the review-requested page itself (the effect below must not race it)
  const submitted = useRef(false);

  useEffect(() => {
    if (state && !state.profile) router.replace("/");
  }, [state, router]);
  useEffect(() => {
    if (wf.loaded && wf.myCase && !submitted.current) router.replace(`/case/${encodeURIComponent(wf.myCase.id)}`); // already has a case: nothing to agree to again
  }, [wf.loaded, wf.myCase, router]);

  const complete = riskComplete(answers);
  const result = useMemo(() => (profile && engine && riskComplete(answers) ? scoreRisk(answers, profile, engine) : null), [answers, profile, engine]);
  if (!state || !profile || !engine) return null;

  const go = async () => {
    if (!riskComplete(answers) || !agreed) return;
    setBusy(true);
    setFailed(false);
    const agreement = { risk: answers as Record<string, number>, consent: { accepted: true, version: CONSENT_VERSION } };
    const escalate = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("then") === "escalate";
    submitted.current = true;
    const r = escalate ? await wf.escalate(lang, agreement) : await wf.submit(lang, agreement);
    setBusy(false);
    if (!r.ok) submitted.current = false;
    // the request is in: confirm it, with the case reference, on the review-requested page
    if (r.ok && r.data?.case) router.push(`/case/${encodeURIComponent(r.data.case.id)}/review-requested`);
    else if (r.ok) router.push("/dashboard");
    else setFailed(true);
  };

  return (
    <Page size="lg">
      <h1 className="text-xl font-bold">{t("agree.title")}</h1>
      <p className="mb-3 mt-1 text-sm text-muted">{t("agree.sub")}</p>

      <Card>
        <h2 className="font-semibold">{t("agree.risk.title")}</h2>
        <p className="mb-2 text-sm text-muted">{t("agree.risk.sub")}</p>
        <div className="space-y-4">
          {RISK_QUESTIONS.map((q) => (
            <fieldset key={q.id} data-testid={`risk-q-${q.id}`} className="rounded-2xl border border-line p-3">
              <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted">{t(`risk.group.${q.group}`)}</legend>
              <p className="mb-1 font-medium">{t(`risk.q.${q.id}`)}</p>
              <div className="grid gap-1">
                {Array.from({ length: RISK_OPTIONS }, (_, i) => (
                  <label key={i} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-primary-soft">
                    <input type="radio" name={q.id} value={i} checked={answers[q.id] === i} onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))} className="size-5 accent-[var(--primary)]" />
                    <span>{t(`risk.o.${q.id}.${i}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        {result && (
          <div className="mt-3 rounded-2xl bg-primary-soft p-3" data-testid="risk-preview">
            <p className="font-bold">{t("risk.yourProfile", { cat: t(`risk.cat.${result.category}`) })}</p>
            <p className="text-xs text-muted">{t("risk.note")}</p>
            {result.checks.map((k) => (
              <p key={k} className="mt-1 text-sm text-draft">
                {t(`risk.check.${k}`)}
              </p>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={18} className="text-primary" aria-hidden /> {t("agree.consent.title")}
        </h2>
        <ul className="mt-2 space-y-2 text-sm" data-testid="consent-text">
          <li>{t("agree.consent.fee", { fee: ECONOMICS.userFee })}</li>
          <li>{t("agree.consent.conflicts")}</li>
          <li>{t("agree.consent.demo")}</li>
          <li className="font-semibold">{t("agree.consent.noEsign")}</li>
          <li>{t("agree.consent.data")}</li>
        </ul>
        <label className="mt-3 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 size-5 accent-[var(--primary)]" />
          <span className="font-medium">{t("agree.consent.tick")}</span>
        </label>
      </Card>

      {failed && (
        <p role="alert" className="mt-3 rounded-xl bg-draft-soft p-2 text-sm font-semibold text-draft">
          {t("agree.error")}
        </p>
      )}
      <div className="mt-3 grid gap-2">
        <Btn block disabled={!complete || !agreed || busy} onClick={() => void go()}>
          {t("agree.cta")}
        </Btn>
        {(!complete || !agreed) && <p className="text-center text-xs text-muted">{t("agree.missing")}</p>}
      </div>
    </Page>
  );
}
