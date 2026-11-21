// SQLite implementation of CaseStore, using the `node:sqlite` module that ships with Node (22.13+, no install, no
// native build). Chosen because the demo must run with `npm install && npm run dev` and nothing else.
//
// It is NOT a production choice: one file, one process, no replication, no encryption at rest. docs/PRODUCTION_GAP.md
// lists what a managed Postgres would add. The interface is async so that swap needs no change in the workflow code.
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { UserProfile } from "@/types";
import { GENESIS, hashEntry, verifyEntries } from "./audit";
import type {
  ActionRec,
  AssumptionReviewRec,
  AuditInput,
  AuditRec,
  CaseChange,
  CaseRec,
  CaseStore,
  ChainVerification,
  MetricInput,
  MetricRec,
  NewNotification,
  NotificationRec,
  PlanVersionRec,
  PurgeReport,
  SessionRec,
  UserRec,
} from "./types";

type Row = Record<string, unknown>;
const j = (v: unknown) => JSON.stringify(v);
const p = <T>(s: unknown, fallback: T): T => (typeof s === "string" ? (JSON.parse(s) as T) : fallback);
const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

const SCHEMA = `
create table if not exists users(
  id text primary key, role text not null, persona text not null, display_name text not null, language text not null,
  is_seed integer not null, created_at text not null, last_active_at text not null, consent_at text);
create unique index if not exists users_seed_persona on users(persona) where is_seed = 1;
create table if not exists sessions(id text primary key, user_id text not null, created_at text not null, expires_at text not null);
create table if not exists profiles(user_id text primary key, json text not null, updated_at text not null);
create table if not exists cases(
  id text primary key, user_id text not null, status text not null, urgent integer not null, plan_source text,
  claimed_by text, claimed_at text, plan_json text not null, plan_version integer not null,
  reviews_json text not null, checklist_json text not null, adviser_question text, user_reply text, copilot_json text,
  created_at text not null, updated_at text not null, reviewed_at text, waiting_since text not null, version integer not null);
create index if not exists cases_user on cases(user_id);
create table if not exists plan_versions(
  case_id text not null, version integer not null, plan_json text not null, source text, reason text not null, created_at text not null,
  primary key(case_id, version));
create table if not exists audit(
  chain_id text not null, seq integer not null, case_id text, actor_id text not null, actor_role text not null, actor text not null,
  request_id text not null, action text not null, before text, after text, evidence_json text not null, disclosures_json text not null,
  ts text not null, prev_hash text not null, hash text not null, primary key(chain_id, seq));
create table if not exists purge_guard(id integer primary key check(id = 1), on_ integer not null);
insert or ignore into purge_guard(id, on_) values(1, 0);
create trigger if not exists audit_no_update before update on audit begin select raise(abort, 'audit is append-only'); end;
create trigger if not exists audit_no_delete before delete on audit
  when (select on_ from purge_guard where id = 1) = 0 begin select raise(abort, 'audit is append-only'); end;
create table if not exists notifications(
  id text primary key, user_id text not null, kind text not null, case_id text, params_json text not null, created_at text not null, read_at text);
create index if not exists notif_user on notifications(user_id, created_at);
create table if not exists metrics(
  id text primary key, at text not null, kind text not null, case_id text, task text, value_ms integer, props_json text not null);
create index if not exists metrics_at on metrics(at);
create table if not exists assumption_reviews(assumption_id text primary key, by_user_id text not null, by_name text not null, on_date text not null);
create table if not exists actions(
  id text primary key, user_id text not null, finding_id text not null, severity text not null, text_key text not null, params_json text not null,
  status text not null, followup_on text, active integer not null, created_at text not null, updated_at text not null);
create unique index if not exists actions_user_finding on actions(user_id, finding_id);
create table if not exists counters(name text primary key, value integer not null);
`;

const user = (r: Row): UserRec => ({
  id: String(r.id),
  role: r.role as UserRec["role"],
  persona: String(r.persona),
  displayName: String(r.display_name),
  language: r.language as UserRec["language"],
  isSeed: r.is_seed === 1,
  createdAt: String(r.created_at),
  lastActiveAt: String(r.last_active_at),
  consentAt: s(r.consent_at),
});

