"use client";
import { useEffect, useState } from "react";
import type { AuditRec, ChainVerification } from "@/lib/workflow/client";
import { useWorkflow } from "@/store/WorkflowProvider";
import type { Case } from "@/types";

export interface Trail {
  audit: AuditRec[];
  chain: ChainVerification;
}

/** The server's audit trail for a case and its hash-chain check; fetched again whenever the case moves on (its version changes). */
export function useTrail(c: Pick<Case, "id" | "version"> | null | undefined): Trail | null {
  const wf = useWorkflow();
  const [trail, setTrail] = useState<{ id: string; v: number; data: Trail } | null>(null);
  const id = c?.id;
  const version = c?.version ?? 0;
  useEffect(() => {
    if (!id) return;
    let live = true;
    wf.caseDetail(id).then((r) => {
      if (live && r.data) setTrail({ id, v: version, data: { audit: r.data.audit, chain: r.data.chain } });
    });
    return () => {
      live = false;
    };
    // the workflow object changes on every poll; the case id and version are what should trigger a refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version]);
  return trail && trail.id === id ? trail.data : null;
}

/** Audit rows that mark a step of the case, newest of each kind. */
export function firstOf(audit: AuditRec[] | undefined, action: string): AuditRec | undefined {
  return audit?.find((a) => a.action === action);
}
export function lastOf(audit: AuditRec[] | undefined, action: string): AuditRec | undefined {
  return [...(audit ?? [])].reverse().find((a) => a.action === action);
}
