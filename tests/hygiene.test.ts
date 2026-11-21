// Security, privacy and dependency hygiene: redaction of what people type, an audit digest that makes a rewritten chain
// visible, a start-up warning where the embedded store is the wrong choice, and a migration map for a real database.
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "@/lib/ai/run";
import type { LLM } from "@/lib/ai/providers";
import { PRIYA } from "@/data/personas";
import { redact, redactWithCounts } from "@/lib/redact";
import { checkDigest, currentDigest, exportDailyDigest } from "@/server/auditDigest";
import { hostWarnings } from "@/server/config";
import { setStoreForTests } from "@/server/store";
import { en, hi, ta } from "./helpers";
import { makeApp, submitBody } from "./server-helpers";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");

describe("redaction of free text before anything is sent", () => {
  const cases: [string, string, string][] = [
    ["a PAN", "My PAN is ABCDE1234F, please check", "[pan]"],
    ["an Aadhaar-shaped number", "Aadhaar 1234 5678 9012 is linked", "[number]"],
    ["a phone number", "call me on +91 98765 43210 today", "[number]"],
    ["a long account number", "transfer to 123456789012 now", "[number]"],
    ["a short labelled account number", "A/c no. 123456 at the branch", "[number]"],
    ["a UPI handle", "pay ravi.k87@okaxis now", "[upi-id"],
    ["an email", "write to someone.name@example.com", "[email]"],
    ["an IFSC code", "branch code HDFC0001234 is on the passbook", "[ifsc]"],
    ["an OTP typed into the message", "my OTP is 482913, do not share", "[code]"],
    ["a PIN typed into the message", "UPI PIN: 4821 was used", "[code]"],
    ["a link query string", "open https://pay.example.in/go?id=12345&token=abc", "?[query]"],
    ["a link without a scheme", "open pay.example.in/go?id=12345&token=abc", "?[query]"],
  ];
  for (const [label, text, marker] of cases) {
    it(`hides ${label}`, () => {
      const out = redact(text);
      expect(out, label).toContain(marker);
      for (const secret of ["ABCDE1234F", "1234 5678 9012", "98765 43210", "123456789012", "123456", "ravi.k87", "someone.name", "HDFC0001234", "482913", "4821", "id=12345", "token=abc"]) {
        if (text.includes(secret)) expect(out, `${label}: ${secret}`).not.toContain(secret);
      }
    });
  }

  it("also hides numbers written in Hindi and Tamil digits, and leaves the other digits of the text alone", () => {
    const out = redact("खाता ९८७६५४३२१०१२ और ब्याज १०% सालाना");
    expect(out).toContain("[number]");
    expect(out).toContain("१०%"); // an ordinary figure keeps its own digits
    expect(redact("my OTP is ४८२९१३ and the rate is ௧௦%")).toContain("௧௦%");
  });

  it("does not touch ordinary amounts and percentages", () => {
    const t = "A SIP of Rs 5,000 at 12% for 10 years, about 1,20,000 in total";
    expect(redact(t)).toBe(t);
  });

  it("is honest about names: only a greeting pattern is caught, a bare name is NOT removed", () => {
    expect(redact("Dear Ramesh Kumar, your plan is ready")).toContain("[name]");
    // a name in the middle of a sentence is not found. The notices say so, and nothing claims otherwise.
    expect(redact("The plan we made for Ramesh Kumar is ready")).toContain("Ramesh Kumar");
  });

  it("counts what it hid, never what it was", () => {
    const r = redactWithCounts("PAN ABCDE1234F, OTP is 482913, HDFC0001234, A/c 123456");
    expect(r.counts).toMatchObject({ pan: 1, code: 1, ifsc: 1, number: 1 });
    expect(JSON.stringify(r.counts)).not.toMatch(/ABCDE|482913|HDFC0|123456/);
  });
});

