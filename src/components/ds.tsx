"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { APP_NAME } from "@/config/brand";
import { useApp } from "@/store/AppProvider";
import { Btn, LinkBtn, SURFACE, type Tone } from "./ui";

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- brand */
/** The mark (a lime tile with a burgundy parallelogram) and the product name. */
export function Logo({ size = 34, className = "", href = "/" }: { size?: number; className?: string; href?: string | null }) {
  const inner = (
    <>
      <span aria-hidden className="ac-logo-mark" style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }} />
      {/* on the narrowest phones only the mark is shown (the name stays in the accessible label) so the header never overflows */}
      <span className="font-display text-[1.3125rem] font-bold tracking-tight text-white-ac max-[359px]:sr-only">{APP_NAME}</span>
    </>
  );
  const base = cx("flex min-w-0 items-center gap-2.5", className);
  return href ? (
    <Link href={href} className={base} aria-label={`${APP_NAME} home`}>
      {inner}
    </Link>
  ) : (
    <span className={base}>{inner}</span>
  );
}

/* ----------------------------------------------------------------- chips */
export type ChipTone = "ok" | "warn" | "err" | "info" | "neu" | "neui" | "lav" | "lime" | "ink" | "outline";
/** Solid fills so the label holds 4.5:1 on dark and on ivory. Always carries text, never colour alone. */
export function Chip({ tone = "neu", className = "", ...p }: ComponentProps<"span"> & { tone?: ChipTone }) {
  return <span {...p} className={cx("ac-chip", `ac-chip-${tone}`, className)} />;
}

/** The four content labels used everywhere: education, analysis, draft, reviewed. */
export function ContentChip({ kind }: { kind: "EDUCATION" | "ANALYSIS" | "DRAFT" | "REVIEWED" }) {
  const tone: Record<string, ChipTone> = { EDUCATION: "info", ANALYSIS: "neui", DRAFT: "warn", REVIEWED: "ok" };
  const text = { EDUCATION: "EDUCATION", ANALYSIS: "ANALYSIS", DRAFT: "AI DRAFT · NOT FINAL", REVIEWED: "REVIEWED (DEMO)" }[kind];
  return (
    <Chip tone={tone[kind]} role="status" aria-label={`Content type: ${text}`}>
      {text}
    </Chip>
  );
}

