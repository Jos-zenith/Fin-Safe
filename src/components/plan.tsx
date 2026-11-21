"use client";
import { Check, Coins, FileText, Landmark, Layers, PiggyBank, Shield, TrendingUp, Globe2 } from "lucide-react";
import type { ReactNode } from "react";
import type { AssetClass } from "@/lib/ai/schemas";
import { useApp } from "@/store/AppProvider";

const ICON: Record<AssetClass, typeof Check> = {
  liquid_reserve: PiggyBank,
  debt: Layers,
  equity: TrendingUp,
  gold: Coins,
  international_equity: Globe2,
  insurance_cover: Shield,
  debt_repayment: Landmark,
  other_planning: FileText,
};

export function AssetChip({ cls }: { cls: AssetClass }) {
  const { t } = useApp();
  const Icon = ICON[cls];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
      <Icon size={13} aria-hidden />
      {t(`asset.${cls}`)}
    </span>
  );
}

export function AssetIcon({ cls }: { cls: AssetClass }) {
  const Icon = ICON[cls];
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden>
      <Icon size={22} />
    </span>
  );
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wide text-muted">{title}</h4>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
