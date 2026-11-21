"use client";
// The intake questions as reusable inputs: the chat-style intake asks the six CORE ones first, and the dashboard
// offers the OPTIONAL ones afterwards as "Improve accuracy" steps.
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { AmountPad } from "@/components/AmountPad";
import { VoiceButton } from "@/components/Voice";
import { Btn } from "@/components/ui";
import { SAMPLE_PORTFOLIO } from "@/data/personas";
import { parseHoldingsCsv } from "@/lib/csv";
import { inr } from "@/lib/format";
import { LANGS } from "@/i18n";
import { useApp } from "@/store/AppProvider";
import type { GoalKind, Lang, UserProfile } from "@/types";

/** The six questions that are enough for a first result. */
export const CORE_STEPS = ["monthlyIncome", "essential", "savings", "debts", "dependents", "goals"] as const;
/** Everything else is optional and sharpens the numbers; defaults are used until it is answered. */
export const OPTIONAL_STEPS = ["goalSaved", "incomeMonths", "name", "city", "income", "other", "term", "employer", "health", "holdings", "risk1", "risk2"] as const;
export type Step = (typeof CORE_STEPS)[number] | (typeof OPTIONAL_STEPS)[number] | "lang";
export type OptionalStep = (typeof OPTIONAL_STEPS)[number];
const KINDS: GoalKind[] = ["home", "education", "retirement", "travel", "wedding", "other"];
/** Tap-to-fill amounts above the keypad. They only fill the box; nothing is saved until the person presses Continue. */
const QUICK = {
  monthlyIncome: [25_000, 50_000, 75_000],
  essential: [15_000, 25_000, 40_000],
  other: [5_000, 10_000, 20_000],
  savings: [10_000, 50_000, 100_000],
};

export function intakeSummary(s: Step, p: UserProfile, t: (k: string, v?: Record<string, string | number>) => string): string {
  switch (s) {
    case "lang":
      return LANGS.find((l) => l.id === p.language)?.full ?? "";
    case "name":
      return p.name || "—";
    case "city":
      return t(`intake.city.${p.cityTier}`);
    case "income":
      return t(p.incomeStable ? "intake.income.stable" : "intake.income.irregular");
    case "monthlyIncome":
      return inr(p.monthlyIncome);
    case "essential":
      return inr(p.essentialExpenses);
    case "other":
      return inr(p.otherExpenses);
    case "dependents":
      return String(p.dependents);
    case "savings":
      return inr(p.liquidSavings);
    case "debts":
      return p.debts.length ? t("intake.sum.debts", { n: p.debts.length, amt: inr(p.debts.reduce((a, d) => a + d.outstanding, 0)) }) : t("intake.none");
    case "term":
      return cover(p, "term") ? inr(cover(p, "term")) : t("intake.none");
    case "health":
      return cover(p, "health") ? inr(cover(p, "health")) : t("intake.none");
    case "goals":
      return p.goals.length ? p.goals.map((g) => `${t(`goal.${g.kind}`)} ${inr(g.targetAmount)}`).join(", ") : t("intake.none");
    case "incomeMonths":
      return p.incomeMonths ? `${inr(p.incomeMonths.bad)} – ${inr(p.incomeMonths.good)}` : t("intake.none");
    case "employer":
      return p.employerTermCover === undefined ? t("confirm.unknown") : p.employerTermCover > 0 ? inr(p.employerTermCover) : t("intake.none");
    case "goalSaved": {
      const saved = p.goals.reduce((a, g) => a + (g.savedSoFar ?? 0), 0);
      return saved > 0 ? inr(saved) : t("intake.none");
    }
    case "holdings":
      return p.holdings.length ? t("intake.sum.holdings", { n: p.holdings.length, amt: inr(p.holdings.reduce((a, h) => a + h.amount, 0)) }) : t("intake.none");
    case "risk1":
      return t(`intake.fall.${p.risk.onFall}`);
    case "risk2":
      return t(p.risk.followsTips ? "common.yes" : "common.no");
  }
}
const cover = (p: UserProfile, kind: "term" | "health") => p.insurance.filter((x) => x.kind === kind).reduce((a, x) => a + x.cover, 0);

