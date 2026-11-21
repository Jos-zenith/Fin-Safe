"use client";
import { BookOpen, ClipboardList, House, ScanSearch, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { headerVariant, customerActive, hasOwnBanner, planHref, showsRichFooter } from "@/lib/nav";
import { applyPrefs, getPrefs } from "@/lib/prefs";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import { Logo, ToastProvider } from "./ds";
import { Header } from "./Header";
import { Sheet } from "./Sheet";
import { Btn, Skeleton } from "./ui";

/** Mobile bottom bar: five circular icons, the current one filled in lime (wireframes: Components > Navigation). */
function BottomNav() {
  const { t } = useApp();
  const wf = useWorkflow();
  const path = usePathname();
  const active = customerActive(path);
  const items = [
    { id: "home", href: "/dashboard", icon: House, label: t("nav2.home") },
    { id: "plan", href: planHref(wf.myCase), icon: ClipboardList, label: t("nav2.plan") },
    { id: "second", href: "/second-opinion", icon: ScanSearch, label: t("nav2.second") },
    { id: "learn", href: "/learn", icon: BookOpen, label: t("nav2.learn") },
    { id: "settings", href: "/settings", icon: Settings, label: t("nav2.settings") },
  ] as const;
  return (
    <nav aria-label={t("nav2.main")} className="fixed inset-x-0 bottom-0 z-30 border-t border-[#2e2e2e] bg-char pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-between px-4 pb-3.5 pt-2.5">
        {items.map(({ id, href, icon: Icon, label }) => {
          const on = active === id;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                aria-label={label}
                className={`grid size-12 place-items-center rounded-full border-[1.5px] transition-colors ${on ? "border-lime bg-lime text-char" : "border-[#3a3a3a] text-muted hover:text-fg"}`}
              >
                <Icon size={21} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The strip under the header on a wide screen: what this page is, in one honest line. Adviser pages use the amber one. */
function DemoStrip({ path, adviser }: { path: string; adviser: boolean }) {
  const { t } = useApp();
  if (adviser) {
    const [first, ...rest] = t("legal.demoWorkflow").split(". ");
    return (
      <p className="ac-strip ac-strip-amber" data-testid="demo-strip">
        <b>{first}.</b> {rest.join(". ")}
      </p>
    );
  }
  const key = path.startsWith("/intake")
    ? "strip.intake"
    : path.startsWith("/dashboard")
      ? "strip.dashboard"
      : path.startsWith("/case") || path.startsWith("/advice")
        ? "strip.case"
        : path.startsWith("/actions")
          ? "strip.actions"
          : "strip.demo";
  return (
    <p className="ac-strip" data-testid="demo-strip">
      {t(key)}
    </p>
  );
}

/**
 * What a page shows until the saved state has loaded. Screen readers get a status message (an empty busy region says
 * nothing); the grey boxes are decoration. If loading stalls, the person gets a way out instead of waiting forever.
 */
function Loading() {
  const { t } = useApp();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div role="status" className="ac-wrap max-w-3xl space-y-4 pt-8">
      <p className="sr-only">{t("app.loading")}</p>
      <div aria-hidden className="space-y-4">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      {slow && (
        <div className="s-dark rounded-3xl border border-[#444] bg-[#242424] p-5 text-center">
          <p className="font-semibold">{t("app.slow")}</p>
          <Btn className="mt-3" onClick={() => window.location.reload()}>
            {t("app.reload")}
          </Btn>
        </div>
      )}
    </div>
  );
}

function Footer({ rich, authNote, extraBottom }: { rich: boolean; authNote: boolean; extraBottom: boolean }) {
  const { t } = useApp();
  const wf = useWorkflow();
  const col = "flex flex-col gap-2";
  const head = "font-bold text-white-ac";
  const link = "hover:text-fg hover:underline";
  return (
    <footer className={`mt-14 border-t border-[#2e2e2e] text-[13px] text-muted ${extraBottom ? "max-md:pb-28" : ""}`}>
      <div className="ac-wrap py-8">
        {rich ? (
          <div className="flex flex-wrap justify-between gap-x-10 gap-y-8">
            <div className="flex max-w-sm flex-col gap-3">
              <Logo size={28} />
              <span>{t("footer.demo")}</span>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-6">
              <div className={col}>
                <b className={head}>{t("footer.learn")}</b>
                <Link href="/learn" className={link}>{t("footer.edu")}</Link>
                <Link href="/second-opinion" className={link}>{t("nav2.second")}</Link>
              </div>
              <div className={col}>
                <b className={head}>{t("footer.trust")}</b>
                <Link href="/transparency" className={link}>{t("nav2.earn")}</Link>
                <Link href="/compliance" className={link}>{t("footer.compliance")}</Link>
                <Link href="/sources" className={link}>{t("footer.sources")}</Link>
              </div>
              <div className={col}>
                <b className={head}>{t("footer.help")}</b>
                <Link href="/help" className={link}>{t("footer.faq")}</Link>
                <Link href="/about" className={link}>{t("nav2.about")}</Link>
              </div>
            </div>
          </div>
        ) : (
          <p>{t("footer.demo")}</p>
        )}
        {/* "Demo authentication. Not secure authentication." belongs where someone signs in or looks at account data, not on every page. */}
        <div className="mt-6 space-y-0.5 text-xs">
          {authNote && <p data-testid="demo-auth">{t("auth.demoOnly")}</p>}
          {wf.me && (
            <p>
              {t("auth.signedInAs", { name: wf.me.displayName })}{" "}
              <button type="button" onClick={() => void wf.signOut()} className="font-semibold text-lime underline underline-offset-2">
                {t("auth.signOut")}
              </button>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { ready, state, t, update, idleCleared, dismissIdle } = useApp();
  const wf = useWorkflow();
  const path = usePathname();
  const variant = headerVariant(path, wf.role, !!state?.profile);
  const showNav = ready && variant === "customer";
  // The landing page needs no saved state to say what the product is, so it is in the first HTML (search engines, link
  // previews and slow phones get words, not boxes); only its "continue as" shortcuts wait for the state.
  const landing = path === "/";
  const authNote = path === "/" || path === "/adviser" || path === "/settings";

  // the demo notice is acknowledged on the SERVER too, once there is a session to attach it to
  const consentOwner = wf.me && !wf.me.consentAt ? wf.me.id : null;
  const noticeSeen = !!state?.noticeSeen;
  useEffect(() => {
    if (consentOwner && noticeSeen) void wf.consent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentOwner, noticeSeen]);
  // apply the saved accessibility preferences (text size, contrast, motion) as soon as the page is running
  useEffect(() => {
    applyPrefs(getPrefs());
  }, []);

  return (
    <ToastProvider>
      <a href="#main" className="sr-only z-[60] rounded-full bg-lime px-4 py-2 font-bold text-char focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        {t("skip.main")}
      </a>
      <div className="flex min-h-dvh flex-col">
        {/* a phone keeps the demo notice as a strip above the header (the wireframes' mobile rule) */}
        <p className={`ac-strip text-xs md:hidden ${variant === "adviser" ? "ac-strip-amber" : ""}`} data-testid="demo-strip-mobile">
          {variant === "adviser" ? t("legal.demoWorkflow") : t("strip.mobile")}
        </p>
        <Header />
        {!hasOwnBanner(path) && !landing && variant !== "public" && (
          <div className="max-md:hidden">
            <DemoStrip path={path} adviser={variant === "adviser"} />
          </div>
        )}
        {wf.offline && (
          <p role="alert" className="bg-[#2A2418] px-4 py-2 text-center text-sm font-semibold text-[#F3E2B3]">
            {t("offline.banner")}
          </p>
        )}
        <main id="main" className="flex-1">
          {ready || landing ? children : <Loading />}
        </main>
        <Footer rich={showsRichFooter(path, variant)} authNote={authNote} extraBottom={showNav} />
        {showNav && <BottomNav />}

        <Sheet open={ready && !state?.noticeSeen} onClose={() => update((s) => ({ ...s, noticeSeen: true, touched: true }))} title={t("notice.title")}>
          <p className="text-muted">{t("notice.body")}</p>
          <Btn block className="mt-5" onClick={() => update((s) => ({ ...s, noticeSeen: true, touched: true }))}>
            {t("common.ok")}
          </Btn>
        </Sheet>
        <Sheet open={idleCleared} onClose={dismissIdle} title={t("idle.title")}>
          <p className="text-muted">{t("idle.body")}</p>
          <Btn block className="mt-5" onClick={dismissIdle}>
            {t("common.ok")}
          </Btn>
        </Sheet>
      </div>
    </ToastProvider>
  );
}
