"use client";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { unverifiedIn } from "@/config/assumptions";
import { useApp } from "@/store/AppProvider";

/**
 * Shown on any figure or plan item that depends on an assumption nobody has reviewed yet.
 * It links to the plain-language list of assumptions.
 */
export function UnverifiedTag({ ids, className = "" }: { ids: readonly string[]; className?: string }) {
  const { t, reviews } = useApp();
  const open = unverifiedIn(ids, reviews);
  if (!open.length) return null;
  return (
    <Link
      href="/assumptions"
      data-testid="unverified-tag"
      title={t("assump.tagHint", { n: open.length })}
      className={`inline-flex items-center gap-1 rounded-full bg-draft-soft px-2.5 py-1 text-[11px] font-bold text-draft underline-offset-2 hover:underline ${className}`}
    >
      <TriangleAlert size={12} aria-hidden />
      {t("assump.tag")}
    </Link>
  );
}
