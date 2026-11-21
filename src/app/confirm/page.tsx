"use client";
import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IntakeInput, OPTIONAL_STEPS, type Step } from "@/components/IntakeInput";
import { DataQualityCard, useQuality } from "@/components/Quality";
import { Sheet } from "@/components/Sheet";
import { Btn, Card, Page } from "@/components/ui";
import { inr } from "@/lib/format";
import { useEngine } from "@/lib/hooks";
import { CONFIRM_FIELDS, type FieldId } from "@/lib/quality";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { UserProfile } from "@/types";

/** Which intake question edits which field. */
const FIELD_STEP: Record<FieldId, Step> = {
  monthlyIncome: "monthlyIncome",
  essentialExpenses: "essential",
  otherExpenses: "other",
  liquidSavings: "savings",
  debts: "debts",
  dependents: "dependents",
  goals: "goals",
  goalSaved: "goalSaved",
  incomeStable: "income",
  incomeMonths: "incomeMonths",
  city: "city",
  term: "term",
  health: "health",
  employerTermCover: "employer",
  holdings: "holdings",
};

type RowStatus = "entered" | "default" | "check";
const ICON = { entered: CircleCheck, default: CircleHelp, check: TriangleAlert } as const;
const TONE = { entered: "bg-reviewed-soft text-reviewed", default: "bg-info-soft text-info", check: "bg-draft-soft text-draft" } as const;

