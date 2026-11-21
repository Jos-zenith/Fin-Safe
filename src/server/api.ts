// The HTTP surface of the workflow. ONE router (`handle`) so it can be called directly from tests with a plain
// Request, and so every route goes through the same authentication, CSRF and role checks.
//
//   public:    GET health, POST auth/demo, GET assumptions/reviews
//   customer:  me/*, cases (own only)
//   adviser:   queue, claim, decide, edit, approve, return, copilot, assumption review, ai/stats
//
// Demo authentication. Not secure authentication (see auth.ts).
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ASSUMPTIONS } from "@/config/assumptions";
import { CopilotSchema } from "@/lib/ai/schemas";
import { aiStats } from "@/lib/ai/stats";
import { clientKey, createLimiter } from "@/lib/ratelimit";
import type { Case, Lang, UserProfile } from "@/types";
import { authenticate, clearCookieHeader, setCookieHeader, startSession } from "./auth";
import { nowIso, pollMs } from "./config";
import { aiLimiter } from "./limiter";
import { generateCopilot } from "./plan";
import { makeLLM, resolveProvider } from "@/lib/ai/providers";
import { createFreshUser, ensureSeeded, PERSONAS, resetAccount, type SeedPersona } from "./seed";
import { getStore } from "./store";
import type { CaseStore, UserRec } from "./store/types";
import { syncActions, updateAction } from "./improve";
import { summariseMetrics } from "./metrics";
import { checkDigest, currentDigest, exportDailyDigest, latestExport } from "./auditDigest";
import * as wf from "./workflow";

const MAX_BODY = 100_000;
const LANG = z.enum(["en", "hi", "ta"]);

const money = z.number().finite().min(0).max(1e10);
const ProfileSchema = z.strictObject({
  id: z.string().max(80),
  name: z.string().max(60),
  age: z.number().int().min(0).max(120),
  city: z.string().max(60),
  cityTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  language: LANG,
  incomeStable: z.boolean(),
  monthlyIncome: money,
  essentialExpenses: money,
  otherExpenses: money,
  dependents: z.number().int().min(0).max(30),
  familySize: z.number().int().min(1).max(40),
  liquidSavings: money,
  goals: z
    .array(z.strictObject({ id: z.string().max(40), kind: z.enum(["home", "education", "retirement", "travel", "wedding", "other"]), targetAmount: money, years: z.number().min(0).max(60), savedSoFar: money.optional() }))
    .max(10),
  debts: z.array(z.strictObject({ id: z.string().max(40), label: z.string().max(60), outstanding: money, ratePct: z.number().min(0).max(100), emi: money })).max(10),
  insurance: z.array(z.strictObject({ id: z.string().max(40), kind: z.enum(["term", "health"]), cover: money })).max(10),
  holdings: z.array(z.strictObject({ id: z.string().max(40), label: z.string().max(80), assetClass: z.enum(["equity", "debt", "gold", "international_equity", "other"]), amount: money })).max(30),
  risk: z.strictObject({ onFall: z.enum(["sell", "wait", "buy"]), followsTips: z.boolean() }),
  incomeMonths: z.strictObject({ good: money, bad: money, history: z.array(money).max(12).optional() }).optional(),
  employerTermCover: money.optional(),
  confirmed: z.array(z.string().max(30)).max(30).optional(),
  isSynthetic: z.literal(true),
});

const bodies = {
  demo: z.strictObject({ persona: z.enum([...PERSONAS, "fresh", "adviser"]), language: LANG.optional() }),
  lang: z.strictObject({ language: LANG }),
  text: z.strictObject({ text: z.string().min(1).max(1200), lang: LANG.optional() }),
  decide: z.strictObject({ decision: z.enum(["pending", "accepted", "rejected", "edited"]), comment: z.string().max(500).optional(), dwellMs: z.number().int().min(0).max(3_600_000).optional() }),
  // creating a case needs the questionnaire and the consent. Validated again in the workflow (complete, right version, accepted).
  submit: z.strictObject({
    language: LANG,
    risk: z.record(z.string().max(20), z.number().int().min(0).max(3)).optional(),
    consent: z.strictObject({ accepted: z.boolean(), version: z.string().max(20) }).optional(),
  }),
  report: z.strictObject({ note: z.string().min(1).max(500) }),
  edit: z.strictObject({ text: z.string().min(1).max(1200), lang: LANG.optional(), dwellMs: z.number().int().min(0).max(3_600_000).optional() }),
  ask: z.strictObject({ question: z.string().min(1).max(300), language: LANG }),
  event: z.strictObject({ kind: z.literal("cooling_off_shown") }),
  checklist: z.strictObject({ id: z.string().max(40), value: z.boolean() }),
  question: z.strictObject({ question: z.string().min(1).max(500) }),
  action: z.strictObject({ status: z.enum(["suggested", "planned", "done", "skipped"]).optional(), followupOn: z.union([z.string().max(10), z.null()]).optional() }),
  read: z.strictObject({ ids: z.union([z.literal("all"), z.array(z.string().max(80)).max(200)]) }),
  copilot: z.strictObject({ language: LANG }),
};

