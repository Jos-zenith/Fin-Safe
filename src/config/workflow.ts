// Workflow settings that are not financial assumptions.

/** Adviser SLA: a waiting case is "overdue" this many minutes after it was created. Configurable. */
export const SLA_MINUTES = 120;

/** Demo data older than this is purged on server start and hourly. */
export const RETENTION_HOURS = 24;

/** In-app notification polling, in milliseconds (the server may override with POLL_MS). */
export const POLL_MS_DEFAULT = 5000;

/** Queue ordering weights: not financial constants. Higher total = more urgent. */
export const PRIORITY_WEIGHT = { high: 30, medium: 15, low: 5, urgent: 1000 } as const;

/** What an adviser must tick before a plan can be approved (the demo workflow's checklist). */
export const CHECKLIST_IDS = ["suitability", "risk", "conflicts", "fee", "language", "assumptions", "demo_ack"] as const;
export type ChecklistId = (typeof CHECKLIST_IDS)[number];

/** The version of the demo agreement text a customer consents to. Bump it when the wording changes. */
export const CONSENT_VERSION = "demo-1";
/** What the customer is shown before consenting. Each id has a text in the i18n files; the consent record lists them. */
export const CONSENT_SHOWN = ["fee", "conflicts", "demo", "no_esign", "data"] as const;

/**
 * "Possible rubber-stamping" heuristic (a DEMO heuristic, not a finding about anyone): an adviser who approves more than
 * this share of the cases they decide, with a median review time under this many milliseconds, over at least this many
 * decisions, is flagged for a human to look at. It can be wrong in both directions, and the Metrics page says so.
 */
export const RUBBER_STAMP_APPROVAL_RATE = 0.95;
export const RUBBER_STAMP_MEDIAN_MS = 120_000;
export const RUBBER_STAMP_MIN_DECISIONS = 5;
/** The longest time one plan item is credited with being open (a tab left open overnight is not review time). */
export const MAX_DWELL_MS = 30 * 60_000;

/** A demo customer or adviser session, and unclaimed demo data, are removed after this long without activity. */
export const SESSION_IDLE_PURGE_HOURS = 24;