export default function Confirm() {
  const { state, t, lang, update } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const profile = state?.profile ?? null;
  const engine = useEngine(profile);
  const quality = useQuality(profile, engine);
  const [editing, setEditing] = useState<FieldId | null>(null);
  const [ticks, setTicks] = useState<Set<FieldId> | null>(null);
  const [busy, setBusy] = useState(false);
  const hasCase = !!wf.myCase;

  useEffect(() => {
    if (state && !state.profile) router.replace("/");
  }, [state, router]);

  // fields in trouble (missing or off) and fields still on a default
  const trouble = useMemo(() => new Set<FieldId>((quality?.issues ?? []).filter((i) => i.kind !== "default").flatMap((i) => i.fields)), [quality]);
  const defaulted = useMemo(() => new Set<FieldId>((quality?.issues ?? []).filter((i) => i.kind === "default").flatMap((i) => i.fields)), [quality]);
  const statusOf = (f: FieldId): RowStatus => (trouble.has(f) ? "check" : defaulted.has(f) ? "default" : "entered");

  // start with ticks only on what the person entered and nothing looks wrong with; a default or an odd answer has to be ticked on purpose
  const initial = useMemo(() => new Set<FieldId>(CONFIRM_FIELDS.filter((f) => (profile?.confirmed ?? CONFIRM_FIELDS.filter((x) => !trouble.has(x) && !defaulted.has(x))).includes(f))), [profile?.confirmed, trouble, defaulted]);
  const ticked = ticks ?? initial;

  if (!state || !profile || !engine || !quality) return null;
  const p: UserProfile = profile;

  const valueOf = (f: FieldId): string => {
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const cover = (k: "term" | "health") => sum(p.insurance.filter((i) => i.kind === k).map((i) => i.cover));
    switch (f) {
      case "monthlyIncome":
        return p.monthlyIncome > 0 ? inr(p.monthlyIncome) : t("confirm.unknown");
      case "essentialExpenses":
        return p.essentialExpenses > 0 ? inr(p.essentialExpenses) : t("confirm.unknown");
      case "otherExpenses":
        return inr(p.otherExpenses);
      case "liquidSavings":
        return inr(p.liquidSavings);
      case "debts":
        return p.debts.length ? t("intake.sum.debts", { n: p.debts.length, amt: inr(sum(p.debts.map((d) => d.outstanding))) }) + ` · ${inr(sum(p.debts.map((d) => d.emi)))}/${t("common.month")}` : t("intake.none");
      case "dependents":
        return String(p.dependents);
      case "goals":
        return p.goals.length ? p.goals.map((g) => `${t(`goal.${g.kind}`)} ${inr(g.targetAmount)} · ${g.years} ${t("common.years")}`).join(", ") : t("intake.none");
      case "goalSaved": {
        const s = sum(p.goals.map((g) => g.savedSoFar ?? 0));
        return s > 0 ? inr(s) : t("intake.none");
      }
      case "incomeStable":
        return t(p.incomeStable ? "intake.income.stable" : "intake.income.irregular");
      case "incomeMonths":
        return p.incomeMonths ? `${inr(p.incomeMonths.bad)} – ${inr(p.incomeMonths.good)}` : t("confirm.unknown");
      case "city":
        return t(`intake.city.${p.cityTier}`);
      case "term":
        return cover("term") ? inr(cover("term")) : t("intake.none");
      case "health":
        return cover("health") ? inr(cover("health")) : t("intake.none");
      case "employerTermCover":
        return p.employerTermCover === undefined ? t("confirm.unknown") : p.employerTermCover > 0 ? inr(p.employerTermCover) : t("intake.none");
      case "holdings":
        return p.holdings.length ? t("intake.sum.holdings", { n: p.holdings.length, amt: inr(sum(p.holdings.map((h) => h.amount))) }) : t("intake.none");
    }
  };

  const toggle = (f: FieldId) => {
    const next = new Set(ticked);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    setTicks(next);
  };

  const edit = (f: FieldId, next: UserProfile) => {
    const step = FIELD_STEP[f];
    const fixed = f === "dependents" ? { ...next, familySize: next.dependents + 1 } : next;
    update((s) => ({ ...s, touched: true, profile: fixed, extras: (OPTIONAL_STEPS as readonly string[]).includes(step) ? [...new Set([...(s.extras ?? []), step])] : s.extras }));
    setTicks(new Set([...ticked, f])); // an edited answer is one the person has looked at
    setEditing(null);
  };

  const confirmAll = async () => {
    setBusy(true);
    const next: UserProfile = { ...p, confirmed: CONFIRM_FIELDS.filter((f) => ticked.has(f)) };
    update((s) => ({ ...s, profile: next }));
    await wf.saveProfile(next);
    setBusy(false);
    // a case needs the risk questionnaire and the customer's consent first (see /agreement)
    router.push(wf.myCase ? `/case/${encodeURIComponent(wf.myCase.id)}` : "/agreement");
  };

  const left = CONFIRM_FIELDS.filter((f) => !ticked.has(f)).length;
  return (
    <Page size="lg">
      <h1 className="text-xl font-bold">{t("confirm.title")}</h1>
      <p className="mb-3 mt-1 text-sm text-muted">{t("confirm.sub")}</p>
      <div className="mb-3">
        <DataQualityCard quality={quality} link={false} />
      </div>
      <Card>
        <ul className="divide-y divide-line" data-testid="confirm-list">
          {CONFIRM_FIELDS.map((f) => {
            const st = statusOf(f);
            const Icon = ICON[st];
            return (
              <li key={f} data-field={f} data-status={st} className="py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{t(`dq.field.${f}`)}</p>
                    <p className="num text-sm text-muted">{valueOf(f)}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${TONE[st]}`}>
                    <Icon size={12} aria-hidden /> {t(`confirm.s.${st}`)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-4">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={ticked.has(f)} onChange={() => toggle(f)} className="size-5 accent-[var(--primary)]" aria-label={`${t(`dq.field.${f}`)}: ${t("confirm.tick")}`} />
                    {t("confirm.tick")}
                  </label>
                  <button type="button" onClick={() => setEditing(f)} className="min-h-11 text-sm font-semibold text-primary" aria-label={`${t("confirm.edit")}: ${t(`dq.field.${f}`)}`}>
                    {t("confirm.edit")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {left > 0 && <p className="mt-3 text-sm text-muted">{t("confirm.unticked", { n: left })}</p>}
      <div className="mt-3 grid gap-2">
        <Btn block disabled={busy} onClick={() => void confirmAll()}>
          {hasCase ? t("confirm.ctaSave") : t("confirm.cta")}
        </Btn>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center font-semibold underline underline-offset-4">
          {t("confirm.back")}
        </Link>
      </div>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing ? t(`intake.q.${FIELD_STEP[editing]}`) : ""}>
        {editing && (
          <div className="text-fg">
            <p className="mb-3 text-sm text-muted">{t(`intake.hint.${FIELD_STEP[editing]}`)}</p>
            <IntakeInput key={editing} step={FIELD_STEP[editing]} p={p} lang={lang} onNext={(next) => edit(editing, next)} />
          </div>
        )}
      </Sheet>
    </Page>
  );
}
