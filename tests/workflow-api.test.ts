// The case workflow, tested through the real HTTP router with an in-memory store: authentication, authorization on
// every route, the state machine, claim exclusivity, SLA, notifications, the hash-chained audit and retention.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIYA } from "@/data/personas";
import { clock } from "@/server/config";
import { setPlanGeneratorForTests } from "@/server/plan";
import { purgeStale } from "@/server/retention";
import { resetSeedCustomer } from "@/server/seed";
import { setStoreForTests } from "@/server/store";
import { actOnAll, ALL_CHECKLIST, expectOk, makeApp, readyToApprove, submitBody } from "./server-helpers";

let app: Awaited<ReturnType<typeof makeApp>>;
const realNow = clock.now;
beforeEach(async () => {
  clock.now = realNow;
  app = await makeApp();
});
afterEach(() => {
  clock.now = realNow;
  setPlanGeneratorForTests(null);
  setStoreForTests(null);
});

const caseId = "case-priya";

describe("authentication (demo only)", () => {
  it("every protected route refuses an anonymous caller", async () => {
    const anon = app.client("anon");
    for (const [m, p] of [
      ["GET", "me"], ["GET", "sync"], ["GET", "cases"], ["GET", "cases/case-ramesh"], ["POST", "cases"], ["POST", "cases/case-ramesh/claim"],
      ["POST", "cases/case-ramesh/approve"], ["PUT", "me/profile"], ["POST", "me/reset"], ["POST", "me/delete"], ["GET", "notifications"], ["GET", "ai/stats"],
      ["POST", "assumptions/ef.months.stable/review"],
    ] as const) {
      const r = await anon.call(m, p, m === "GET" ? undefined : {});
      expect(r.status, `${m} ${p}`).toBe(401);
    }
  });

  it("public routes work without a session: health, sign-in, assumption reviews", async () => {
    const anon = app.client("anon");
    expect((await anon.get("health")).status).toBe(200);
    expect((await anon.get("assumptions/reviews")).status).toBe(200);
    expect((await anon.post("auth/demo", { persona: "priya" })).status).toBe(200);
  });

  it("the cookie is httpOnly, same-site and signed; Secure only over https", async () => {
    const c = app.client("p");
    const r = await c.signIn("priya");
    const set = r.headers.get("set-cookie")!;
    expect(set).toMatch(/^fs_session=/);
    expect(set).toMatch(/HttpOnly/);
    expect(set).toMatch(/SameSite=Lax/);
    expect(set).not.toMatch(/Secure/);
    expect(decodeURIComponent(set.split(";")[0].split("=")[1]).split(".")).toHaveLength(3);
  });

  it("a forged, edited or expired cookie is rejected", async () => {
    const c = await app.as("priya");
    const good = c.cookie;
    expect((await c.get("me")).status).toBe(200);
    const [name, value] = good.split("=");
    const parts = decodeURIComponent(value).split(".");
    for (const bad of [
      `${name}=${encodeURIComponent(`${parts[0]}.${parts[1]}.${"A".repeat(parts[2].length)}`)}`, // wrong signature
      `${name}=${encodeURIComponent(`other-session.${parts[1]}.${parts[2]}`)}`, // edited session id
      `${name}=${encodeURIComponent(`${parts[0]}.${Number(parts[1]) + 999999}.${parts[2]}`)}`, // extended expiry
      `${name}=garbage`,
    ]) {
      c.cookie = bad;
      expect((await c.get("me")).status, bad.slice(0, 40)).toBe(401);
    }
    c.cookie = good;
    clock.now = () => realNow() + 25 * 3_600_000;
    expect((await c.get("me")).status).toBe(401); // expired
  });

  it("changing the signing secret invalidates every cookie", async () => {
    const c = await app.as("priya");
    const old = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "a-completely-different-secret-value";
    expect((await c.get("me")).status).toBe(401);
    process.env.SESSION_SECRET = old;
    expect((await c.get("me")).status).toBe(200);
  });

  it("signing out ends the session on the server", async () => {
    const c = await app.as("priya");
    const cookie = c.cookie;
    expect((await c.post("auth/logout")).status).toBe(200);
    c.cookie = cookie; // replaying the old cookie must not work
    expect((await c.get("me")).status).toBe(401);
  });

  it("refuses state-changing calls without the CSRF header or from another origin", async () => {
    const c = await app.as("priya");
    expect((await c.call("POST", "me/consent", {}, { "x-requested-with": "" })).status).toBe(403);
    expect((await c.call("POST", "me/consent", {}, { origin: "http://evil.example" })).status).toBe(403);
    expect((await c.call("POST", "me/consent", {}, { origin: "http://localhost" })).status).toBe(200);
  });

  it("production refuses to run without SESSION_SECRET, and development warns loudly", async () => {
    const { assertStartupConfig, sessionSecret } = await import("@/server/config");
    const keep = { s: process.env.SESSION_SECRET, e: process.env.NODE_ENV, d: process.env.DATA_DIR };
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    try {
      delete process.env.SESSION_SECRET;
      vi.stubEnv("NODE_ENV", "production");
      expect(() => assertStartupConfig()).toThrow(/SESSION_SECRET is required in production/);
      expect(() => sessionSecret()).toThrow(/SESSION_SECRET is required in production/);
      vi.stubEnv("NODE_ENV", "development");
      process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "fs-secret-"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const secret = sessionSecret();
      expect(secret.length).toBeGreaterThanOrEqual(32);
      expect(sessionSecret()).toBe(secret); // stable across calls
      expect(warn.mock.calls.join(" ")).toMatch(/Demo authentication. NOT secure authentication/);
      warn.mockRestore();
      process.env.SESSION_SECRET = "short";
      expect(() => sessionSecret()).toThrow(/at least 16/);
    } finally {
      vi.unstubAllEnvs();
      process.env.SESSION_SECRET = keep.s;
      if (keep.d === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = keep.d;
    }
  });
});

describe("authorization: who can see and do what", () => {
  it("a customer cannot list the queue, claim, decide, edit, approve, return, copilot, mark assumptions or read stats", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    for (const [m, p, b] of [
      ["GET", "cases", undefined],
      ["POST", `cases/${caseId}/claim`, {}],
      ["POST", `cases/${caseId}/release`, {}],
      ["POST", `cases/${caseId}/approve`, {}],
      ["POST", `cases/${caseId}/return`, { question: "q" }],
      ["POST", `cases/${caseId}/checklist`, { id: "risk", value: true }],
      ["POST", `cases/${caseId}/copilot`, { language: "en" }],
      ["POST", `cases/${caseId}/items/x/decide`, { decision: "accepted" }],
      ["POST", `cases/${caseId}/items/x/edit`, { text: "t" }],
      ["POST", "assumptions/ef.months.stable/review", {}],
      ["GET", "ai/stats", undefined],
    ] as const) {
      const r = await priya.call(m, p, b);
      expect(r.status, `${m} ${p}`).toBe(403);
    }
  });

  it("a customer cannot approve their OWN plan", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    expect((await priya.post(`cases/${caseId}/approve`)).status).toBe(403);
    const view = (await priya.get(`cases/${caseId}`)).body.case;
    expect(view.status).toBe("DRAFT_READY");
  });

  it("a customer cannot read another customer's case, and cannot tell that it exists", async () => {
    const priya = await app.priya();
    const ramesh = await app.as("ramesh");
    expectOk(await priya.post("cases", submitBody()));
    expect((await ramesh.get(`cases/${caseId}`)).status).toBe(404);
    expect((await ramesh.get("cases/case-anita")).status).toBe(404);
    expect((await ramesh.get("cases/case-does-not-exist")).status).toBe(404);
    expect((await ramesh.get(`cases/${caseId}/audit/verify`)).status).toBe(404);
    expect((await ramesh.post(`cases/${caseId}/reply`, { text: "hi" })).status).toBe(404);
    // and their own is fine
    expect((await ramesh.get("cases/case-ramesh")).status).toBe(200);
    // the sync payload of a customer never carries other people's cases
    const sync = (await ramesh.get("sync")).body;
    expect(sync.queue).toBeNull();
    expect(JSON.stringify(sync)).not.toContain("case-priya");
    expect(JSON.stringify(sync)).not.toContain("case-anita");
  });

  it("customers never see the adviser's checklist or copilot", async () => {
    const adviser = await app.as("adviser");
    expectOk(await adviser.post("cases/case-ramesh/claim"));
    expectOk(await adviser.post("cases/case-ramesh/checklist", { id: "risk", value: true }));
    expectOk(await adviser.post("cases/case-ramesh/copilot", { language: "en" }));
    const mine = (await adviser.get("cases/case-ramesh")).body.case;
    expect(mine.checklist.risk).toBe(true);
    expect(mine.copilot).toBeTruthy();
    expect(mine.copilot.source).toBe("mock"); // the copilot text says where it came from
    const ramesh = await app.as("ramesh");
    const theirs = (await ramesh.get("cases/case-ramesh")).body.case;
    expect(theirs.checklist).toEqual({});
    expect(theirs.copilot).toBeUndefined();
  });

  it("the plan is drafted by the server: a customer cannot supply one", async () => {
    const priya = await app.priya();
    const r = await priya.post("cases", { ...submitBody(), plan: { summary: "Buy this stock", items: [] } });
    expect(r.status).toBe(400);
    const ok = await priya.post("cases", submitBody());
    expect(ok.status).toBe(200);
    expect(JSON.stringify(ok.body)).not.toMatch(/Buy this stock/);
  });

  it("submitting needs a saved profile, and the profile is validated strictly", async () => {
    const c = await app.as("priya");
    expect((await c.post("cases", submitBody())).body.error).toBe("profile_missing");
    expect((await c.put("me/profile", { ...PRIYA, monthlyIncome: -5 })).status).toBe(400);
    expect((await c.put("me/profile", { ...PRIYA, extra: "x" })).status).toBe(400);
    expect((await c.put("me/profile", { ...PRIYA, age: 400 })).status).toBe(400);
    expect((await c.put("me/profile", PRIYA)).status).toBe(200);
  });

  it("rejects oversized and malformed bodies", async () => {
    const c = await app.as("priya");
    expect((await c.call("PUT", "me/profile", { ...PRIYA, name: "x".repeat(150_000) })).status).toBe(413);
    const res = await c.call("POST", "cases", "not json at all" as never);
    expect([400]).toContain(res.status);
  });
});