const caseRec = (r: Row): CaseRec => ({
  id: String(r.id),
  userId: String(r.user_id),
  status: r.status as CaseRec["status"],
  urgent: r.urgent === 1,
  planSource: (s(r.plan_source) as CaseRec["planSource"]) ?? null,
  claimedBy: s(r.claimed_by),
  claimedAt: s(r.claimed_at),
  plan: p(r.plan_json, {} as CaseRec["plan"]),
  planVersion: Number(r.plan_version),
  reviews: p(r.reviews_json, {}),
  checklist: p(r.checklist_json, {}),
  adviserQuestion: s(r.adviser_question),
  userReply: s(r.user_reply),
  copilot: r.copilot_json ? p(r.copilot_json, null) : null,
  gen: r.gen_json ? p(r.gen_json, null) : null,
  risk: r.risk_json ? p(r.risk_json, null) : null,
  consent: r.consent_json ? p(r.consent_json, null) : null,
  acceptedAt: s(r.accepted_at),
  flagged: r.flagged === 1,
  flagNote: s(r.flag_note),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
  reviewedAt: s(r.reviewed_at),
  waitingSince: String(r.waiting_since),
  version: Number(r.version),
});

const auditRec = (r: Row): AuditRec => ({
  chainId: String(r.chain_id),
  seq: Number(r.seq),
  caseId: s(r.case_id),
  actorId: String(r.actor_id),
  actorRole: r.actor_role as AuditRec["actorRole"],
  actor: r.actor as AuditRec["actor"],
  requestId: String(r.request_id),
  action: String(r.action),
  before: s(r.before),
  after: s(r.after),
  evidenceRefs: p(r.evidence_json, []),
  disclosuresShown: p(r.disclosures_json, []),
  ts: String(r.ts),
  prevHash: String(r.prev_hash),
  hash: String(r.hash),
});

const COLS: Record<string, string> = {
  status: "status",
  urgent: "urgent",
  planSource: "plan_source",
  claimedBy: "claimed_by",
  claimedAt: "claimed_at",
  plan: "plan_json",
  planVersion: "plan_version",
  reviews: "reviews_json",
  checklist: "checklist_json",
  adviserQuestion: "adviser_question",
  userReply: "user_reply",
  copilot: "copilot_json",
  gen: "gen_json",
  risk: "risk_json",
  consent: "consent_json",
  acceptedAt: "accepted_at",
  flagged: "flagged",
  flagNote: "flag_note",
  updatedAt: "updated_at",
  reviewedAt: "reviewed_at",
  waitingSince: "waiting_since",
};
const JSON_COLS = new Set(["plan", "reviews", "checklist", "copilot", "risk", "consent", "gen"]);

export class SqliteCaseStore implements CaseStore {
  /** Exposed for tests only (to prove tampering is detected). Never used by the app. */
  readonly db: DatabaseSync;

  constructor(file: string) {
    this.db = new DatabaseSync(file);
    if (file !== ":memory:") this.db.exec("pragma journal_mode = wal; pragma synchronous = normal;");
    this.db.exec(SCHEMA);
    this.migrate();
  }

  /** Columns added after the first release of the schema. `create table if not exists` never changes an existing table. */
  private migrate() {
    const have = new Set((this.db.prepare("pragma table_info(cases)").all() as Row[]).map((r) => String(r.name)));
    const add: [string, string][] = [
      ["risk_json", "text"],
      ["consent_json", "text"],
      ["accepted_at", "text"],
      ["flagged", "integer not null default 0"],
      ["flag_note", "text"],
      ["gen_json", "text"],
    ];
    for (const [name, type] of add) if (!have.has(name)) this.db.exec(`alter table cases add column ${name} ${type}`);
  }

  private tx<T>(fn: () => T): T {
    this.db.exec("begin immediate");
    try {
      const out = fn();
      this.db.exec("commit");
      return out;
    } catch (e) {
      this.db.exec("rollback");
      throw e;
    }
  }