// Starting a session creates a user row for "fresh", so cap how fast one caller can do it.
const authLimiter = createLimiter({ perKey: 30, global: 600 });

type Handler = (c: Req) => Promise<Response>;
interface Req {
  req: Request;
  method: string;
  parts: string[];
  store: CaseStore;
  requestId: string;
  user: UserRec | null;
  json: <T>(schema: z.ZodType<T>) => Promise<T>;
  secure: boolean;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function ctxOf(c: Req): wf.Ctx {
  if (!c.user) throw new HttpError(401, "sign_in_required");
  return { store: c.store, user: c.user, requestId: c.requestId };
}

async function meView(store: CaseStore, user: UserRec) {
  const unread = await store.unreadCount(user.id);
  const base = {
    user: { id: user.id, role: user.role, persona: user.persona, displayName: user.displayName, language: user.language, consentAt: user.consentAt },
    pollMs: pollMs(),
    serverTime: nowIso(),
    unread,
  };
  if (user.role === "customer") {
    const rec = await store.getCaseByUser(user.id);
    return { ...base, profile: await store.getProfile(user.id), case: rec ? await wf.viewCase(store, rec, user) : null };
  }
  return { ...base, profile: null, case: null };
}

// ---------- route table ----------
const routes: { method: string; pattern: string; auth: boolean; handler: Handler }[] = [];
const route = (method: string, pattern: string, auth: boolean, handler: Handler) => routes.push({ method, pattern, auth, handler });

const match = (pattern: string, parts: string[]): Record<string, string> | null => {
  const p = pattern.split("/");
  if (p.length !== parts.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) out[p[i].slice(1)] = decodeURIComponent(parts[i]);
    else if (p[i] !== parts[i]) return null;
  }
  return out;
};

route("GET", "health", false, async () => json(200, { ok: true }));

route("POST", "auth/demo", false, async (c) => {
  const b = await c.json(bodies.demo);
  if (authLimiter.limited(clientKey(c.req.headers, process.env.TRUST_PROXY === "1"))) throw new HttpError(429, "slow_down");
  await ensureSeeded(c.store);
  let user: UserRec | null;
  if (b.persona === "fresh") user = await createFreshUser(c.store, b.language ?? "en");
  else if (b.persona === "adviser") user = await c.store.getUser("adviser-demo");
  else user = await c.store.findUserByPersona(b.persona satisfies SeedPersona);
  if (!user) throw new HttpError(500, "seed_missing");
  const { cookie, maxAge } = await startSession(c.store, user.id);
  return json(200, await meView(c.store, user), { "set-cookie": setCookieHeader(cookie, maxAge, c.secure) });
});

route("POST", "auth/logout", true, async (c) => {
  const cookie = c.req.headers.get("cookie") ?? "";
  const sid = /fs_session=([^;.]+)/.exec(cookie)?.[1];
  if (sid) await c.store.deleteSession(decodeURIComponent(sid));
  return json(200, { ok: true }, { "set-cookie": clearCookieHeader(c.secure) });
});

route("GET", "me", true, async (c) => json(200, await meView(c.store, ctxOf(c).user)));

// One call for the 5-second poll: who I am, my case (or the queue), and my notifications.
route("GET", "sync", true, async (c) => {
  const ctx = ctxOf(c);
  const me = await meView(c.store, ctx.user);
  const notifications = await c.store.listNotifications(ctx.user.id, 30);
  const queue = ctx.user.role === "adviser" ? await wf.queue(ctx) : null;
  return json(200, { ...me, queue, notifications });
});