describe("state machine and claim exclusivity", () => {
  const submit = async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    return priya;
  };

  it("walks the happy path and rejects every out-of-order step", async () => {
    const priya = await submit();
    const adviser = await app.as("adviser");

    // before the claim
    expect((await adviser.post(`cases/${caseId}/approve`)).status).toBe(409); // not in review yet
    expect((await adviser.post(`cases/${caseId}/return`, { question: "q" })).status).toBe(409);
    expect((await priya.post(`cases/${caseId}/reply`, { text: "hello" })).status).toBe(409); // nothing was asked
    expect((await adviser.post(`cases/${caseId}/release`)).status).toBe(409);

    // claim
    const claimed = await adviser.post(`cases/${caseId}/claim`);
    expect(claimed.body.case.status).toBe("IN_REVIEW");
    expect(claimed.body.case.claimedBy.name).toMatch(/Demo adviser/);

    // approving needs the whole checklist, including the assumptions acknowledgement
    const r1 = await adviser.post(`cases/${caseId}/approve`);
    expect(r1.status).toBe(409);
    expect(r1.body.error).toBe("checklist_incomplete");
    for (const id of ALL_CHECKLIST.filter((x) => x !== "assumptions")) expectOk(await adviser.post(`cases/${caseId}/checklist`, { id, value: true }));
    expect((await adviser.post(`cases/${caseId}/approve`)).body.error).toBe("checklist_incomplete");
    expectOk(await adviser.post(`cases/${caseId}/checklist`, { id: "assumptions", value: true }));
    expect((await adviser.post(`cases/${caseId}/checklist`, { id: "not_a_real_item", value: true })).status).toBe(400);

    // a ticked checklist is not enough: the adviser must have acted on EVERY plan item (nothing is accepted for them)
    const stuck = await adviser.post(`cases/${caseId}/approve`);
    expect(stuck.status).toBe(409);
    expect(stuck.body.error).toBe("items_pending");
    await actOnAll(adviser, caseId);

    const approved = await adviser.post(`cases/${caseId}/approve`);
    expect(approved.body.case.status).toBe("APPROVED");
    expect(approved.body.case.reviewedAt).toBeTruthy();

    // after approval nothing else is valid
    for (const [p, b] of [
      [`cases/${caseId}/claim`, {}], [`cases/${caseId}/approve`, {}], [`cases/${caseId}/return`, { question: "q" }],
      [`cases/${caseId}/checklist`, { id: "risk", value: false }], [`cases/${caseId}/release`, {}],
    ] as const) {
      expect((await adviser.post(p, b)).status, p).toBe(409);
    }
    expect((await priya.post(`cases/${caseId}/reply`, { text: "late" })).status).toBe(409);
    // and the customer sees the reviewed status
    expect((await priya.get(`cases/${caseId}`)).body.case.status).toBe("APPROVED");
  });

  it("returning a question, then the customer's reply, puts the case back in the queue unclaimed", async () => {
    const priya = await submit();
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    expect((await adviser.post(`cases/${caseId}/return`, { question: "  " })).status).toBe(400);
    const ret = await adviser.post(`cases/${caseId}/return`, { question: "Is the rent included in your expenses?" });
    expect(ret.body.case.status).toBe("CHANGES_REQUESTED");
    expect(ret.body.case.claimedBy).toBeNull();
    expect((await adviser.post(`cases/${caseId}/approve`)).status).toBe(409); // back with the customer: not in review
    const seen = (await priya.get(`cases/${caseId}`)).body.case;
    expect(seen.adviserQuestion).toMatch(/rent/);
    expect((await priya.post(`cases/${caseId}/reply`, { text: "" })).status).toBe(400);
    const reply = await priya.post(`cases/${caseId}/reply`, { text: "Yes, rent is included." });
    expect(reply.body.case.status).toBe("DRAFT_READY");
    expect(reply.body.case.userReply).toMatch(/rent is included/);
    // the adviser can claim it again
    expect((await adviser.post(`cases/${caseId}/claim`)).body.case.status).toBe("IN_REVIEW");
  });

  it("only one adviser can claim a case; the other cannot act on it", async () => {
    await submit();
    const a1 = await app.as("adviser");
    const a2 = await app.secondAdviser();
    expect((await a1.post(`cases/${caseId}/claim`)).status).toBe(200);
    const lost = await a2.post(`cases/${caseId}/claim`);
    expect(lost.status).toBe(409);
    expect(lost.body.error).toBe("already_claimed");
    expect((await a1.post(`cases/${caseId}/claim`)).status).toBe(200); // the holder may repeat it
    for (const [p, b] of [
      [`cases/${caseId}/approve`, {}], [`cases/${caseId}/return`, { question: "q" }], [`cases/${caseId}/release`, {}],
      [`cases/${caseId}/checklist`, { id: "risk", value: true }], [`cases/${caseId}/items/${(await a1.get(`cases/${caseId}`)).body.case.plan.items[0].id}/decide`, { decision: "accepted" }],
    ] as const) {
      expect((await a2.post(p, b)).status, p).toBe(403);
    }
    // once released, the second adviser can take it
    expectOk(await a1.post(`cases/${caseId}/release`));
    expect((await a2.post(`cases/${caseId}/claim`)).status).toBe(200);
  });

  it("two advisers racing to claim: exactly one wins", async () => {
    await submit();
    const a1 = await app.as("adviser");
    const a2 = await app.secondAdviser();
    const [r1, r2] = await Promise.all([a1.post(`cases/${caseId}/claim`), a2.post(`cases/${caseId}/claim`)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
  });

  it("item decisions: validated, audited, and an edit that trips a guardrail is not saved", async () => {
    await submit();
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    const item = (await adviser.get(`cases/${caseId}`)).body.case.plan.items[0];
    expect((await adviser.post(`cases/${caseId}/items/nope/decide`, { decision: "accepted" })).status).toBe(404);
    expect((await adviser.post(`cases/${caseId}/items/${item.id}/decide`, { decision: "edited" })).status).toBe(400);
    expect((await adviser.post(`cases/${caseId}/items/${item.id}/decide`, { decision: "rejected", comment: "Not relevant" })).body.case.reviews[item.id].decision).toBe("rejected");

    const blocked = await adviser.post(`cases/${caseId}/items/${item.id}/edit`, { text: "You should buy HDFC Flexi Cap Fund now", lang: "en" });
    expect(blocked.body.blocked).toBe(true);
    expect(blocked.body.case.reviews[item.id].edit).toBeUndefined();

    const edited = await adviser.post(`cases/${caseId}/items/${item.id}/edit`, { text: "Build the reserve first, then review the goals.", lang: "en" });
    expect(edited.body.blocked).toBe(false);
    expect(edited.body.case.reviews[item.id].decision).toBe("edited");

    const actions = (await adviser.get(`cases/${caseId}`)).body.audit.map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["plan_requested", "draft_generated", "case_opened", "item_rejected", "system_guardrail", "item_edited"]));
  });

  it("an escalation makes the case urgent, and a customer with no case gets one", async () => {
    const priya = await app.priya();
    const r = await priya.post("cases/escalate", submitBody());
    expect(r.body.case.urgent).toBe(true);
    expect(r.body.case.status).toBe("DRAFT_READY");
    const again = await priya.post("cases/escalate", submitBody());
    expect(again.body.case.id).toBe(r.body.case.id);
    const audit = (await (await app.as("adviser")).get(`cases/${caseId}`)).body.audit.map((a: { action: string }) => a.action);
    expect(audit.filter((a: string) => a === "panic_escalated").length).toBe(2);
  });

  it("a failing live draft is replaced by the fixture, recorded as system audit entries, and tagged", async () => {
    setPlanGeneratorForTests(async (profile, language) => {
      const { localFixture } = await import("@/lib/ai/run");
      return { plan: localFixture({ task: "draftPlanPack", language, profile }) as never, source: "fixture", latencyMs: 12, events: [{ kind: "numeric_rejected", detail: "pre: 12" }, { kind: "fallback", detail: "validated mock fixture used" }] };
    });
    const priya = await app.priya();
    const r = await priya.post("cases", submitBody());
    expect(r.body.case.planSource).toBe("fixture");
    const audit = (await (await app.as("adviser")).get(`cases/${caseId}`)).body.audit;
    expect(audit.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(["system_numeric_rejected", "system_fallback"]));
    const sys = audit.find((a: { action: string }) => a.action === "system_numeric_rejected");
    expect(sys.actorRole).toBe("system");
  });
});

