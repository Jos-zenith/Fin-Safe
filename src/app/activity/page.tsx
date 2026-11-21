"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageLoading } from "@/components/CaseGate";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";

/** The old "Activity" address: the audit timeline now lives on the case. Existing links keep working. */
export default function ActivityRedirect() {
  const { state } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const c = wf.myCase;
  useEffect(() => {
    if (!state || !wf.loaded) return;
    if (!state.profile) return router.replace("/");
    if (!wf.me) return;
    router.replace(c ? `/case/${encodeURIComponent(c.id)}/audit` : "/dashboard");
  }, [state, wf.loaded, wf.me, c, router]);
  return <PageLoading />;
}
