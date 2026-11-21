"use client";
import Link from "next/link";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

/**
 * Base building blocks of the ArthClear design system (see src/app/globals.css). The legacy names (Btn, Card, Page, Empty,
 * Skeleton, StickyAction) keep their API; they now render the approved look. More pieces live in ./ds.tsx.
 */

export type Tone = "dark" | "ivory" | "lime" | "burg" | "lav";
export const SURFACE: Record<Tone, string> = {
  dark: "s-dark ac-bordered",
  ivory: "s-ivory",
  lime: "s-lime",
  burg: "s-burg",
  lav: "s-lav",
};

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "lime";

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export const btnClass = ({ variant = "primary", block, small, className = "" }: { variant?: Variant; block?: boolean; small?: boolean; className?: string }) =>
  cx("ac-btn", `ac-btn-${variant}`, small && "ac-btn-sm", block && "ac-btn-block", className);

export function Btn({
  variant = "primary",
  block,
  small,
  className = "",
  ...p
}: ComponentProps<"button"> & { variant?: Variant; block?: boolean; small?: boolean }) {
  return <button type="button" {...p} className={btnClass({ variant, block, small, className })} />;
}

/** A link that looks like a button. */
export function LinkBtn({
  variant = "primary",
  block,
  small,
  className = "",
  ...p
}: ComponentProps<typeof Link> & { variant?: Variant; block?: boolean; small?: boolean }) {
  return <Link {...p} className={btnClass({ variant, block, small, className })} />;
}

/** A large rounded container. Ivory by default (readable content); dark, lime, burgundy and lavender for emphasis. */
export function Card({ className = "", tone = "ivory", small, ...p }: HTMLAttributes<HTMLDivElement> & { tone?: Tone; small?: boolean }) {
  return <div {...p} className={cx(small ? "ac-card-s" : "ac-card", SURFACE[tone], className)} />;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-xl ${className}`} />;
}

/** The page column: the wireframes' 1440 grid with 40 / 24 / 16 px margins. `size` narrows it for single-column forms. */
export function Page({ children, wide, size }: { children: ReactNode; wide?: boolean; size?: "md" | "lg" | "xl" }) {
  const s = size ?? (wide ? "xl" : "md");
  const w = { md: "max-w-2xl", lg: "max-w-4xl", xl: "" }[s];
  return (
    <div className="ac-wrap pb-32 pt-4 md:pb-16 md:pt-6">
      <div className={cx("mx-auto w-full", w)}>{children}</div>
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="ac-ph flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-full border border-current text-fg">{icon}</div>
      <h2 className="t-h4 text-fg">{title}</h2>
      {body && <p className="max-w-xs text-muted">{body}</p>}
      {action}
    </div>
  );
}

/** Fixed action bar above the bottom nav (the primary action stays reachable on a phone). */
export function StickyAction({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 border-t border-[#2e2e2e] bg-char px-4 pb-2 pt-3 md:hidden">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