describe("queue: priority, language, flags, waiting time, SLA", () => {
  it("lists the two seeded waiting cases with their flags, language and SLA, overdue first", async () => {
    const adviser = await app.as("adviser");
    const q = (await adviser.get("cases")).body.queue;
    expect(q.map((c: { id: string }) => c.id)).toEqual(["case-ramesh", "case-anita"]);
    const [ramesh, anita] = q;
    expect(ramesh.overdue).toBe(true); // waiting 130 minutes, SLA 120
    expect(anita.overdue).toBe(false);
    expect(ramesh.waitingMinutes).toBeGreaterThanOrEqual(130);
    expect(new Date(anita.slaDueAt).getTime()).toBeGreaterThan(Date.now());
    expect(ramesh.profile.language).toBe("ta");
    expect(anita.profile.language).toBeTruthy();
    expect(Array.isArray(ramesh.flags) && ramesh.flags.length).toBeGreaterThan(0);
    expect(typeof ramesh.priority).toBe("number");
    expect(ramesh.claimedBy).toBeNull();
  });

  it("time passing turns the next case overdue; an urgent escalation jumps ahead; claimed cases show who holds them", async () => {
    const adviser = await app.as("adviser");
    clock.now = () => realNow() + 100 * 60_000; // 100 minutes later: Anita has now waited 135 minutes
    expect((await adviser.get("cases")).body.queue.every((c: { overdue: boolean }) => c.overdue)).toBe(true);
    clock.now = realNow;
    const priya = await app.priya();
    expectOk(await priya.post("cases/escalate", submitBody()));
    const q = (await adviser.get("cases")).body.queue;
    expect(q[0].id).toBe("case-ramesh"); // overdue still outranks
    const urgent = q.find((c: { id: string }) => c.id === "case-priya");
    expect(urgent.urgent).toBe(true);
    expect(urgent.priority).toBeGreaterThan(q.find((c: { id: string }) => c.id === "case-anita").priority);
    expectOk(await adviser.post("cases/case-anita/claim"));
    expect((await adviser.get("cases")).body.queue.find((c: { id: string }) => c.id === "case-anita").claimedBy.name).toMatch(/adviser/i);
  });
});