function setCover(p: UserProfile, kind: "term" | "health", amount: number): UserProfile {
  const rest = p.insurance.filter((x) => x.kind !== kind);
  return { ...p, insurance: amount > 0 ? [...rest, { id: `i-${kind}`, kind, cover: amount }] : rest };
}

function Chips({ options, onPick }: { options: { id: string; label: string; active?: boolean }[]; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.active}
          onClick={() => onPick(o.id)}
          className={`min-h-12 rounded-full border px-5 font-semibold transition active:scale-95 ${o.active ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Numbers typed or pasted into a text box: "42000, 18000 55000" -> [42000, 18000, 55000] (the latest 12). */
export function parseMonths(text: string): number[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => Number.isFinite(n)).slice(-12);
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};

type SubFlow =
  | null
  | { type: "months"; stage: number; v: number[] }
  | { type: "debt"; stage: number; v: { outstanding: number; ratePct: number } }
  | { type: "goal"; stage: number; v: { kind: GoalKind; target: number } }
  | { type: "saved"; idx: number; values: number[] };

export function IntakeInput({ step, p, onNext, onLang, lang }: { step: Step; p: UserProfile; onNext: (p: UserProfile) => void; onLang?: (l: Lang) => void; lang: Lang }) {
  const { t } = useApp();
  const [name, setName] = useState(p.name);
  const [sub, setSub] = useState<SubFlow>(null);
  const [csv, setCsv] = useState("");
  const [showCsv, setShowCsv] = useState(false);
  const [list, setList] = useState("");
  const [showList, setShowList] = useState(false);
  const [listErr, setListErr] = useState(false);
  const cont = t("common.next");
  const perMonth = `/${t("common.month")}`;

  switch (step) {
    case "lang":
      return <Chips options={LANGS.map((l) => ({ id: l.id, label: l.full, active: lang === l.id }))} onPick={(id) => onLang?.(id as Lang)} />;
    case "name":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 30))}
              placeholder={t("intake.namePh")}
              aria-label={t("intake.q.name")}
              className="min-h-12 flex-1 rounded-2xl border border-line bg-bg px-4 text-lg"
            />
            <VoiceButton onText={(x) => setName(x.slice(0, 30))} />
          </div>
          <Btn block onClick={() => onNext({ ...p, name: name.trim() || t("intake.friend") })}>
            {cont}
          </Btn>
        </div>
      );
    case "city":
      return <Chips options={[1, 2, 3].map((n) => ({ id: String(n), label: t(`intake.city.${n}`), active: p.cityTier === n }))} onPick={(id) => onNext({ ...p, cityTier: Number(id) as 1 | 2 | 3 })} />;
    case "income":
      return (
        <Chips
          options={[
            { id: "s", label: t("intake.income.stable"), active: p.incomeStable },
            { id: "i", label: t("intake.income.irregular"), active: !p.incomeStable },
          ]}
          onPick={(id) => onNext({ ...p, incomeStable: id === "s" })}
        />
      );
    case "monthlyIncome":
      return <AmountPad initial={p.monthlyIncome} per={perMonth} quick={QUICK.monthlyIncome} warnAbove={1_000_000} submitLabel={cont} onSubmit={(n) => onNext({ ...p, monthlyIncome: n })} />;
    case "essential":
      return <AmountPad initial={p.essentialExpenses} per={perMonth} quick={QUICK.essential} warnAbove={500_000} submitLabel={cont} onSubmit={(n) => onNext({ ...p, essentialExpenses: n })} />;
    case "other":
      return <AmountPad initial={p.otherExpenses} per={perMonth} quick={QUICK.other} warnAbove={500_000} submitLabel={cont} onSubmit={(n) => onNext({ ...p, otherExpenses: n })} />;
    case "savings":
      return <AmountPad initial={p.liquidSavings} quick={QUICK.savings} warnAbove={50_000_000} submitLabel={cont} onSubmit={(n) => onNext({ ...p, liquidSavings: n })} />;
    case "dependents":
      return <Stepper value={p.dependents} onChange={(n) => onNext({ ...p, dependents: n })} cont={cont} />;
    case "term":
      return (
        <AmountPad
          initial={cover(p, "term")}
          submitLabel={cont}
          onSubmit={(n) => onNext(setCover(p, "term", n))}
          secondary={{ label: t("intake.noCover"), onClick: () => onNext(setCover(p, "term", 0)) }}
        />
      );
    case "health":
      return (
        <AmountPad
          initial={cover(p, "health")}
          submitLabel={cont}
          onSubmit={(n) => onNext(setCover(p, "health", n))}
          secondary={{ label: t("intake.noCover"), onClick: () => onNext(setCover(p, "health", 0)) }}
        />
      );
    case "debts": {
      if (sub?.type === "debt") {
        const stages = [
          { key: "intake.loan.amount", prefix: "₹", suffix: "", decimal: false, initial: 0 },
          { key: "intake.loan.rate", prefix: "", suffix: "%", decimal: true, initial: 0 },
          { key: "intake.loan.emi", prefix: "₹", suffix: "", decimal: false, initial: 0 },
        ];
        const monthlyStage = sub.stage === 2; // the EMI is a monthly payment
        const st = stages[sub.stage];
        return (
          <div>
            <p className="mb-1 text-center font-semibold">{t(st.key)}</p>
            <AmountPad
              key={sub.stage}
              initial={st.initial}
              prefix={st.prefix}
              suffix={st.suffix}
              per={monthlyStage ? perMonth : undefined}
              decimal={st.decimal}
              max={st.suffix ? 100 : 1e9}
              submitLabel={cont}
              onSubmit={(n) => {
                if (sub.stage === 0) setSub({ ...sub, stage: 1, v: { ...sub.v, outstanding: n } });
                else if (sub.stage === 1) setSub({ ...sub, stage: 2, v: { ...sub.v, ratePct: n } });
                else {
                  setSub(null);
                  onNext({ ...p, debts: [...p.debts, { id: `d${p.debts.length + 1}`, label: t("intake.loanLabel"), outstanding: sub.v.outstanding, ratePct: sub.v.ratePct, emi: n }] });
                }
              }}
            />
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {p.debts.length > 0 && (
            <ul className="space-y-1.5">
              {p.debts.map((d) => (
                <li key={d.id} className="num flex justify-between rounded-xl bg-primary-soft px-3 py-2 text-sm">
                  <span>{d.label}</span>
                  <span>
                    {inr(d.outstanding)} · {d.ratePct}% · {inr(d.emi)}/{t("common.month")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2">
            <Btn onClick={() => onNext(p)}>{p.debts.length ? t("intake.looksRight") : t("intake.noLoans")}</Btn>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="soft" onClick={() => setSub({ type: "debt", stage: 0, v: { outstanding: 0, ratePct: 0 } })}>
                {t("intake.addLoan")}
              </Btn>
              {p.debts.length > 0 && (
                <Btn variant="secondary" onClick={() => onNext({ ...p, debts: [] })}>
                  {t("intake.noLoans")}
                </Btn>
              )}
            </div>
          </div>
        </div>
      );
    }
    case "goals": {
      if (sub?.type === "goal") {
        if (sub.stage === 0)
          return <Chips options={KINDS.map((k) => ({ id: k, label: t(`goal.${k}`) }))} onPick={(k) => setSub({ type: "goal", stage: 1, v: { kind: k as GoalKind, target: 0 } })} />;
        if (sub.stage === 1)
          return (
            <div>
              <p className="mb-1 text-center font-semibold">{t("intake.goal.amount")}</p>
              <AmountPad key="a" initial={0} submitLabel={cont} onSubmit={(n) => setSub({ ...sub, stage: 2, v: { ...sub.v, target: n } })} />
            </div>
          );
        return (
          <div>
            <p className="mb-1 text-center font-semibold">{t("intake.goal.years")}</p>
            <AmountPad
              key="y"
              initial={5}
              prefix=""
              suffix={` ${t("common.years")}`}
              max={50}
              submitLabel={cont}
              onSubmit={(n) => {
                setSub(null);
                onNext({ ...p, goals: [...p.goals, { id: `g${p.goals.length + 1}`, kind: sub.v.kind, targetAmount: sub.v.target, years: Math.max(1, n) }] });
              }}
            />
          </div>
        );
      }
      return (
        <div className="space-y-3">
          {p.goals.length > 0 && (
            <ul className="space-y-1.5">
              {p.goals.map((g) => (
                <li key={g.id} className="num flex justify-between rounded-xl bg-primary-soft px-3 py-2 text-sm">
                  <span>{t(`goal.${g.kind}`)}</span>
                  <span>
                    {inr(g.targetAmount)} · {g.years} {t("common.years")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2">
            <Btn onClick={() => onNext(p)}>{p.goals.length ? t("intake.looksRight") : t("common.skip")}</Btn>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="soft" onClick={() => setSub({ type: "goal", stage: 0, v: { kind: "home", target: 0 } })}>
                {t("intake.addGoal")}
              </Btn>
              {p.goals.length > 0 && (
                <Btn variant="secondary" onClick={() => onNext({ ...p, goals: [] })}>
                  {t("intake.clearGoals")}
                </Btn>
              )}
            </div>
          </div>
        </div>
      );
    }
    case "incomeMonths": {
      // Good, usual and bad month (or a pasted list of recent months). Without these, "irregular income" uses stated defaults.
      if (showList) {
        return (
          <div className="space-y-3">
            <textarea value={list} onChange={(e) => setList(e.target.value)} rows={3} placeholder={t("intake.months.listPh")} aria-label={t("intake.months.listLabel")} className="w-full rounded-2xl border border-line bg-bg p-3 font-mono text-sm" />
            {listErr && (
              <p role="alert" className="text-sm font-semibold text-draft">
                {t("intake.months.listErr")}
              </p>
            )}
            <Btn
              block
              onClick={() => {
                const h = parseMonths(list);
                if (h.length < 2) return setListErr(true);
                setListErr(false);
                setShowList(false);
                onNext({ ...p, monthlyIncome: median(h), incomeStable: false, incomeMonths: { good: Math.max(...h), bad: Math.min(...h), history: h } });
              }}
            >
              {t("intake.months.listUse")}
            </Btn>
            <Btn block variant="secondary" onClick={() => setShowList(false)}>
              {t("intake.months.back")}
            </Btn>
          </div>
        );
      }
      const stage = sub?.type === "months" ? sub.stage : 0;
      const v = sub?.type === "months" ? sub.v : [p.incomeMonths?.good ?? p.monthlyIncome, p.monthlyIncome, p.incomeMonths?.bad ?? 0];
      const labels = ["intake.months.good", "intake.months.typical", "intake.months.bad"];
      return (
        <div>
          <p className="mb-1 text-center font-semibold">{t(labels[stage])}</p>
          <AmountPad
            key={stage}
            initial={v[stage]}
            per={perMonth}
            warnAbove={1_000_000}
            submitLabel={cont}
            onSubmit={(n) => {
              const nv = v.map((x, i) => (i === stage ? n : x));
              if (stage < 2) return setSub({ type: "months", stage: stage + 1, v: nv });
              setSub(null);
              const [good, typical, bad] = nv;
              const hi = Math.max(good, typical, bad);
              const lo = Math.min(good, typical, bad);
              onNext({ ...p, monthlyIncome: typical, incomeStable: hi === lo, incomeMonths: { good: hi, bad: lo } });
            }}
          />
          <button type="button" onClick={() => setShowList(true)} className="mt-2 min-h-11 w-full text-center text-sm font-semibold text-primary">
            {t("intake.months.list")}
          </button>
        </div>
      );
    }
    case "employer":
      return (
        <AmountPad
          initial={p.employerTermCover ?? 0}
          submitLabel={cont}
          onSubmit={(n) => onNext({ ...p, employerTermCover: n })}
          secondary={{ label: t("intake.employer.unknown"), onClick: () => onNext({ ...p, employerTermCover: undefined }) }}
        />
      );
    case "goalSaved": {
      // One question per goal: how much is already set aside for it. It is counted, with growth, in the monthly amount.
      if (!p.goals.length) {
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t("intake.goalSaved.none")}</p>
            <Btn block onClick={() => onNext(p)}>
              {t("common.skip")}
            </Btn>
          </div>
        );
      }
      const idx = sub?.type === "saved" ? sub.idx : 0;
      const values = sub?.type === "saved" ? sub.values : p.goals.map((g) => g.savedSoFar ?? 0);
      const g = p.goals[idx];
      return (
        <div>
          <p className="mb-1 text-center font-semibold">{t("intake.goalSaved.for", { kind: t(`goal.${g.kind}`), amount: inr(g.targetAmount) })}</p>
          <AmountPad
            key={g.id}
            initial={values[idx] ?? 0}
            submitLabel={cont}
            onSubmit={(n) => {
              const next = values.map((v, i) => (i === idx ? n : v));
              if (idx + 1 < p.goals.length) setSub({ type: "saved", idx: idx + 1, values: next });
              else {
                setSub(null);
                onNext({ ...p, goals: p.goals.map((x, i) => ({ ...x, savedSoFar: next[i] })) });
              }
            }}
          />
        </div>
      );
    }
    case "holdings":
      return (
        <div className="space-y-3">
          {p.holdings.length > 0 && (
            <ul className="space-y-1.5">
              {p.holdings.map((h) => (
                <li key={h.id} className="num flex justify-between rounded-xl bg-primary-soft px-3 py-2 text-sm">
                  <span>{h.label}</span>
                  <span>{inr(h.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {showCsv && (
            <div className="space-y-2">
              <p className="rounded-xl bg-draft-soft p-2 text-xs text-draft">{t("intake.csvWarn")}</p>
              <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} placeholder={t("intake.csvPh")} aria-label={t("intake.csv")} className="w-full rounded-2xl border border-line bg-bg p-3 font-mono text-sm" />
              <Btn
                block
                onClick={() => {
                  const h = parseHoldingsCsv(csv);
                  setShowCsv(false);
                  onNext({ ...p, holdings: h });
                }}
              >
                {t("intake.csvUse")}
              </Btn>
            </div>
          )}
          {!showCsv && (
            <div className="grid gap-2">
              <Btn onClick={() => onNext(p)}>{p.holdings.length ? t("intake.looksRight") : t("common.skip")}</Btn>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="soft" onClick={() => setShowCsv(true)}>
                  {t("intake.pasteCsv")}
                </Btn>
                <Btn variant="soft" onClick={() => onNext({ ...p, holdings: SAMPLE_PORTFOLIO.map((h) => ({ ...h })) })}>
                  {t("intake.useSample")}
                </Btn>
              </div>
            </div>
          )}
        </div>
      );
    case "risk1":
      return <Chips options={(["sell", "wait", "buy"] as const).map((k) => ({ id: k, label: t(`intake.fall.${k}`), active: p.risk.onFall === k }))} onPick={(k) => onNext({ ...p, risk: { ...p.risk, onFall: k as "sell" | "wait" | "buy" } })} />;
    case "risk2":
      return (
        <Chips
          options={[
            { id: "y", label: t("common.yes"), active: p.risk.followsTips },
            { id: "n", label: t("common.no"), active: !p.risk.followsTips },
          ]}
          onPick={(id) => onNext({ ...p, risk: { ...p.risk, followsTips: id === "y" } })}
        />
      );
  }
}

function Stepper({ value, onChange, cont }: { value: number; onChange: (n: number) => void; cont: string }) {
  const [n, setN] = useState(value);
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-center gap-6">
        <button type="button" aria-label="-" onClick={() => setN(Math.max(0, n - 1))} className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <Minus aria-hidden />
        </button>
        <span className="num w-16 text-center text-4xl font-bold" aria-live="polite">
          {n}
        </span>
        <button type="button" aria-label="+" onClick={() => setN(Math.min(8, n + 1))} className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <Plus aria-hidden />
        </button>
      </div>
      <Btn block onClick={() => onChange(n)}>
        {cont}
      </Btn>
    </div>
  );
}
