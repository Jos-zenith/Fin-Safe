"use client";
import { ShieldCheck, ShieldX } from "lucide-react";
import { wordDiff } from "@/lib/cases";
import type { ChainVerification } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import type { Actor } from "@/types";
import { Chip, type ChipTone } from "./ds";

/** "Audit chain verified" (or a warning), from the server's recomputation of the hash chain. */
export function ChainBadge({ chain }: { chain: ChainVerification | null }) {
  const { t } = useApp();
  if (!chain) return null;
  return chain.ok ? (
    <Chip tone="ok" data-testid="chain-status">
      <ShieldCheck size={14} aria-hidden /> {t("audit.chainOk", { n: chain.entries })}
    </Chip>
  ) : (
    <Chip tone="err" role="alert" data-testid="chain-status">
      <ShieldX size={14} aria-hidden /> {t("audit.chainBroken", { n: chain.brokenAt ?? 0 })}
    </Chip>
  );
}

/** The role chip beside an audit event. */
export function ActorChip({ actor }: { actor: Actor }) {
  const { t } = useApp();
  const tone: Record<Actor, ChipTone> = { user: "neu", ai: "warn", adviser: "info", system: "neu" };
  return <Chip tone={tone[actor]}>{t(`actor.${actor}`)}</Chip>;
}

/**
 * Tracked changes between the AI draft and the reviewed text. `side="draft"` shows the removed words struck through,
 * `side="reviewed"` the added words underlined by fill, so the difference reads without colour.
 */
export function DiffText({ draft, reviewed, side }: { draft: string; reviewed: string; side: "draft" | "reviewed" }) {
  const parts = wordDiff(draft, reviewed);
  return (
    <>
      {parts.map((p, i) => {
        if (p.t === "same") return <span key={i}>{p.s} </span>;
        if (p.t === "del") return side === "draft" ? <del key={i} className="ac-del">{p.s} </del> : null;
        return side === "reviewed" ? <ins key={i} className="ac-add">{p.s} </ins> : null;
      })}
    </>
  );
}
