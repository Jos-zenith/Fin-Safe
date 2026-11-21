"use client";
import { useEffect } from "react";
import { Crumb, StateCard } from "@/components/ds";
import { Btn, LinkBtn } from "@/components/ui";
import { useApp } from "@/store/AppProvider";

/**
 * Shown when a page fails to render. Friendly, specific and recovery-oriented: it never blames the person, never shows
 * a stack trace and says the answers are saved. The reference lets someone quote it when they report the problem.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useApp();
  useEffect(() => {
    // the browser console keeps the detail; the page does not show it
    console.error(error);
  }, [error]);
  const ref = `ERR-${(error.digest ?? "UNKNOWN").slice(0, 8).toUpperCase()}`;
  return (
    <div className="ac-wrap pb-12">
      <Crumb items={[{ label: t("nav2.home"), href: "/" }, { label: t("err.load.label") }]} />
      <StateCard
        kind="error"
        label={t("err.load.label")}
        title={t("err.load.title")}
        body={t("err.load.body")}
        detail={t("err.load.ref", { ref })}
        actions={
          <>
            <Btn onClick={reset}>{t("err.load.retry")}</Btn>
            <LinkBtn href="/dashboard" variant="secondary">{t("err.load.dash")}</LinkBtn>
            <LinkBtn href="/help" variant="ghost">{t("err.load.support")}</LinkBtn>
          </>
        }
        className="mt-3 max-w-xl"
      />
    </div>
  );
}