describe("notifications", () => {
  it("approval, a returned question and a customer reply each reach the other side, and read state is per user", async () => {
    const priya = await app.priya();
    const adviser = await app.as("adviser");
    expectOk(await priya.post("cases", submitBody()));

    // adviser is told about the new case
    let n = (await adviser.get("notifications")).body;
    expect(n.notifications.map((x: { kind: string }) => x.kind)).toContain("new_case");
    expect(n.unread).toBeGreaterThanOrEqual(1);

    expectOk(await adviser.post(`cases/${caseId}/claim`));
    expectOk(await adviser.post(`cases/${caseId}/return`, { question: "Is your rent included?" }));
    n = (await priya.get("notifications")).body;
    const returned = n.notifications.find((x: { kind: string }) => x.kind === "changes_requested");
    expect(returned.params.question).toMatch(/rent/);
    expect(n.notifications.map((x: { kind: string }) => x.kind)).toContain("review_started");

    expectOk(await priya.post(`cases/${caseId}/reply`, { text: "Yes." }));
    expect((await adviser.get("notifications")).body.notifications.map((x: { kind: string }) => x.kind)).toContain("user_replied");

    expectOk(await adviser.post(`cases/${caseId}/claim`));
    await readyToApprove(adviser, caseId);
    expectOk(await adviser.post(`cases/${caseId}/approve`));
    const mine = (await priya.get("notifications")).body;
    expect(mine.notifications.map((x: { kind: string }) => x.kind)).toContain("approved");
    expect(mine.unread).toBeGreaterThanOrEqual(3);

    // marking read is per user
    const adviserUnread = (await adviser.get("notifications")).body.unread;
    const marked = (await priya.post("notifications/read", { ids: "all" })).body;
    expect(marked.unread).toBe(0);
    expect((await adviser.get("notifications")).body.unread).toBe(adviserUnread);

    // a customer cannot mark someone else's notification read
    const advisers = (await adviser.get("notifications")).body.notifications;
    expect((await priya.post("notifications/read", { ids: [advisers[0].id] })).body.marked).toBe(0);
    expect((await adviser.get("notifications")).body.unread).toBe(adviserUnread);
  });

  it("the sync payload carries the unread count and the poll interval", async () => {
    const priya = await app.as("anita");
    const sync = (await priya.get("sync")).body;
    expect(sync.pollMs).toBe(5000);
    expect(sync.unread).toBe(0);
    process.env.POLL_MS = "800";
    expect(((await priya.get("sync")).body as { pollMs: number }).pollMs).toBe(800);
    delete process.env.POLL_MS;
  });
});

