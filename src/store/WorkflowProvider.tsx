"use client";
// The client's view of the SERVER workflow: who is signed in, their case (or the adviser's queue) and their
// notifications. It polls every few seconds, so an approval or a question shows up without a reload.
// Every action goes to the server, which decides whether it is allowed; this file only asks.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, type ApiResult, type AuditRec, type ChainVerification, type NotificationView, type Persona, type SyncView } from "@/lib/workflow/client";
import { useApp } from "@/store/AppProvider";
import type { Case, CopilotOut, Decision, Lang, UserProfile } from "@/types";

type CaseResult = ApiResult<{ case: Case; blocked?: boolean }>;

interface Wf {
  /** The first sync has finished (successfully or not). */
  loaded: boolean;
  /** The server could not be reached on the last poll. */
  offline: boolean;
  me: SyncView["user"] | null;
  role: "customer" | "adviser" | null;
  myCase: Case | null;
  queue: Case[];
  notifications: NotificationView[];
  unread: number;
  pollMs: number;
  signIn: (p: Persona, language?: Lang) => Promise<boolean>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  submit: (language: Lang, agreement?: AgreementInput) => Promise<CaseResult>;
  escalate: (language: Lang, agreement?: AgreementInput) => Promise<CaseResult>;
  /** The customer accepts the reviewed plan. */
  acceptPlan: (caseId: string) => Promise<CaseResult>;
  /** Try preparing the plan again (after a failure, or when it fell back to pre-written text). */
  retryGeneration: (caseId: string) => Promise<CaseResult>;
  /** The customer reports an error in the plan; it goes back to an adviser, flagged. */
  reportError: (caseId: string, note: string) => Promise<CaseResult>;
  reply: (caseId: string, text: string) => Promise<CaseResult>;
  claim: (caseId: string) => Promise<CaseResult>;
  release: (caseId: string) => Promise<CaseResult>;
  decide: (caseId: string, itemId: string, decision: Decision, comment?: string, dwellMs?: number) => Promise<CaseResult>;
  edit: (caseId: string, itemId: string, text: string, lang: Lang, dwellMs?: number) => Promise<CaseResult>;
  setChecklist: (caseId: string, id: string, value: boolean) => Promise<CaseResult>;
  approve: (caseId: string) => Promise<CaseResult>;
  returnForInfo: (caseId: string, question: string) => Promise<CaseResult>;
  copilot: (caseId: string, language: Lang) => Promise<CaseResult>;
  caseDetail: (caseId: string) => Promise<ApiResult<{ case: Case; audit: AuditRec[]; chain: ChainVerification }>>;
  markRead: (ids: string[] | "all") => Promise<void>;
  consent: () => Promise<void>;
  reviewAssumption: (id: string) => Promise<boolean>;
  /** Put this profile on the server now (and remember it as the one on screen). */
  saveProfile: (p: UserProfile) => Promise<void>;
  /** Reset ONLY this account on the server, then the local copy. */
  resetMyDemo: () => Promise<void>;
  /** Delete this account's demo data on the server and in this browser. */
  deleteMyData: () => Promise<void>;
}

/** What the customer gives before a case can be created: the risk questionnaire answers and the demo consent. */
export interface AgreementInput {
  risk: Record<string, number>;
  consent: { accepted: boolean; version: string };
}