route("POST", "me/consent", true, async (c) => {
  const ctx = ctxOf(c);
  if (!ctx.user.consentAt) await c.store.saveUser({ ...ctx.user, consentAt: nowIso() });
  return json(200, { ok: true });
});

route("PUT", "me/profile", true, async (c) => {
  const ctx = ctxOf(c);
  const profile = await c.json(ProfileSchema);
  const changes = await wf.saveProfile(ctx, profile as UserProfile);
  return json(200, { ok: true, changes });
});

// Improve: the person's planning to-dos per finding, and what changed when they updated their numbers.
route("GET", "me/actions", true, async (c) => {
  const ctx = ctxOf(c);
  if (ctx.user.role !== "customer") throw new HttpError(403, "forbidden");
  const profile = await c.store.getProfile(ctx.user.id);
  const actions = profile ? await syncActions(c.store, ctx.user.id, profile) : [];
  const rec = await c.store.getCaseByUser(ctx.user.id);
  const chains = [`user:${ctx.user.id}`, ...(rec ? [rec.id] : [])];
  const entries = (await Promise.all(chains.map((id) => c.store.listAudit(id)))).flat().filter((e) => e.action === "profile_updated" || e.action === "action_updated");
  const changes = entries.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 20);
  return json(200, { actions, changes, caseStatus: rec?.status ?? null });
});
route("POST", "me/actions/:id", true, async (c) => {
  const ctx = ctxOf(c);
  if (ctx.user.role !== "customer") throw new HttpError(403, "forbidden");
  const b = await c.json(bodies.action);
  const a = await updateAction(c.store, ctx.user, c.requestId, c.parts[2], b);
  return json(200, { action: a });
});

route("POST", "me/reset", true, async (c) => {
  const ctx = ctxOf(c);
  await resetAccount(c.store, ctx.user);
  return json(200, await meView(c.store, (await c.store.getUser(ctx.user.id)) ?? ctx.user));
});

// "Delete my demo data": everything this account holds goes, and only an anonymous counter stays.
route("POST", "me/delete", true, async (c) => {
  const ctx = ctxOf(c);
  await c.store.purgeUserData(ctx.user.id);
  await c.store.bumpCounter("demo_data_deleted");
  await c.store.deleteSessionsOf(ctx.user.id);
  if (!ctx.user.isSeed) await c.store.deleteUser(ctx.user.id);
  else await c.store.saveUser({ ...ctx.user, consentAt: null });
  return json(200, { ok: true }, { "set-cookie": clearCookieHeader(c.secure) });
});

route("POST", "ask", true, async (c) => {
  const b = await c.json(bodies.ask);
  // only a real (paid) model is rate limited; mock answers are free
  const live = makeLLM(resolveProvider()) !== null;
  const limited = live ? aiLimiter.limited(clientKey(c.req.headers, process.env.TRUST_PROXY === "1")) : false;
  const r = await wf.ask(ctxOf(c), b.question, b.language, limited);
  return json(200, r);
});

route("POST", "me/events", true, async (c) => {
  const b = await c.json(bodies.event);
  await wf.logUserEvent(ctxOf(c), b.kind);
  return json(200, { ok: true });
});

route("POST", "cases", true, async (c) => {
  const b = await c.json(bodies.submit);
  const rec = await wf.submitCase(ctxOf(c), b.language, { risk: b.risk, consent: b.consent });
  return json(200, { case: await wf.viewCase(c.store, rec, ctxOf(c).user) });
});
route("POST", "cases/escalate", true, async (c) => {
  const b = await c.json(bodies.submit);
  const rec = await wf.escalate(ctxOf(c), b.language, { risk: b.risk, consent: b.consent });
  return json(200, { case: await wf.viewCase(c.store, rec, ctxOf(c).user) });
});
route("GET", "cases", true, async (c) => json(200, { queue: await wf.queue(ctxOf(c)) }));

route("GET", "cases/:id", true, async (c) => {
  const ctx = ctxOf(c);
  const rec = await wf.caseForViewer(ctx, c.parts[1]);
  const [view, audit, chain] = await Promise.all([wf.viewCase(c.store, rec, ctx.user), c.store.listAudit(rec.id), c.store.verifyChain(rec.id)]);
  return json(200, { case: view, audit, chain });
});
route("GET", "cases/:id/audit/verify", true, async (c) => {
  const ctx = ctxOf(c);
  const rec = await wf.caseForViewer(ctx, c.parts[1]);
  return json(200, await c.store.verifyChain(rec.id));
});