  // ---------- users and sessions ----------
  async getUser(id: string) {
    const r = this.db.prepare("select * from users where id = ?").get(id) as Row | undefined;
    return r ? user(r) : null;
  }
  async findUserByPersona(persona: string) {
    const r = this.db.prepare("select * from users where persona = ? and is_seed = 1").get(persona) as Row | undefined;
    return r ? user(r) : null;
  }
  async listUsers() {
    return (this.db.prepare("select * from users order by created_at").all() as Row[]).map(user);
  }
  async saveUser(u: UserRec) {
    this.db
      .prepare(
        `insert into users(id, role, persona, display_name, language, is_seed, created_at, last_active_at, consent_at) values(?,?,?,?,?,?,?,?,?)
         on conflict(id) do update set role=excluded.role, persona=excluded.persona, display_name=excluded.display_name, language=excluded.language,
         is_seed=excluded.is_seed, last_active_at=excluded.last_active_at, consent_at=excluded.consent_at`,
      )
      .run(u.id, u.role, u.persona, u.displayName, u.language, u.isSeed ? 1 : 0, u.createdAt, u.lastActiveAt, u.consentAt);
  }
  async touchUser(id: string, at: string) {
    this.db.prepare("update users set last_active_at = ? where id = ?").run(at, id);
  }
  async createSession(x: SessionRec) {
    this.db.prepare("insert into sessions(id, user_id, created_at, expires_at) values(?,?,?,?)").run(x.id, x.userId, x.createdAt, x.expiresAt);
  }
  async getSession(id: string) {
    const r = this.db.prepare("select * from sessions where id = ?").get(id) as Row | undefined;
    return r ? { id: String(r.id), userId: String(r.user_id), createdAt: String(r.created_at), expiresAt: String(r.expires_at) } : null;
  }
  async deleteSession(id: string) {
    this.db.prepare("delete from sessions where id = ?").run(id);
  }

  // ---------- profiles ----------
  async getProfile(userId: string) {
    const r = this.db.prepare("select json from profiles where user_id = ?").get(userId) as Row | undefined;
    return r ? p<UserProfile>(r.json, null as never) : null;
  }
  async putProfile(userId: string, profile: UserProfile, at: string) {
    this.db
      .prepare("insert into profiles(user_id, json, updated_at) values(?,?,?) on conflict(user_id) do update set json=excluded.json, updated_at=excluded.updated_at")
      .run(userId, j(profile), at);
  }

  // ---------- cases ----------
  async getCase(id: string) {
    const r = this.db.prepare("select * from cases where id = ?").get(id) as Row | undefined;
    return r ? caseRec(r) : null;
  }
  async getCaseByUser(userId: string) {
    const r = this.db.prepare("select * from cases where user_id = ? order by created_at desc limit 1").get(userId) as Row | undefined;
    return r ? caseRec(r) : null;
  }
  async listCases() {
    return (this.db.prepare("select * from cases").all() as Row[]).map(caseRec);
  }

