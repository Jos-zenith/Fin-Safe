// Pure view helpers over a case the server returned. Every state transition (claim, decide, approve, return, reply)
// happens on the server (src/server/workflow.ts); nothing here can change a case.
import { CHECKLIST_IDS } from "@/config/workflow";
import type { PlanItem } from "@/lib/ai/schemas";
import type { Case, CaseStatus, Decision } from "@/types";

export { CHECKLIST_IDS };

export const checklistComplete = (c: Pick<Case, "checklist">) => CHECKLIST_IDS.every((id) => c.checklist[id]);

export interface ReviewedItem {
  item: PlanItem;
  decision: Decision;
  rationale: string;
  edited: boolean;
  comment?: string;
}

export function reviewedItems(c: Pick<Case, "plan" | "reviews">): ReviewedItem[] {
  return c.plan.items.map((item) => {
    const r = c.reviews[item.id];
    return {
      item,
      decision: r?.decision ?? "pending",
      rationale: r?.edit?.rationale ?? item.rationale,
      edited: !!r?.edit,
      comment: r?.comment,
    };
  });
}

/**
 * "Changed 2 of 7 items, removed 1": how much the adviser touched, in counts a person can read at a glance.
 * An item the adviser edited is "changed"; an item they rejected is "removed". Accepted items are unchanged.
 */
export function changeSummary(c: Pick<Case, "plan" | "reviews">): { total: number; changed: number; removed: number } {
  const rows = reviewedItems(c);
  return { total: rows.length, changed: rows.filter((r) => r.decision === "edited").length, removed: rows.filter((r) => r.decision === "rejected").length };
}

export function statusForUser(status: CaseStatus): number {
  return { INTAKE_DONE: 0, DRAFT_READY: 1, IN_REVIEW: 2, CHANGES_REQUESTED: 3, APPROVED: 4 }[status];
}

// ---------- Word diff for the draft-vs-reviewed view ----------
export interface DiffPart {
  t: "same" | "del" | "add";
  s: string;
}
export function wordDiff(a: string, b: string): DiffPart[] {
  const x = a.split(/\s+/).filter(Boolean);
  const y = b.split(/\s+/).filter(Boolean);
  const m = x.length;
  const n = y.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (t: DiffPart["t"], s: string) => {
    const last = out[out.length - 1];
    if (last && last.t === t) last.s += ` ${s}`;
    else out.push({ t, s });
  };
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (x[i] === y[j]) {
      push("same", x[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", x[i++]);
    else push("add", y[j++]);
  }
  while (i < m) push("del", x[i++]);
  while (j < n) push("add", y[j++]);
  return out;
}
