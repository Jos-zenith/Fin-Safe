// Adviser metrics, computed from the metric events the workflow records. Events say WHAT happened and WHEN, never
// WHO or WHAT WAS SAID, so nothing here can reveal profile content.
//
// These numbers describe THIS DEMO'S traffic (a few people clicking through it). They are not evidence of anything,
// and the page that shows them says so.
import { RUBBER_STAMP_APPROVAL_RATE, RUBBER_STAMP_MEDIAN_MS, RUBBER_STAMP_MIN_DECISIONS } from "@/config/workflow";
import type { MetricRec } from "./store/types";

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const share = (part: number, whole: number): number | null => (whole === 0 ? null : part / whole);

export interface MetricsSummary {
  /** Every figure carries the number of events behind it (n), so a tiny sample is visible as tiny. */
  banner: "Demo data. Not evidence.";
  generatedAt: string;
  review: { n: number; medianMinutes: number | null };
  firstReviewedPlan: { n: number; medianMinutes: number | null };
  waitBeforeReview: { n: number; medianMinutes: number | null };
  draftsNeedingCorrection: { n: number; share: number | null };
  editRateByTopic: { topic: string; decisions: number; edited: number; rate: number | null }[];
  validationRejection: { task: string; liveRequests: number; rejected: number; rate: number | null }[];
  source: { n: number; live: number; template: number; fallback: number; liveShare: number | null };
  overdueCases: number;
  casesSubmitted: number;
  casesApproved: number;
  /** How long each kind of AI output took to produce (median and slowest, in milliseconds), and how many were retried. */
  generation: { task: string; n: number; medianMs: number | null; maxMs: number | null }[];
  generationRetries: number;
  generationFailures: number;
  /** Time each plan item was open before the adviser acted on it (n items, median seconds). */
  itemDwell: { n: number; medianSeconds: number | null };
  /** Customers who accepted a reviewed plan, and errors they reported. */
  acceptance: { approved: number; accepted: number; errorsReported: number };
  /**
   * A DEMO heuristic, not a finding about anyone: an adviser who approves almost everything they decide, quickly.
   * `rule` is stated so the number can be argued with. It can be wrong in both directions.
   */
  rubberStamp: {
    flagged: boolean;
    rule: { approvalRate: number; medianMinutes: number; minDecisions: number };
    advisers: { label: string; decisions: number; approvalRate: number | null; medianMinutes: number | null; flagged: boolean }[];
  };
}

const min = (ms: number | null) => (ms === null ? null : Math.round((ms / 60_000) * 10) / 10);

export function summariseMetrics(events: MetricRec[], overdueCases: number, now: string): MetricsSummary {
  const of = (k: string) => events.filter((e) => e.kind === k);
  const approved = of("plan_approved");
  const decisions = of("item_decision");
  const ai = of("ai_task");

  const topics = [...new Set(decisions.map((d) => String(d.props.topic ?? "other")))].sort();
  const editRateByTopic = topics.map((topic) => {
    const d = decisions.filter((x) => String(x.props.topic ?? "other") === topic);
    const edited = d.filter((x) => x.props.decision === "edited").length;
    return { topic, decisions: d.length, edited, rate: share(edited, d.length) };
  });

  const tasks = [...new Set(ai.map((e) => e.task ?? "unknown"))].sort();
  const validationRejection = tasks.map((task) => {
    // only a request that really reached a model can be "rejected": mock answers are never validated against a model
    const live = ai.filter((e) => (e.task ?? "unknown") === task && (e.props.source === "provider" || e.props.source === "fixture"));
    const rejected = live.filter((e) => e.props.rejected === true).length;
    return { task, liveRequests: live.length, rejected, rate: share(rejected, live.length) };
  });

  const live = ai.filter((e) => e.props.source === "provider").length;
  const fallback = ai.filter((e) => e.props.source === "fixture").length;
  const template = ai.filter((e) => e.props.source === "mock").length;

  // one row per adviser (an opaque label, never a name): approvals as a share of approvals + returned-for-information
  const decided = [...approved.map((e) => ({ e, ok: true })), ...of("changes_requested").map((e) => ({ e, ok: false }))];
  const ids = [...new Set(decided.map((d) => String(d.e.props.adviserId ?? "unknown")))].sort();
  const advisers = ids.map((id, i) => {
    const mine = decided.filter((d) => String(d.e.props.adviserId ?? "unknown") === id);
    const ok = mine.filter((d) => d.ok);
    const rate = share(ok.length, mine.length);
    const med = median(ok.map((d) => d.e.valueMs ?? 0));
    const flagged = mine.length >= RUBBER_STAMP_MIN_DECISIONS && rate !== null && rate > RUBBER_STAMP_APPROVAL_RATE && med !== null && med < RUBBER_STAMP_MEDIAN_MS;
    return { label: `Adviser ${i + 1}`, decisions: mine.length, approvalRate: rate, medianMinutes: min(med), flagged };
  });
  const dwellMs = decisions.map((d) => d.valueMs).filter((x): x is number => typeof x === "number");
  const generation = tasks.map((task) => {
    const ms = ai.filter((e) => (e.task ?? "unknown") === task).map((e) => e.valueMs).filter((x): x is number => typeof x === "number");
    return { task, n: ms.length, medianMs: ms.length ? Math.round(median(ms) ?? 0) : null, maxMs: ms.length ? Math.max(...ms) : null };
  });

  return {
    banner: "Demo data. Not evidence.",
    generatedAt: now,
    review: { n: approved.length, medianMinutes: min(median(approved.map((e) => e.valueMs ?? 0))) },
    firstReviewedPlan: { n: approved.length, medianMinutes: min(median(approved.map((e) => Number(e.props.sinceRequestMs ?? 0)))) },
    waitBeforeReview: { n: of("review_started").length, medianMinutes: min(median(of("review_started").map((e) => e.valueMs ?? 0))) },
    draftsNeedingCorrection: { n: approved.length, share: share(approved.filter((e) => e.props.corrected === true).length, approved.length) },
    editRateByTopic,
    validationRejection,
    source: { n: ai.length, live, template, fallback, liveShare: share(live, ai.length) },
    overdueCases,
    casesSubmitted: of("case_submitted").length,
    casesApproved: approved.length,
    generation,
    generationRetries: of("generation_retried").length,
    generationFailures: of("generation_failed").length,
    itemDwell: { n: dwellMs.length, medianSeconds: dwellMs.length ? Math.round((median(dwellMs) ?? 0) / 1000) : null },
    acceptance: { approved: approved.length, accepted: of("plan_accepted").length, errorsReported: of("error_reported").length },
    rubberStamp: {
      flagged: advisers.some((a) => a.flagged),
      rule: { approvalRate: RUBBER_STAMP_APPROVAL_RATE, medianMinutes: RUBBER_STAMP_MEDIAN_MS / 60_000, minDecisions: RUBBER_STAMP_MIN_DECISIONS },
      advisers,
    },
  };
}
