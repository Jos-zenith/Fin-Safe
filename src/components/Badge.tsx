"use client";
import { BadgeCheck, BookOpen, Calculator, PencilLine, type LucideIcon } from "lucide-react";

export type BadgeKind = "EDUCATION" | "ANALYSIS" | "DRAFT" | "REVIEWED";

// Exactly one badge per piece of content. Icon + text, never colour alone.
const MAP: Record<BadgeKind, { icon: LucideIcon; text: string; cls: string }> = {
  EDUCATION: { icon: BookOpen, text: "EDUCATION", cls: "ac-chip-info" },
  ANALYSIS: { icon: Calculator, text: "ANALYSIS", cls: "ac-chip-neui" },
  DRAFT: { icon: PencilLine, text: "DRAFT PLAN (AI-PREPARED)", cls: "ac-chip-warn" },
  REVIEWED: { icon: BadgeCheck, text: "REVIEWED (DEMO)", cls: "ac-chip-ok" },
};

export function Badge({ kind, className = "" }: { kind: BadgeKind; className?: string }) {
  const { icon: Icon, text, cls } = MAP[kind];
  return (
    <span role="status" aria-label={`Content type: ${text}`} className={`ac-chip uppercase tracking-wide ${cls} ${className}`}>
      <Icon size={13} aria-hidden />
      {text}
    </span>
  );
}
