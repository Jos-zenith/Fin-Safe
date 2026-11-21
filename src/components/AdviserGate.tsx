"use client";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case } from "@/types";
import { PageLoading } from "./CaseGate";
import { Crumb, StateCard } from "./ds";
import { Btn, Card, LinkBtn } from "./ui";

/**
 * Adviser pages need the demo adviser session. Not signed in as the adviser: say so, and offer the demo sign-in
 * (no password; demo authentication only).
 */
export function AdviserGate({ children }: { children: ReactNode }) {
  const { state, t, lang } = useApp();
  const wf = useWorkflow();
  if (!state || !wf.loaded) return <PageLoading />;
  if (wf.role !== "adviser") {
    return (
      <div className="ac-wrap max-w-md pb-12 pt-8">
        <Card className="text-center">
          <span className="ac-ic mx-auto !size-14" aria-hidden>
            <Lock size={26} />
          </span>
          <h1 className="t-h2 mt-3">{t("adv.gateTitle")}</h1>
          <p className="mt-2 text-sm text-muted">{t("adv.gateBody")}</p>
          <Btn block className="mt-4" onClick={() => void wf.signIn("adviser", lang)}>
            {t("adv.gateCta")}
          </Btn>
          <p className="mt-3 text-xs text-muted">{t("auth.demoOnly")}</p>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}

/** A case from the adviser's queue, by the id in the address. A case that is not in the queue gets a plain explanation. */
export function AdviserCaseGate({ children, crumb }: { children: (c: Case) => ReactNode; crumb?: string }) {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useApp();
  const wf = useWorkflow();
  return (
    <AdviserGate>
      {(() => {
        const id = decodeURIComponent(caseId);
        const c = wf.queue.find((x) => x.id === id);
        if (c) return children(c);
        return (
          <div className="ac-wrap pb-12">
            <Crumb items={[{ label: t("nav2.cases"), href: "/adviser" }, ...(crumb ? [{ label: crumb }] : [])]} />
            <StateCard
              kind="unavailable"
              label={t("err.unavail.label")}
              title={t("ad.notfound.title")}
              body={t("ad.notfound.body")}
              actions={<LinkBtn href="/adviser">{t("nav2.cases")}</LinkBtn>}
              className="max-w-xl"
            />
          </div>
        );
      })()}
    </AdviserGate>
  );
}