const act = (fn: (ctx: wf.Ctx, id: string, c: Req) => Promise<unknown>): Handler => async (c) => {
  const ctx = ctxOf(c);
  const out = await fn(ctx, c.parts[1], c);
  const rec = (out as { rec?: unknown }).rec ?? out;
  const view = await wf.viewCase(c.store, rec as never, ctx.user);
  return json(200, { case: view, ...(out && typeof out === "object" && "blocked" in out ? { blocked: (out as { blocked: boolean }).blocked } : {}) });
};

route("POST", "cases/:id/claim", true, act((ctx, id) => wf.claim(ctx, id)));
route("POST", "cases/:id/release", true, act((ctx, id) => wf.release(ctx, id)));
route("POST", "cases/:id/approve", true, act((ctx, id) => wf.approve(ctx, id)));
route("POST", "cases/:id/accept", true, act((ctx, id) => wf.acceptPlan(ctx, id)));
route("POST", "cases/:id/retry", true, act((ctx, id) => wf.retryGeneration(ctx, id)));
route("POST", "cases/:id/report-error", true, act(async (ctx, id, c) => wf.reportError(ctx, id, (await c.json(bodies.report)).note)));
route("POST", "cases/:id/return", true, act(async (ctx, id, c) => wf.returnForInfo(ctx, id, (await c.json(bodies.question)).question)));
route("POST", "cases/:id/reply", true, act(async (ctx, id, c) => wf.userReply(ctx, id, (await c.json(bodies.text)).text)));
route("POST", "cases/:id/checklist", true, act(async (ctx, id, c) => {
  const b = await c.json(bodies.checklist);
  return wf.setChecklist(ctx, id, b.id, b.value);
}));
route("POST", "cases/:id/items/:itemId/decide", true, act(async (ctx, id, c) => {
  const b = await c.json(bodies.decide);
  return wf.decideItem(ctx, id, c.parts[3], b.decision, b.comment, b.dwellMs);
}));
route("POST", "cases/:id/items/:itemId/edit", true, act(async (ctx, id, c) => {
  const b = await c.json(bodies.edit);
  return wf.editItem(ctx, id, c.parts[3], b.text, (b.lang ?? ctx.user.language) as Lang, b.dwellMs);
}));
route("POST", "cases/:id/copilot", true, act(async (ctx, id, c) => {
  const b = await c.json(bodies.copilot);
  const rec = await c.store.getCase(id);
  if (!rec) throw new HttpError(404, "not_found");
  const profile = await c.store.getProfile(rec.userId);
  if (!profile) throw new HttpError(409, "profile_missing");
  // checked up front so a customer cannot trigger a (possibly paid) model call
  if (ctx.user.role !== "adviser") throw new HttpError(403, "forbidden");
  const drafted = await generateCopilot(profile, b.language);
  return wf.setCopilot(ctx, id, { ...CopilotSchema.parse(drafted.out), source: drafted.source });
}));

route("GET", "notifications", true, async (c) => {
  const ctx = ctxOf(c);
  return json(200, { notifications: await c.store.listNotifications(ctx.user.id, 50), unread: await c.store.unreadCount(ctx.user.id) });
});
route("POST", "notifications/read", true, async (c) => {
  const ctx = ctxOf(c);
  const b = await c.json(bodies.read);
  const n = await c.store.markRead(ctx.user.id, b.ids, nowIso());
  return json(200, { marked: n, unread: await c.store.unreadCount(ctx.user.id) });
});

route("GET", "assumptions/reviews", false, async (c) => json(200, { reviews: Object.fromEntries((await c.store.listAssumptionReviews()).map((r) => [r.assumptionId, { by: r.byName, on: r.on }])) }));
route("POST", "assumptions/:id/review", true, async (c) => {
  const ctx = ctxOf(c);
  await wf.reviewAssumption(ctx, c.parts[1], (id) => ASSUMPTIONS.some((a) => a.id === id));
  return json(200, { reviews: Object.fromEntries((await c.store.listAssumptionReviews()).map((r) => [r.assumptionId, { by: r.byName, on: r.on }])) });
});