  async createCase(rec: Omit<CaseRec, "version">, extras: Parameters<CaseStore["createCase"]>[1]) {
    return this.tx(() => {
      this.db
        .prepare(
          `insert into cases(id, user_id, status, urgent, plan_source, claimed_by, claimed_at, plan_json, plan_version, reviews_json, checklist_json,
           adviser_question, user_reply, copilot_json, risk_json, consent_json, accepted_at, flagged, flag_note, gen_json, created_at, updated_at, reviewed_at, waiting_since, version)
           values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
        )
        .run(
          rec.id, rec.userId, rec.status, rec.urgent ? 1 : 0, rec.planSource, rec.claimedBy, rec.claimedAt, j(rec.plan), rec.planVersion, j(rec.reviews),
          j(rec.checklist), rec.adviserQuestion, rec.userReply, rec.copilot ? j(rec.copilot) : null, rec.risk ? j(rec.risk) : null, rec.consent ? j(rec.consent) : null,
          rec.acceptedAt, rec.flagged ? 1 : 0, rec.flagNote, rec.gen ? j(rec.gen) : null, rec.createdAt, rec.updatedAt, rec.reviewedAt, rec.waitingSince,
        );
      if (extras.planVersion) this.insertPlanVersion(rec.id, rec.planVersion, extras.planVersion);
      this.writeExtras(extras);
      return { ...rec, version: 1 };
    });
  }

  private insertPlanVersion(caseId: string, version: number, v: Omit<PlanVersionRec, "caseId" | "version">) {
    this.db
      .prepare("insert into plan_versions(case_id, version, plan_json, source, reason, created_at) values(?,?,?,?,?,?)")
      .run(caseId, version, j(v.plan), v.source, v.reason, v.createdAt);
  }

  private writeExtras(x: { audit?: AuditInput[]; notifications?: NewNotification[]; metrics?: MetricInput[] }) {
    for (const a of x.audit ?? []) this.appendAuditTx(a);
    this.insertNotifications(x.notifications ?? []);
    this.insertMetrics(x.metrics ?? []);
  }

  async commit(c: CaseChange) {
    return this.tx<CaseRec | "conflict" | "not_found">(() => {
      const cur = this.db.prepare("select * from cases where id = ?").get(c.caseId) as Row | undefined;
      if (!cur) return "not_found";
      if (Number(cur.version) !== c.expectedVersion) return "conflict";
      const patch: Record<string, unknown> = { ...c.patch };
      if (c.planVersion) {
        const next = Number(cur.plan_version) + 1;
        patch.planVersion = next;
        patch.plan = c.patch.plan ?? p(cur.plan_json, null);
        this.insertPlanVersion(c.caseId, next, c.planVersion);
      }
      const keys = Object.keys(patch).filter((k) => k in COLS);
      const set = keys.map((k) => `${COLS[k]} = ?`).concat("version = version + 1");
      const vals = keys.map((k) => {
        const v = patch[k];
        if (v === undefined || v === null) return null;
        if (JSON_COLS.has(k)) return j(v);
        if (typeof v === "boolean") return v ? 1 : 0;
        return v as string | number;
      });
      this.db.prepare(`update cases set ${set.join(", ")} where id = ?`).run(...vals, c.caseId);
      this.writeExtras(c);
      return caseRec(this.db.prepare("select * from cases where id = ?").get(c.caseId) as Row);
    });
  }

  async listPlanVersions(caseId: string) {
    return (this.db.prepare("select * from plan_versions where case_id = ? order by version").all(caseId) as Row[]).map((r) => ({
      caseId: String(r.case_id),
      version: Number(r.version),
      plan: p(r.plan_json, {} as PlanVersionRec["plan"]),
      source: (s(r.source) as PlanVersionRec["source"]) ?? null,
      reason: String(r.reason),
      createdAt: String(r.created_at),
    }));
  }

  // ---------- audit ----------
  private appendAuditTx(a: AuditInput): AuditRec {
    const last = this.db.prepare("select seq, hash from audit where chain_id = ? order by seq desc limit 1").get(a.chainId) as Row | undefined;
    const base: Omit<AuditRec, "prevHash" | "hash"> = {
      chainId: a.chainId,
      seq: last ? Number(last.seq) + 1 : 1,
      caseId: a.caseId,
      actorId: a.actorId,
      actorRole: a.actorRole,
      actor: a.actor,
      requestId: a.requestId,
      action: a.action,
      before: a.before ?? null,
      after: a.after ?? null,
      evidenceRefs: a.evidenceRefs ?? [],
      disclosuresShown: a.disclosuresShown ?? [],
      ts: a.ts,
    };
    const prevHash = last ? String(last.hash) : GENESIS;
    const rec: AuditRec = { ...base, prevHash, hash: hashEntry(prevHash, base) };
    this.db
      .prepare(
        `insert into audit(chain_id, seq, case_id, actor_id, actor_role, actor, request_id, action, before, after, evidence_json, disclosures_json, ts, prev_hash, hash)
         values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(rec.chainId, rec.seq, rec.caseId, rec.actorId, rec.actorRole, rec.actor, rec.requestId, rec.action, rec.before, rec.after, j(rec.evidenceRefs), j(rec.disclosuresShown), rec.ts, rec.prevHash, rec.hash);
    return rec;
  }
  async appendAudit(input: AuditInput) {
    return this.tx(() => this.appendAuditTx(input));
  }
  async listAudit(chainId: string) {
    return (this.db.prepare("select * from audit where chain_id = ? order by seq").all(chainId) as Row[]).map(auditRec);
  }
  async listChainHeads() {
    return (
      this.db
        .prepare("select a.chain_id, a.seq, a.hash from audit a join (select chain_id, max(seq) m from audit group by chain_id) x on a.chain_id = x.chain_id and a.seq = x.m order by a.chain_id")
        .all() as Row[]
    ).map((r) => ({ chainId: String(r.chain_id), seq: Number(r.seq), hash: String(r.hash) }));
  }

  async verifyChain(chainId: string): Promise<ChainVerification> {
    return verifyEntries(await this.listAudit(chainId));
  }

  // ---------- notifications ----------
  private insertNotifications(list: NewNotification[]) {
    const st = this.db.prepare("insert into notifications(id, user_id, kind, case_id, params_json, created_at, read_at) values(?,?,?,?,?,?,null)");
    for (const n of list) st.run(randomUUID(), n.userId, n.kind, n.caseId ?? null, j(n.params ?? {}), n.createdAt);
  }
  async addNotifications(list: NewNotification[]) {
    this.tx(() => this.insertNotifications(list));
  }
  async listNotifications(userId: string, limit = 50): Promise<NotificationRec[]> {
    return (this.db.prepare("select * from notifications where user_id = ? order by created_at desc, rowid desc limit ?").all(userId, limit) as Row[]).map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      kind: String(r.kind),
      caseId: s(r.case_id),
      params: p(r.params_json, {}),
      createdAt: String(r.created_at),
      readAt: s(r.read_at),
    }));
  }
  async markRead(userId: string, ids: string[] | "all", at: string) {
    if (ids === "all") return Number(this.db.prepare("update notifications set read_at = ? where user_id = ? and read_at is null").run(at, userId).changes);
    let n = 0;
    const st = this.db.prepare("update notifications set read_at = ? where id = ? and user_id = ? and read_at is null");
    for (const id of ids) n += Number(st.run(at, id, userId).changes);
    return n;
  }
  async unreadCount(userId: string) {
    return Number((this.db.prepare("select count(*) as n from notifications where user_id = ? and read_at is null").get(userId) as Row).n);
  }

