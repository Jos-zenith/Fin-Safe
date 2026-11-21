// Browser side of the workflow API. Every call is same-origin, sends the session cookie, and carries the header
// that the server requires on state-changing requests (a defence against cross-site request forgery).
import type { AuditRec, ChainVerification } from "@/server/store/types";
import type { Case, Lang, UserProfile } from "@/types";

export type { AuditRec, ChainVerification };

export interface MeUser {
  id: string;
  role: "customer" | "adviser";
  persona: string;
  displayName: string;
  language: Lang;
  consentAt: string | null;
}

export interface NotificationView {
  id: string;
  kind: string;
  caseId: string | null;
  params: Record<string, string | number>;
  createdAt: string;
  readAt: string | null;
}

/** What GET /api/v1/sync returns on every poll. */
export interface SyncView {
  user: MeUser;
  pollMs: number;
  serverTime: string;
  unread: number;
  profile: UserProfile | null;
  case: Case | null;
  queue: Case[] | null;
  notifications: NotificationView[];
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  /** The server's error code ("already_claimed", "checklist_incomplete", ...) when !ok. */
  error?: string;
  data: T | null;
}

export async function api<T = unknown>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(`/api/v1/${path}`, {
    method,
    credentials: "same-origin",
    headers: { "content-type": "application/json", "x-requested-with": "fetch" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  const error = !res.ok && data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : undefined;
  return { ok: res.ok, status: res.status, error, data: res.ok ? (data as T) : null };
}

export type Persona = "priya" | "ramesh" | "anita" | "fresh" | "adviser";
