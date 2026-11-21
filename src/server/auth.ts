// DEMO authentication. There are no passwords and no accounts to protect: "Continue as <persona>" just starts a
// session for a seeded demo user. The cookie is signed (HMAC) so it cannot be forged or edited, httpOnly so page
// scripts cannot read it, and SameSite=Lax. This is NOT secure authentication, and the UI says so.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { clock, nowIso, SESSION_COOKIE, SESSION_HOURS, sessionSecret } from "./config";
import type { CaseStore, SessionRec, UserRec } from "./store/types";

const b64 = (b: Buffer) => b.toString("base64url");
const sig = (data: string) => b64(createHmac("sha256", sessionSecret()).update(data).digest());

/** "<sessionId>.<expiresAtMs>.<signature>". */
export function cookieValue(sessionId: string, expiresAtMs: number): string {
  const body = `${sessionId}.${expiresAtMs}`;
  return `${body}.${sig(body)}`;
}

export function parseCookieValue(value: string | undefined): { sessionId: string; expiresAtMs: number } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [sid, exp, got] = parts;
  const want = sig(`${sid}.${exp}`);
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const expiresAtMs = Number(exp);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < clock.now()) return null;
  return { sessionId: sid, expiresAtMs };
}

export function readCookie(header: string | null, name = SESSION_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

export function setCookieHeader(value: string, maxAgeSeconds: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}
export const clearCookieHeader = (secure: boolean) => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;

export async function startSession(store: CaseStore, userId: string): Promise<{ session: SessionRec; cookie: string; maxAge: number }> {
  const created = clock.now();
  const expiresMs = created + SESSION_HOURS * 3_600_000;
  const session: SessionRec = { id: randomUUID(), userId, createdAt: new Date(created).toISOString(), expiresAt: new Date(expiresMs).toISOString() };
  await store.createSession(session);
  return { session, cookie: cookieValue(session.id, expiresMs), maxAge: SESSION_HOURS * 3600 };
}

export interface Authed {
  user: UserRec;
  session: SessionRec;
}

/** The signed-in user for this request, or null. Verifies the signature, the session row and its expiry. */
export async function authenticate(store: CaseStore, headers: Headers): Promise<Authed | null> {
  const parsed = parseCookieValue(readCookie(headers.get("cookie")));
  if (!parsed) return null;
  const session = await store.getSession(parsed.sessionId);
  if (!session || Date.parse(session.expiresAt) < clock.now()) return null;
  const user = await store.getUser(session.userId);
  if (!user) return null;
  // keep "last active" fresh (it drives the 24-hour purge), without writing on every poll
  if (clock.now() - Date.parse(user.lastActiveAt) > 60_000) {
    await store.touchUser(user.id, nowIso());
    user.lastActiveAt = nowIso();
  }
  return { user, session };
}