// Adviser metrics: events only (what happened and when), never who or what was said. Demo data, not evidence.
route("GET", "metrics", true, async (c) => {
  const ctx = ctxOf(c);
  if (ctx.user.role !== "adviser") throw new HttpError(403, "forbidden");
  const queue = await wf.queue(ctx);
  return json(200, summariseMetrics(await c.store.listMetrics(), queue.filter((x) => x.overdue).length, nowIso()));
});

// Audit digest: the head of every chain, hashed. Shown to advisers and exportable to a local file. NOT an anchor.
route("GET", "audit/digest", true, async (c) => {
  if (ctxOf(c).user.role !== "adviser") throw new HttpError(403, "forbidden");
  const current = await currentDigest(c.store, nowIso());
  const last = latestExport();
  return json(200, { current, latestExport: last ? { file: last.file, date: last.doc.date, digest: last.doc.digest, check: await checkDigest(c.store, last.doc) } : null });
});
route("POST", "audit/digest/export", true, async (c) => {
  if (ctxOf(c).user.role !== "adviser") throw new HttpError(403, "forbidden");
  const r = await exportDailyDigest(c.store, nowIso());
  return json(200, { file: r.file, created: r.created, digest: r.doc.digest, date: r.doc.date });
});

// The "AI status" line: the mode, and which of the last outputs were live, template or fallback. Counts only.
route("GET", "ai/status", true, async () => {
  const cfg = resolveProvider();
  return json(200, { mode: cfg.provider === "mock" ? "mock" : "live", fellBackToMock: !!cfg.warning, last: aiStats.recent() });
});

route("GET", "ai/stats", true, async (c) => {
  if (ctxOf(c).user.role !== "adviser") throw new HttpError(403, "forbidden");
  return json(200, { note: "counts only; held in this server process's memory", tasks: aiStats.snapshot() });
});

// ---------- entry point ----------
const isSecure = (req: Request) => new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

export async function handle(req: Request, store: CaseStore = getStore()): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/v1\/?/, "").replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  const method = req.method.toUpperCase();
  const requestId = (req.headers.get("x-request-id") ?? "").replace(/[^\w-]/g, "").slice(0, 64) || randomUUID();
  const respond = (r: Response) => {
    r.headers.set("x-request-id", requestId);
    return r;
  };

  try {
    // Cross-site request forgery: every state-changing call must carry a header a foreign page cannot add
    // without a CORS preflight, and its Origin (when sent) must be this site.
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      if (req.headers.get("x-requested-with") !== "fetch") throw new HttpError(403, "csrf");
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).host !== (req.headers.get("host") ?? url.host)) throw new HttpError(403, "csrf");
    }

    const found = routes.map((r) => ({ r, m: r.method === method ? match(r.pattern, parts) : null })).find((x) => x.m);
    if (!found) {
      const pathExists = routes.some((r) => match(r.pattern, parts));
      throw new HttpError(pathExists ? 405 : 404, pathExists ? "method_not_allowed" : "not_found");
    }

    const authed = await authenticate(store, req.headers);
    if (found.r.auth && !authed) throw new HttpError(401, "sign_in_required");

    const c: Req = {
      req,
      method,
      parts,
      store,
      requestId,
      user: authed?.user ?? null,
      secure: isSecure(req),
      json: async <T,>(schema: z.ZodType<T>) => {
        const text = await req.text();
        if (text.length > MAX_BODY) throw new HttpError(413, "too_large");
        let raw: unknown;
        try {
          raw = text ? JSON.parse(text) : {};
        } catch {
          throw new HttpError(400, "bad_json");
        }
        const parsed = schema.safeParse(raw);
        if (!parsed.success) throw new HttpError(400, "bad_request");
        return parsed.data;
      },
    };
    return respond(await found.r.handler(c));
  } catch (e) {
    if (e instanceof HttpError) return respond(json(e.status, { error: e.code }));
    if (e instanceof wf.WorkflowError) return respond(json(e.status, { error: e.code }));
    // Never echo the error: it can carry request content. Log the kind only.
    console.error(JSON.stringify({ api: { path, method, status: "error" } }));
    return respond(json(500, { error: "server_error" }));
  }
}

export type { Case };