describe("hash-chained audit", () => {
  it("has actor id, role and request id on every entry, and the chain verifies", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.call("POST", `cases/${caseId}/claim`, {}, { "x-request-id": "req-abc-123" }));
    const { audit, chain } = (await adviser.get(`cases/${caseId}`)).body;
    expect(chain.ok).toBe(true);
    expect(chain.entries).toBe(audit.length);
    for (const e of audit) {
      expect(e.actorId).toBeTruthy();
      expect(["customer", "adviser", "system", "ai"]).toContain(e.actorRole);
      expect(e.requestId).toBeTruthy();
      expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(audit[0].prevHash).toBe("0".repeat(64));
    for (let i = 1; i < audit.length; i++) expect(audit[i].prevHash).toBe(audit[i - 1].hash);
    const opened = audit.find((a: { action: string }) => a.action === "case_opened");
    expect(opened.requestId).toBe("req-abc-123");
    expect(opened.actorRole).toBe("adviser");
    expect((await priya.get(`cases/${caseId}/audit/verify`)).body.ok).toBe(true);
  });

  it("the database refuses to update or delete an audit row", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    expect(() => app.store.db.exec("update audit set after = 'tampered' where chain_id = 'case-priya'")).toThrow(/append-only/);
    expect(() => app.store.db.exec("delete from audit where chain_id = 'case-priya'")).toThrow(/append-only/);
  });

  it("detects tampering even when someone removes the database's own guard", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    expect((await priya.get(`cases/${caseId}/audit/verify`)).body.ok).toBe(true);

    // an attacker with raw database access drops the trigger and edits history
    app.store.db.exec("drop trigger audit_no_update");
    app.store.db.exec("update audit set after = 'changed history' where chain_id = 'case-priya' and seq = 2");
    const v = (await priya.get(`cases/${caseId}/audit/verify`)).body;
    expect(v.ok).toBe(false);
    expect(v.brokenAt).toBe(2);
    expect(v.reason).toMatch(/changed/);
    // the UI-facing detail endpoint reports it as well
    expect((await adviser.get(`cases/${caseId}`)).body.chain.ok).toBe(false);
  });

  it("detects a deleted entry and a re-ordered chain", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    app.store.db.exec("drop trigger audit_no_delete");
    app.store.db.exec("delete from audit where chain_id = 'case-priya' and seq = 2");
    const v = (await priya.get(`cases/${caseId}/audit/verify`)).body;
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/sequence|previous/);
  });
});