describe("a question typed to the assistant is redacted before a model sees it", () => {
  it("the prompt that reaches the model holds no account number, PAN or OTP from the question", async () => {
    let seen = "";
    const spy: LLM = {
      name: "anthropic",
      generate: async (_system, user) => {
        seen = user;
        return JSON.stringify({ answer: "Here is a general answer.", refused: false });
      },
    };
    await runTask({ task: "answerQuestion", language: "en", profile: PRIYA, question: "Is my money safe at account 123456789012? my PAN is ABCDE1234F and OTP is 482913" }, { llm: spy });
    expect(seen).toContain("question");
    for (const secret of ["123456789012", "ABCDE1234F", "482913"]) expect(seen, secret).not.toContain(secret);
    expect(seen).toContain("[number]");
  });

  it("the same for a pasted message", async () => {
    let seen = "";
    const spy: LLM = { name: "anthropic", generate: async (_s, user) => ((seen = user), "{}") };
    await runTask({ task: "secondOpinion", language: "en", text: "Send Rs 5,000 to ravi.k87@okaxis, my number 9876543210" }, { llm: spy });
    expect(seen).not.toContain("9876543210");
    expect(seen).not.toContain("ravi.k87");
  });
});

describe("a plain notice sits before every place free text can reach a model", () => {
  it("says do not type names, account numbers or ID numbers, in every language, and that names cannot be removed reliably", () => {
    for (const d of [en, hi, ta] as Record<string, string>[]) {
      expect(d["ask.privacy"]?.length).toBeGreaterThan(40);
      expect(d["check.privacy"]?.length).toBeGreaterThan(40);
    }
    expect(en["ask.privacy"]).toMatch(/Do not type names, account numbers or ID numbers/);
    expect(en["check.privacy"]).toMatch(/Do not paste or type names, account numbers or ID numbers/);
    expect(en["ask.privacy"]).toMatch(/cannot be removed reliably/);
    expect(en["check.privacy"]).toMatch(/cannot be removed reliably/);
  });
  it("the notice is on the Ask box and on the message checker", () => {
    expect(read("src/components/Ask.tsx")).toMatch(/data-testid="ask-privacy"[\s\S]{0,160}ask\.privacy/);
    expect(read("src/app/second-opinion/page.tsx")).toContain("check.privacy");
  });
});

describe("audit digest: a rewritten chain becomes visible, a purged one does not look like tampering", () => {
  let app: Awaited<ReturnType<typeof makeApp>>;
  let dir: string;
  beforeEach(async () => {
    app = await makeApp();
    dir = mkdtempSync(path.join(tmpdir(), "digest-"));
    process.env.DATA_DIR = dir;
    const priya = await app.priya();
    await priya.post("cases", submitBody());
  });
  afterEach(() => {
    delete process.env.DATA_DIR;
    setStoreForTests(null);
    rmSync(dir, { recursive: true, force: true });
  });
  const T = "2026-03-01T10:00:00.000Z";

  it("is the same for the same chains, and changes when an entry is appended", async () => {
    const a = await currentDigest(app.store, T);
    expect((await currentDigest(app.store, T)).digest).toBe(a.digest);
    expect(a.chains).toBeGreaterThan(0);
    await app.store.appendAudit({ chainId: "case-priya", caseId: "case-priya", actorId: "x", actorRole: "system", actor: "system", requestId: "r", action: "later", ts: T });
    expect((await currentDigest(app.store, T)).digest).not.toBe(a.digest);
  });

  it("exports once per day and never overwrites an earlier file", async () => {
    const first = await exportDailyDigest(app.store, T, dir);
    expect(first.created).toBe(true);
    await app.store.appendAudit({ chainId: "case-priya", caseId: "case-priya", actorId: "x", actorRole: "system", actor: "system", requestId: "r", action: "later", ts: T });
    const second = await exportDailyDigest(app.store, "2026-03-01T22:00:00.000Z", dir);
    expect(second.created).toBe(false);
    expect(second.doc.digest).toBe(first.doc.digest); // the day's anchor did not move
    expect(readdirSync(dir)).toEqual(["audit-digest-2026-03-01.json"]);
    expect(JSON.parse(readFileSync(path.join(dir, "audit-digest-2026-03-01.json"), "utf8")).note).toMatch(/not an anchor/);
  });

  it("still matches after the chains grow (they are append-only)", async () => {
    const { doc } = await exportDailyDigest(app.store, T, dir);
    await app.store.appendAudit({ chainId: "case-priya", caseId: "case-priya", actorId: "x", actorRole: "system", actor: "system", requestId: "r", action: "later", ts: T });
    expect(await checkDigest(app.store, doc)).toMatchObject({ ok: true, mismatched: [], missing: [] });
  });

  it("catches a chain that was rewritten WITH ALL ITS HASHES RECOMPUTED, which verification alone cannot", async () => {
    const { doc } = await exportDailyDigest(app.store, T, dir);
    const before = await app.store.listAudit("case-priya");
    // someone with full database access removes the chain and writes a different history with valid hashes
    app.store.db.exec("update purge_guard set on_ = 1");
    app.store.db.exec("delete from audit where chain_id = 'case-priya'");
    app.store.db.exec("update purge_guard set on_ = 0");
    for (const e of before) await app.store.appendAudit({ chainId: e.chainId, caseId: e.caseId, actorId: e.actorId, actorRole: e.actorRole, actor: e.actor, requestId: e.requestId, action: e.action, before: e.before, after: e.seq === 2 ? "a quietly different story" : e.after, ts: e.ts });
    expect((await app.store.verifyChain("case-priya")).ok).toBe(true); // the chain is internally consistent again...
    const check = await checkDigest(app.store, doc);
    expect(check.ok).toBe(false); // ...but it no longer matches what was written down
    expect(check.mismatched).toContain("case-priya");
  });

  it("calls a missing chain 'missing' (the demo purges chains), not tampering", async () => {
    const { doc } = await exportDailyDigest(app.store, T, dir);
    await app.store.purgeUserData("user-priya");
    const check = await checkDigest(app.store, doc);
    expect(check.mismatched).toEqual([]);
    expect(check.missing).toContain("case-priya");
  });

  it("a tampered digest FILE is detected too", async () => {
    const { doc } = await exportDailyDigest(app.store, T, dir);
    const bad = { ...doc, heads: doc.heads.slice(1) };
    expect((await checkDigest(app.store, bad)).mismatched).toContain("(the digest file itself)");
  });

  it("is visible to an adviser, exportable, and hidden from a customer; it holds hashes and chain ids only", async () => {
    const adviser = await app.as("adviser");
    const g = await adviser.get("audit/digest");
    expect(g.status).toBe(200);
    expect(g.body.current.digest).toMatch(/^[0-9a-f]{64}$/);
    expect((await adviser.post("audit/digest/export", {})).body).toMatchObject({ created: true });
    expect((await adviser.post("audit/digest/export", {})).body).toMatchObject({ created: false });
    expect((await adviser.get("audit/digest")).body.latestExport.check.ok).toBe(true);
    expect(JSON.stringify(g.body)).not.toMatch(/Priya|Chennai|45000|brentb/);
    const customer = await app.as("priya");
    expect((await customer.get("audit/digest")).status).toBe(403);
    expect((await customer.post("audit/digest/export", {})).status).toBe(403);
    expect((await app.client("anon").get("audit/digest")).status).toBe(401);
  });
});

