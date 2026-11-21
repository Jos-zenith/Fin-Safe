"use client";
import { ACK_SENTENCE, ADVISER, ADVISER_CARD_SENTENCE, DEMO_WORKFLOW_SENTENCE, NO_REGISTRATION, REVIEWED_SENTENCE } from "@/data/adviser";
import { useApp } from "@/store/AppProvider";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";

const EN = {
  demoWorkflow: DEMO_WORKFLOW_SENTENCE,
  reviewed: REVIEWED_SENTENCE,
  adviserCard: ADVISER_CARD_SENTENCE,
  noReg: NO_REGISTRATION,
  ack: ACK_SENTENCE,
} as const;

export type LegalKey = keyof typeof EN;

/** Required sentences. In Hindi/Tamil the exact English wording stays visible beneath the translation. */
export function Legal({ k, className = "" }: { k: LegalKey; className?: string }) {
  const { t, lang } = useApp();
  return (
    <span className={className}>
      {t(`legal.${k}`)}
      {lang !== "en" && (
        <span lang="en" className="mt-0.5 block text-xs text-muted">
          {EN[k]}
        </span>
      )}
    </span>
  );
}

export function AdviserCard({ compact }: { compact?: boolean }) {
  const { t } = useApp();
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
      <Avatar name={ADVISER.name} size={compact ? 44 : 52} tone={1} />
      <div className="min-w-0 text-sm">
        <p className="text-base font-semibold">{ADVISER.name}</p>
        <p className="text-muted">
          <Legal k="adviserCard" />
        </p>
        <p className="mt-1 text-muted">
          <span className="font-medium text-fg">{t("adviser.registration")}: </span>
          <Legal k="noReg" />
        </p>
        <p className="mt-1 text-xs text-muted" data-testid="adviser-identity-note">
          {t("adviser.realNote")}
        </p>
      </div>
    </div>
  );
}

export function ReviewedBlock() {
  return (
    <div className="rounded-2xl border border-reviewed/40 bg-reviewed-soft p-4">
      <Badge kind="REVIEWED" />
      <p className="mt-2 font-medium text-reviewed">
        <Legal k="reviewed" />
      </p>
    </div>
  );
}