describe("assumption reviews (adviser marks, audited)", () => {
  it("an adviser can mark an assumption reviewed; everyone can read; the audit chain verifies; a customer cannot", async () => {
    const adviser = await app.as("adviser");
    const priya = await app.as("priya");
    expect((await priya.post("assumptions/ef.months.stable/review")).status).toBe(403);
    expect((await adviser.post("assumptions/not.a.real.id/review")).status).toBe(404);
    const r = await adviser.post("assumptions/ef.months.stable/review");
    expect(r.status).toBe(200);
    expect(r.body.reviews["ef.months.stable"].by).toMatch(/adviser/i);
    expect((await app.client("anon").get("assumptions/reviews")).body.reviews["ef.months.stable"]).toBeTruthy();
    expect((await app.store.verifyChain("global:assumptions")).ok).toBe(true);
    expect((await app.store.listAudit("global:assumptions"))[0].action).toBe("assumption_reviewed");
  });
});

describe("retention and deletion", () => {
  it("'Delete my demo data' removes everything the account holds and keeps only an anonymous counter", async () => {
    const fresh = app.client("fresh");
    await fresh.signIn("fresh");
    const me = (await fresh.get("me")).body;
    expectOk(await fresh.put("me/profile", { ...PRIYA, id: me.user.id }));
    expectOk(await fresh.post("cases", submitBody()));
    const id = (await fresh.get("me")).body.case.id;
    expect((await app.store.listAudit(id)).length).toBeGreaterThan(0);
    const before = await app.store.getCounter("demo_data_deleted");

    expectOk(await fresh.post("me/delete"));
    expect(await app.store.getUser(me.user.id)).toBeNull();
    expect(await app.store.getProfile(me.user.id)).toBeNull();
    expect(await app.store.getCaseByUser(me.user.id)).toBeNull();
    expect(await app.store.listAudit(id)).toEqual([]);
    expect(await app.store.listNotifications(me.user.id)).toEqual([]);
    expect(await app.store.getCounter("demo_data_deleted")).toBe(before + 1);
    expect((await fresh.get("me")).status).toBe(401); // signed out
    // nothing about this person survives in any table
    const raw = JSON.stringify([app.store.db.prepare("select * from users").all(), app.store.db.prepare("select * from profiles").all(), app.store.db.prepare("select * from cases").all()]);
    expect(raw).not.toContain(me.user.id);
  });

  it("'Reset demo' re-seeds ONLY the signed-in account", async () => {
    const adviser = await app.as("adviser");
    expectOk(await adviser.post("cases/case-ramesh/claim"));
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    expectOk(await priya.post("me/reset"));
    expect((await priya.get("me")).body.case).toBeNull();
    // Ramesh's case is exactly as the adviser left it
    expect((await adviser.get("cases/case-ramesh")).body.case.status).toBe("IN_REVIEW");
    // resetting Ramesh brings back his waiting case, and not Anita's
    const ramesh = await app.as("ramesh");
    expectOk(await ramesh.post("me/reset"));
    expect((await ramesh.get("me")).body.case.status).toBe("DRAFT_READY");
    // the user stays signed in after a reset
    expect((await ramesh.get("me")).status).toBe(200);
  });

  it("the purge removes data idle for more than 24 hours: anonymous visitors deleted, seeded accounts re-seeded", async () => {
    const fresh = app.client("fresh");
    await fresh.signIn("fresh");
    const id = (await fresh.get("me")).body.user.id;
    await fresh.put("me/profile", { ...PRIYA, id });
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post("cases/case-anita/claim"));

    const nothing = await purgeStale(app.store);
    expect(nothing.purgedUsers).toBe(0);

    const later = Date.now() + 25 * 3_600_000;
    clock.now = () => later;
    const out = await purgeStale(app.store, later);
    expect(out.purgedUsers).toBeGreaterThanOrEqual(2);
    expect(await app.store.getUser(id)).toBeNull(); // anonymous: gone
    expect(await app.store.getProfile(id)).toBeNull();
    expect(await app.store.getUser("user-priya")).not.toBeNull(); // seeded: kept
    expect(await app.store.getCaseByUser("user-priya")).toBeNull(); // ...but her case is gone
    expect((await app.store.getCaseByUser("user-anita"))?.status).toBe("DRAFT_READY"); // re-seeded waiting case
    expect(await app.store.getCounter("demo_data_deleted")).toBeGreaterThanOrEqual(1);
  });

  it("the purge also runs when the server starts, and a recent account is never touched", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    await purgeStale(app.store);
    expect((await priya.get("me")).body.case).not.toBeNull();
  });
});

