"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageLoading } from "@/components/CaseGate";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";

/**
 * The old "My Plan" address. A plan now lives on its case: the reviewed plan once approved, the draft before that, and
 * the dashboard (where a review is requested) when there is no case yet. Existing links and bookmarks keep working.
 */
export default function PlanRedirect() {
  const { state } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const c = wf.myCase;
  useEffect(() => {
    if (!state || !wf.loaded) return;
    if (!state.profile) return router.replace("/");
    if (!wf.me) return; // signing in again
    router.replace(c ? (c.status === "APPROVED" ? `/case/${encodeURIComponent(c.id)}/approved` : `/advice/${encodeURIComponent(c.id)}`) : "/dashboard");
  }, [state, wf.loaded, wf.me, c, router]);
  return <PageLoading />;
}