  // ---------- metrics ----------
  private insertMetrics(list: MetricInput[]) {
    const st = this.db.prepare("insert into metrics(id, at, kind, case_id, task, value_ms, props_json) values(?,?,?,?,?,?,?)");
    for (const m of list) st.run(randomUUID(), m.at, m.kind, m.caseId ?? null, m.task ?? null, m.valueMs ?? null, j(m.props ?? {}));
  }
  async addMetrics(list: MetricInput[]) {
    this.tx(() => this.insertMetrics(list));
  }
  async listMetrics(sinceIso?: string): Promise<MetricRec[]> {
    const rows = (sinceIso ? this.db.prepare("select * from metrics where at >= ? order by at").all(sinceIso) : this.db.prepare("select * from metrics order by at").all()) as Row[];
    return rows.map((r) => ({
      id: String(r.id),
      at: String(r.at),
      kind: String(r.kind),
      caseId: s(r.case_id),
      task: s(r.task),
      valueMs: r.value_ms === null ? null : Number(r.value_ms),
      props: p(r.props_json, {}),
    }));
  }

  // ---------- actions ----------
  async listActions(userId: string): Promise<ActionRec[]> {
    return (this.db.prepare("select * from actions where user_id = ? order by created_at, id").all(userId) as Row[]).map((r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      findingId: String(r.finding_id),
      severity: r.severity as ActionRec["severity"],
      textKey: String(r.text_key),
      params: p(r.params_json, {}),
      status: r.status as ActionRec["status"],
      followupOn: s(r.followup_on),
      active: r.active === 1,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));
  }
  async upsertAction(a: ActionRec) {
    this.db
      .prepare(
        `insert into actions(id, user_id, finding_id, severity, text_key, params_json, status, followup_on, active, created_at, updated_at) values(?,?,?,?,?,?,?,?,?,?,?)
         on conflict(id) do update set severity=excluded.severity, text_key=excluded.text_key, params_json=excluded.params_json, status=excluded.status,
         followup_on=excluded.followup_on, active=excluded.active, updated_at=excluded.updated_at`,
      )
      .run(a.id, a.userId, a.findingId, a.severity, a.textKey, j(a.params), a.status, a.followupOn, a.active ? 1 : 0, a.createdAt, a.updatedAt);
  }

