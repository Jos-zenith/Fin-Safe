// Test harness for the server: an in-memory store, seeded, and clients that carry their own cookie.
import { PRIYA } from "@/data/personas";
import { handle } from "@/server/api";
import { clock } from "@/server/config";
import { ensureSeeded } from "@/server/seed";
import { newMemoryStore, setStoreForTests } from "@/server/store";
import type { SqliteCaseStore } from "@/server/store/sqlite";
import type { UserRec } from "@/server/store/types";
import { startSession } from "@/server/auth";
import { CONSENT_VERSION } from "@/config/workflow";

process.env.SESSION_SECRET = "test-secret-0123456789abcdef-test";

export interface Res {
  status: number;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  headers: Headers;
}

export class Client {
  cookie = "";
  constructor(
    private store: SqliteCaseStore,
    public label: string,
  ) {}

  async call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Res> {
    const headers: Record<string, string> = { "content-type": "application/json", "x-requested-with": "fetch", host: "localhost", ...extra };
    if (this.cookie) headers.cookie = this.cookie;
    const res = await handle(new Request(`http://localhost/api/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), this.store);
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.startsWith("fs_session=;") || /Max-Age=0/.test(set) ? "" : set.split(";")[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  }
  get = (path: string) => this.call("GET", path);
  post = (path: string, body: unknown = {}) => this.call("POST", path, body);
  put = (path: string, body: unknown) => this.call("PUT", path, body);

  async signIn(persona: string, language: "en" | "hi" | "ta" = "en"): Promise<Res> {
    const r = await this.post("auth/demo", { persona, language });
    if (r.status !== 200) throw new Error(`sign-in failed: ${r.status} ${JSON.stringify(r.body)}`);
    return r;
  }
}

export async function makeApp() {
  const store = newMemoryStore();
  setStoreForTests(store);
  await ensureSeeded(store);
  const client = (label: string) => new Client(store, label);
  const as = async (persona: string) => {
    const c = client(persona);
    await c.signIn(persona);
    return c;
  };
  /** A second adviser (the demo has one), signed in directly through the store. */
  const secondAdviser = async () => {
    const user: UserRec = {
      id: "adviser-two",
      role: "adviser",
      persona: "adviser",
      displayName: "Second demo adviser (synthetic)",
      language: "en",
      isSeed: false,
      createdAt: new Date(clock.now()).toISOString(),
      lastActiveAt: new Date(clock.now()).toISOString(),
      consentAt: null,
    };
    await store.saveUser(user);
    const { cookie } = await startSession(store, user.id);
    const c = client("adviser-two");
    c.cookie = `fs_session=${encodeURIComponent(cookie)}`;
    return c;
  };
  /** Priya with her demo profile saved. */
  const priya = async () => {
    const c = await as("priya");
    expectOk(await c.put("me/profile", PRIYA));
    return c;
  };
  return { store, client, as, secondAdviser, priya };
}

function expectOk(r: Res) {
  if (r.status !== 200) throw new Error(`expected 200, got ${r.status} ${JSON.stringify(r.body)}`);
}
export { expectOk };

/** The questionnaire answers and consent a customer gives before a case can be created. */
export const AGREEMENT = { risk: { cushion: 2, fall: 2, swing: 2, horizon: 2, years: 2, past: 2 }, consent: { accepted: true, version: CONSENT_VERSION } };
export const submitBody = (language: "en" | "hi" | "ta" = "en") => ({ language, ...AGREEMENT });

export const ALL_CHECKLIST = ["suitability", "risk", "conflicts", "fee", "language", "assumptions", "demo_ack"];

/** Runs a case through the full checklist (which includes confirming the risk profile). */
export async function tickAll(adviser: Client, caseId: string) {
  for (const id of ALL_CHECKLIST) expectOk(await adviser.post(`cases/${caseId}/checklist`, { id, value: true }));
}

/** Acts on every plan item (accepts each), as the adviser must before Approve is allowed. */
export async function actOnAll(adviser: Client, caseId: string) {
  const c = (await adviser.get(`cases/${caseId}`)).body.case;
  for (const item of c.plan.items) {
    const r = c.reviews[item.id]?.decision ?? "pending";
    if (r === "pending") expectOk(await adviser.post(`cases/${caseId}/items/${item.id}/decide`, { decision: "accepted", dwellMs: 4000 }));
  }
}

/** Everything an adviser does before pressing Approve: act on every item, then the checklist. */
export async function readyToApprove(adviser: Client, caseId: string) {
  await actOnAll(adviser, caseId);
  await tickAll(adviser, caseId);
}
