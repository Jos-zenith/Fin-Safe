"use client";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case } from "@/types";
import { Crumb, StateCard } from "./ds";
import { Btn, LinkBtn, Skeleton } from "./ui";

/** A page-sized placeholder with a readable status message (the grey boxes are decoration). */
export function PageLoading() {
  const { t } = useApp();
  return (
    <div role="status" className="ac-wrap space-y-4 pt-8">
      <p className="sr-only">{t("app.loading")}</p>
      <div aria-hidden className="space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

/** Switch between the two demo accounts (no password). The same rules as the header's role menu. */
export function useSwitchRole() {
  const { state, lang } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  return async (r: "user" | "adviser") => {
    if (r === "adviser") {
      if (await wf.signIn("adviser", lang)) router.push("/adviser");
      return;
    }
    if (state?.personaId && state.profile) {
      await wf.signIn(state.personaId, lang);
      router.push("/dashboard");
    } else {
      await wf.signOut();
      router.push("/");
    }
  };
}

/**
 * Guards a customer's case page. The address carries a case id, but a customer can only ever open their own case, and an
 * adviser account has its own pages. Every other situation gets a plain explanation and a way back (never a blank page).
 */
export function CaseGate({ caseId, crumb, children }: { caseId: string; crumb?: string; children: (c: Case) => ReactNode }) {
  const { state, t } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const switchRole = useSwitchRole();
  const needsHome = !!state && !state.profile && wf.loaded && !wf.me;
  useEffect(() => {
    if (needsHome) router.replace("/");
  }, [needsHome, router]);

  if (!state || !wf.loaded || needsHome) return <PageLoading />;
  // a saved profile with no session yet: the provider is signing in again
  if (!wf.me) return <PageLoading />;

  const here = [{ label: t("case.crumb"), href: "/dashboard" }, ...(crumb ? [{ label: crumb }] : [])];
  if (wf.role === "adviser") {
    return (
      <div className="ac-wrap pb-12">
        <Crumb items={here} />
        <StateCard
          kind="permission"
          label={t("err.perm.label")}
          title={t("err.perm.customerTitle")}
          body={t("err.perm.customerBody")}
          detail={t("err.perm.detail", { role: t("role.adviser"), needed: t("role.customer") })}
          actions={
            <>
              <Btn onClick={() => void switchRole("user")}>{t("err.perm.switch")}</Btn>
              <LinkBtn href="/adviser" variant="secondary">{t("nav2.cases")}</LinkBtn>
            </>
          }
          className="max-w-xl"
        />
      </div>
    );
  }
  const c = wf.myCase;
  if (!c) {
    return (
      <div className="ac-wrap pb-12">
        <Crumb items={here} />
        <StateCard
          kind="unavailable"
          label={t("err.unavail.label")}
          title={t("err.nocase.title")}
          body={t("err.nocase.body")}
          actions={<LinkBtn href="/dashboard">{t("err.nocase.cta")}</LinkBtn>}
          className="max-w-xl"
        />
      </div>
    );
  }
  if (c.id !== caseId) {
    return (
      <div className="ac-wrap pb-12">
        <Crumb items={here} />
        <StateCard
          kind="permission"
          label={t("err.perm.label")}
          title={t("err.perm.title")}
          body={t("err.perm.body", { name: wf.me.displayName })}
          detail={t("err.perm.detail", { role: t("role.customer"), needed: t("role.adviser") })}
          actions={
            <>
              <LinkBtn href={`/case/${encodeURIComponent(c.id)}`}>{t("err.perm.back")}</LinkBtn>
              <Btn variant="secondary" onClick={() => void switchRole("adviser")}>{t("err.perm.switch")}</Btn>
            </>
          }
          className="max-w-xl"
        />
      </div>
    );
  }
  return <>{children(c)}</>;
}