describe("a warning where the embedded store is the wrong choice", () => {
  it("notices serverless and managed platforms", () => {
    for (const env of [{ VERCEL: "1" }, { AWS_LAMBDA_FUNCTION_NAME: "f" }, { NETLIFY: "true" }, { K_SERVICE: "svc" }, { WEBSITE_INSTANCE_ID: "x" }]) {
      expect(hostWarnings(env).join(" "), JSON.stringify(env)).toMatch(/serverless|managed platform/);
    }
  });
  it("notices more than one instance", () => {
    for (const env of [{ WEB_CONCURRENCY: "4" }, { NODE_APP_INSTANCE: "1" }, { pm_id: "0" }]) expect(hostWarnings(env).join(" ")).toMatch(/more than one instance/);
  });
  it("says nothing on a plain single process", () => {
    expect(hostWarnings({})).toEqual([]);
    expect(hostWarnings({ WEB_CONCURRENCY: "1" })).toEqual([]);
  });
  it("is raised at start-up and points at the migration notes", () => {
    const src = read("src/instrumentation.ts");
    expect(src).toContain("hostWarnings");
    expect(src).toContain("docs/POSTGRES_MIGRATION.md");
  });
});

describe("docs/POSTGRES_MIGRATION.md maps every CaseStore method", () => {
  it("lists each method of the interface, and says nothing was implemented", () => {
    const iface = read("src/server/store/types.ts");
    const body = iface.slice(iface.indexOf("export interface CaseStore"));
    const methods = [...body.matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]);
    expect(methods.length).toBeGreaterThan(30);
    const doc = read("docs/POSTGRES_MIGRATION.md");
    for (const m of methods) expect(doc, m).toContain(`\`${m}\``);
    expect(doc).toMatch(/not implemented/i);
  });
});