  // ---------- assumption reviews ----------
  async listAssumptionReviews(): Promise<AssumptionReviewRec[]> {
    return (this.db.prepare("select * from assumption_reviews order by assumption_id").all() as Row[]).map((r) => ({
      assumptionId: String(r.assumption_id),
      byUserId: String(r.by_user_id),
      byName: String(r.by_name),
      on: String(r.on_date),
    }));
  }
  async upsertAssumptionReview(r: AssumptionReviewRec) {
    this.db
      .prepare("insert into assumption_reviews(assumption_id, by_user_id, by_name, on_date) values(?,?,?,?) on conflict(assumption_id) do update set by_user_id=excluded.by_user_id, by_name=excluded.by_name, on_date=excluded.on_date")
      .run(r.assumptionId, r.byUserId, r.byName, r.on);
  }

  // ---------- retention ----------
  async purgeUserData(userId: string): Promise<PurgeReport> {
    return this.tx(() => {
      const report: PurgeReport = { users: 0, cases: 0, audit: 0, notifications: 0, sessions: 0 };
      this.db.prepare("update purge_guard set on_ = 1 where id = 1").run();
      try {
        const ids = (this.db.prepare("select id from cases where user_id = ?").all(userId) as Row[]).map((r) => String(r.id));
        for (const id of ids) {
          report.audit += Number(this.db.prepare("delete from audit where chain_id = ?").run(id).changes);
          this.db.prepare("delete from plan_versions where case_id = ?").run(id);
          this.db.prepare("delete from metrics where case_id = ?").run(id);
        }
        report.cases = Number(this.db.prepare("delete from cases where user_id = ?").run(userId).changes);
        report.notifications = Number(this.db.prepare("delete from notifications where user_id = ?").run(userId).changes);
        this.db.prepare("delete from actions where user_id = ?").run(userId);
        report.audit += Number(this.db.prepare("delete from audit where chain_id = ?").run(`user:${userId}`).changes);
        this.db.prepare("delete from profiles where user_id = ?").run(userId);
      } finally {
        this.db.prepare("update purge_guard set on_ = 0 where id = 1").run();
      }
      return report;
    });
  }

  async deleteSessionsOf(userId: string) {
    return Number(this.db.prepare("delete from sessions where user_id = ?").run(userId).changes);
  }

  async purgeInactiveSince(cutoffIso: string) {
    const stale = (this.db.prepare("select id from users where role = 'customer' and last_active_at < ?").all(cutoffIso) as Row[]).map((r) => String(r.id));
    const total: PurgeReport = { users: 0, cases: 0, audit: 0, notifications: 0, sessions: 0 };
    for (const id of stale) {
      const r = await this.purgeUserData(id);
      total.sessions += await this.deleteSessionsOf(id);
      total.cases += r.cases;
      total.audit += r.audit;
      total.notifications += r.notifications;
      total.sessions += r.sessions;
    }
    total.sessions += Number(this.db.prepare("delete from sessions where created_at < ?").run(cutoffIso).changes);
    return { purgedUserIds: stale, report: total };
  }

  async deleteUser(id: string) {
    this.db.prepare("delete from users where id = ?").run(id);
  }

  async bumpCounter(name: string, by = 1) {
    this.db.prepare("insert into counters(name, value) values(?, ?) on conflict(name) do update set value = value + excluded.value").run(name, by);
    return this.getCounter(name);
  }
  async getCounter(name: string) {
    const r = this.db.prepare("select value from counters where name = ?").get(name) as Row | undefined;
    return r ? Number(r.value) : 0;
  }

  async close() {
    this.db.close();
  }
}