const WfCtx = createContext<Wf | null>(null);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const { state, update, setReviews, clearData, resetDemo } = useApp();
  const [sync, setSync] = useState<SyncView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const busy = useRef(false);
  const lastProfile = useRef("");
  const latestProfile = useRef<UserProfile | null>(null);
  useEffect(() => {
    latestProfile.current = state?.profile ?? null;
  }, [state?.profile]);
  const triedAutoSignIn = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const r = await api<SyncView>("GET", "sync");
      setOffline(false);
      if (r.ok && r.data) setSync(r.data);
      else if (r.status === 401) setSync(null);
    } catch {
      setOffline(true);
    } finally {
      busy.current = false;
      setLoaded(true);
    }
  }, []);

  // first sync, then poll. Polling pauses while the tab is hidden and catches up the moment it is shown again.
  const pollMs = sync?.pollMs ?? 5000;
  useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, pollMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, pollMs]);

  // assumption reviews are public; keep the local copy current (they drive the "unverified" tags)
  useEffect(() => {
    let live = true;
    api<{ reviews: Record<string, { by: string; on: string }> }>("GET", "assumptions/reviews")
      .then((r) => live && r.data && setReviews(r.data.reviews))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [setReviews, sync?.unread]);

  const signIn = useCallback(
    async (p: Persona, language?: Lang) => {
      const r = await api<SyncView>("POST", "auth/demo", { persona: p, language });
      if (!r.ok) return false;
      await refresh();
      return true;
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await api("POST", "auth/logout", {});
    setSync(null);
  }, []);

  // If the browser still has a demo profile but the session cookie is gone or expired, quietly sign in again.
  useEffect(() => {
    if (!loaded || sync || triedAutoSignIn.current || !state?.profile || !state.personaId) return;
    triedAutoSignIn.current = true;
    void signIn(state.personaId);
  }, [loaded, sync, state?.profile, state?.personaId, signIn]);

  // keep the server's copy of the profile in step with the intake answers
  const customer = sync?.user.role === "customer";
  useEffect(() => {
    if (!customer || !state?.profile || !state.intakeDone) return;
    const body = JSON.stringify(state.profile);
    if (body === lastProfile.current) return;
    lastProfile.current = body;
    void api("PUT", "me/profile", state.profile).then(() => refresh());
  }, [customer, state?.profile, state?.intakeDone, refresh]);

  // coming back with a live session but an empty browser: restore the profile from the server
  useEffect(() => {
    if (!customer || state?.profile || !sync?.profile) return;
    update((s) => ({ ...s, touched: true, personaId: (sync.user.persona as never) ?? "fresh", profile: sync.profile!, intakeDone: true, noticeSeen: s.noticeSeen }));
  }, [customer, state?.profile, sync?.profile, sync?.user.persona, update]);

  /** The server drafts from the profile it holds, so make sure it holds the one on screen. */
  const ensureProfile = useCallback(async () => {
    const p = latestProfile.current;
    if (!p) return;
    const body = JSON.stringify(p);
    if (body === lastProfile.current) return;
    lastProfile.current = body;
    await api("PUT", "me/profile", p);
  }, []);

  const run = useCallback(
    async (method: "POST" | "PUT", path: string, body: unknown = {}): Promise<CaseResult> => {
      try {
        const r = await api<{ case: Case; blocked?: boolean }>(method, path, body);
        if (r.ok && r.data?.case) setSync((s) => (s ? { ...s, case: s.user.role === "customer" ? r.data!.case : s.case } : s));
        await refresh();
        return r;
      } catch {
        setOffline(true);
        return { ok: false, status: 0, error: "offline", data: null };
      }
    },
    [refresh],
  );

  const value = useMemo<Wf>(
    () => ({
      loaded,
      offline,
      me: sync?.user ?? null,
      role: sync?.user.role ?? null,
      myCase: sync?.case ?? null,
      queue: sync?.queue ?? [],
      notifications: sync?.notifications ?? [],
      unread: sync?.unread ?? 0,
      pollMs,
      signIn,
      signOut,
      refresh,
      submit: async (language, agreement) => {
        await ensureProfile();
        return run("POST", "cases", { language, ...(agreement ?? {}) });
      },
      escalate: async (language, agreement) => {
        await ensureProfile();
        return run("POST", "cases/escalate", { language, ...(agreement ?? {}) });
      },
      acceptPlan: (id) => run("POST", `cases/${id}/accept`),
      retryGeneration: (id) => run("POST", `cases/${id}/retry`),
      reportError: (id, note) => run("POST", `cases/${id}/report-error`, { note }),
      saveProfile: async (p) => {
        latestProfile.current = p;
        lastProfile.current = JSON.stringify(p);
        await api("PUT", "me/profile", p);
      },
      reply: (id, text) => run("POST", `cases/${id}/reply`, { text }),
      claim: (id) => run("POST", `cases/${id}/claim`),
      release: (id) => run("POST", `cases/${id}/release`),
      decide: (id, itemId, decision, comment, dwellMs) =>
        run("POST", `cases/${id}/items/${itemId}/decide`, { decision, ...(comment !== undefined ? { comment } : {}), ...(dwellMs !== undefined ? { dwellMs } : {}) }),
      edit: (id, itemId, text, lang, dwellMs) => run("POST", `cases/${id}/items/${itemId}/edit`, { text, lang, ...(dwellMs !== undefined ? { dwellMs } : {}) }),
      setChecklist: (id, item, value) => run("POST", `cases/${id}/checklist`, { id: item, value }),
      approve: (id) => run("POST", `cases/${id}/approve`),
      returnForInfo: (id, question) => run("POST", `cases/${id}/return`, { question }),
      copilot: (id, language) => run("POST", `cases/${id}/copilot`, { language }),
      caseDetail: (id) => api("GET", `cases/${id}`),
      markRead: async (ids) => {
        await api("POST", "notifications/read", { ids });
        await refresh();
      },
      consent: async () => {
        await api("POST", "me/consent", {});
      },
      reviewAssumption: async (id) => {
        const r = await api<{ reviews: Record<string, { by: string; on: string }> }>("POST", `assumptions/${encodeURIComponent(id)}/review`, {});
        if (r.data) setReviews(r.data.reviews);
        return r.ok;
      },
      resetMyDemo: async () => {
        await api("POST", "me/reset", {});
        lastProfile.current = "";
        resetDemo();
        await refresh();
      },
      deleteMyData: async () => {
        await api("POST", "me/delete", {});
        setSync(null);
        lastProfile.current = "";
        triedAutoSignIn.current = true;
        clearData();
      },
    }),
    [loaded, offline, sync, pollMs, signIn, signOut, refresh, run, ensureProfile, setReviews, resetDemo, clearData],
  );

  return <WfCtx.Provider value={value}>{children}</WfCtx.Provider>;
}

export function useWorkflow(): Wf {
  const c = useContext(WfCtx);
  if (!c) throw new Error("useWorkflow outside WorkflowProvider");
  return c;
}

export type { CopilotOut, UserProfile };