/* ------------------------------------------------------------ page parts */
/** "Home › My Plan › Case 0042". The last item is the current page. */
export function Crumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="ac-crumb">
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${it.label}-${i}`} className="flex items-center gap-1.5">
              {it.href && !last ? (
                <Link href={it.href} className="hover:text-fg hover:underline">
                  {it.label}
                </Link>
              ) : last ? (
                <b aria-current="page">{it.label}</b>
              ) : (
                <span>{it.label}</span>
              )}
              {!last && <span aria-hidden>›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Title, supporting line and the page's actions, wrapping instead of colliding on narrow screens. */
export function PageHead({ title, sub, actions, className = "", subTestId }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string; subTestId?: string }) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 max-w-full flex-1 basis-[22rem]">
        <h1 className="t-h1">{title}</h1>
        {sub && (
          <p className="mt-2 text-muted" data-testid={subTestId}>
            {sub}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Main column with a side rail. The rail moves under the main column below ~1120px (the tablet layout). `cols` sets the wide-screen split. */
export function MainSide({ main, side, className = "", sideFirstOnMobile, cols = "minmax(0,2fr) minmax(0,1fr)" }: { main: ReactNode; side: ReactNode; className?: string; sideFirstOnMobile?: boolean; cols?: string }) {
  return (
    <div className={cx("grid items-start gap-6 wd:[grid-template-columns:var(--ms-cols)]", className)} style={{ "--ms-cols": cols } as CSSProperties}>
      <div className={cx("flex min-w-0 flex-col gap-5", sideFirstOnMobile && "max-wd:order-2")}>{main}</div>
      <div className={cx("flex min-w-0 flex-col gap-5", sideFirstOnMobile && "max-wd:order-1")}>{side}</div>
    </div>
  );
}

export function Meter({ value, className = "", label, tone }: { value: number; className?: string; label?: string; tone?: "lime" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label} className={cx("ac-bar", className)} style={tone === "lime" ? { background: "#a8d400" } : undefined}>
      <i style={{ width: `${pct}%`, ...(tone === "lime" ? { background: "#171717" } : {}) }} />
    </div>
  );
}

/** A tonal surface with a heading row (title left, chip right), used all over the wireframes. */
export function Panel({
  tone = "ivory",
  title,
  chip,
  children,
  className = "",
  small,
  ...rest
}: { tone?: Tone; title?: ReactNode; chip?: ReactNode; children: ReactNode; className?: string; small?: boolean } & Omit<ComponentProps<"section">, "title">) {
  return (
    <section {...rest} className={cx(small ? "ac-card-s" : "ac-card", SURFACE[tone], className)}>
      {(title || chip) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          {title ? <h2 className="t-h4">{title}</h2> : <span />}
          {chip}
        </div>
      )}
      {children}
    </section>
  );
}

/** A figure with a label: "1.8 months", "₹1,05,000". */
export function Stat({ label, value, note, size = 38, className = "" }: { label?: ReactNode; value: ReactNode; note?: ReactNode; size?: number; className?: string }) {
  return (
    <div className={className}>
      {label && <div className="t-label">{label}</div>}
      <div className="num mt-1 break-words leading-[1.05]" style={{ fontSize: `clamp(${Math.round(size * 0.62)}px, 6vw, ${size}px)` }}>
        {value}
      </div>
      {note && <div className="mt-1 text-sm text-muted">{note}</div>}
    </div>
  );
}

/** A row of label and value, as in "Income · ₹35,000 · stable". */
export function KV({ k, v, className = "" }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4", className)}>
      <span className="text-muted">{k}</span>
      <b className="text-right">{v}</b>
    </div>
  );
}

/** "Draft" and "Approved" banners: always right under the header, different in edge, chip and wording, not only colour. */
export function StatusBanner({ kind, chip, children, meta }: { kind: "draft" | "approved"; chip: ReactNode; children: ReactNode; meta?: ReactNode }) {
  const draft = kind === "draft";
  return (
    <div role="note" data-testid={draft ? "draft-banner" : "approved-banner"} className={draft ? "border-b-2 border-dashed border-[#E0A800] bg-[#2A2418]" : "border-b-2 border-[#2F8F5B] bg-[#16301F]"}>
      <div className="ac-wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {chip}
          <span className={cx("min-w-0 text-sm", draft ? "text-[#F3E2B3]" : "text-[#CDEBD8]")}>{children}</span>
        </div>
        {meta && <span className={cx("text-xs", draft ? "text-[#F3E2B3]" : "text-[#CDEBD8]")}>{meta}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- timelines etc. */
export interface TimelineItem {
  key: string;
  title: ReactNode;
  meta?: ReactNode;
  state?: "done" | "now" | "todo";
}
export function Timeline({ items, className = "" }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cx("ac-tl text-sm", className)}>
      {items.map((it, i) => (
        <li key={it.key} className={cx("ac-ev", it.state === "done" && "ac-ev-done", it.state === "now" && "ac-ev-now")} style={i === items.length - 1 ? { paddingBottom: 0 } : undefined} aria-current={it.state === "now" ? "step" : undefined}>
          <b className={it.state === "todo" ? "text-muted" : ""}>{it.title}</b>
          {it.meta && <div className="text-muted">{it.meta}</div>}
        </li>
      ))}
    </ol>
  );
}

/** A task is done when a person is shown a check mark and the words, never colour alone. */
export function Check({ on, className = "" }: { on?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cx("ac-ck", on && "ac-ck-on", className)}>
      {on ? "✓" : ""}
    </span>
  );
}

/* ----------------------------------------------------------------- states */
const STATE = {
  unavailable: { edge: "border-[#9CC2F5]", chip: "info" as ChipTone },
  error: { edge: "border-[#F0A3A3]", chip: "err" as ChipTone },
  permission: { edge: "border-[#A9A1E8]", chip: "lav" as ChipTone },
};
/** The three inline problem states from the Error page: data unavailable (blue), could not load (red), no permission (lavender). */
export function StateCard({
  kind,
  label,
  title,
  body,
  detail,
  actions,
  className = "",
}: {
  kind: keyof typeof STATE;
  label: string;
  title: string;
  body: string;
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const s = STATE[kind];
  return (
    <section role={kind === "error" ? "alert" : "status"} className={cx("ac-card s-ivory border-2", s.edge, className)}>
      <Chip tone={s.chip}>{label}</Chip>
      <h2 className="t-h3 mt-3">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {detail && <div className="ac-inner mt-3 text-sm">{detail}</div>}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ toast */
interface ToastItem {
  id: number;
  text: string;
  action?: { label: string; onClick: () => void };
}
const ToastCtx = createContext<{ show: (text: string, action?: ToastItem["action"]) => void } | null>(null);

/** Quiet confirmations ("Saved. You can continue later."): five seconds, dismissible, optional Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useApp();
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (text: string, action?: ToastItem["action"]) => {
      const id = next.current++;
      setItems((l) => [...l.slice(-2), { id, text, action }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-start md:px-10">
        {items.map((x) => (
          <div key={x.id} role="status" className="toast-anim s-dark pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-[#444] bg-[#2e2e2e] py-2.5 pl-4 pr-2 text-sm shadow-[var(--shadow)]">
            <Chip tone="ok">✓</Chip>
            <span className="min-w-0 flex-1">{x.text}</span>
            {x.action && (
              <button
                type="button"
                className="min-h-10 rounded-full px-3 font-bold text-lime underline underline-offset-2"
                onClick={() => {
                  x.action!.onClick();
                  dismiss(x.id);
                }}
              >
                {x.action.label}
              </button>
            )}
            <button type="button" aria-label={t("common.close")} onClick={() => dismiss(x.id)} className="grid size-10 place-items-center rounded-full text-muted hover:text-fg">
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const c = useContext(ToastCtx);
  return c ?? { show: () => undefined };
}

/* -------------------------------------------------------------- re-exports */
export { Btn, LinkBtn };

/** A "dead end" guard: every page that finishes a task offers a next step and a way back to a hub. */
export function NextSteps({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-wrap gap-3", className)}>{children}</div>;
}

/** Page-level effect: set the document title so each route is named in the tab and in history. */
export function useDocTitle(title: string) {
  useEffect(() => {
    if (title) document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