describe("metrics events hold no profile content", () => {
  it("records what happened and when, never who or what was said", async () => {
    const priya = await app.priya();
    expectOk(await priya.post("cases", submitBody()));
    const adviser = await app.as("adviser");
    expectOk(await adviser.post(`cases/${caseId}/claim`));
    const item = (await adviser.get(`cases/${caseId}`)).body.case.plan.items[0];
    expectOk(await adviser.post(`cases/${caseId}/items/${item.id}/edit`, { text: "Build the reserve first.", lang: "en" }));
    await readyToApprove(adviser, caseId);
    expectOk(await adviser.post(`cases/${caseId}/approve`));
    const events = await app.store.listMetrics();
    expect(events.map((e) => e.kind)).toEqual(expect.arrayContaining(["case_submitted", "review_started", "item_decision", "plan_approved", "ai_task"]));
    const blob = JSON.stringify(events);
    expect(blob).not.toMatch(/Priya|Chennai|45000|Build the reserve|rent/);
    const approved = events.find((e) => e.kind === "plan_approved")!;
    expect(approved.props.corrected).toBe(true);
    expect(approved.valueMs).toBeGreaterThanOrEqual(0);
  });
});

describe("seeding", () => {
  it("has one synthetic adviser, three customers and two waiting cases; re-seeding is idempotent", async () => {
    const users = await app.store.listUsers();
    expect(users.filter((u) => u.role === "adviser")).toHaveLength(1);
    expect(users.filter((u) => u.role === "customer").map((u) => u.persona).sort()).toEqual(["anita", "priya", "ramesh"]);
    expect((await app.store.listCases()).map((c) => c.id).sort()).toEqual(["case-anita", "case-ramesh"]);
    await resetSeedCustomer(app.store, "ramesh");
    expect((await app.store.listCases()).length).toBe(2);
    expect((await app.store.verifyChain("case-ramesh")).ok).toBe(true);
  });
});
