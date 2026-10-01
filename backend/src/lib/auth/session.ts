import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { isStaff } from "@/lib/permissions";
import { CLIENT_PORTAL_URL } from "@/lib/env";
import { SESSION_COOKIE, SESSION_RENEW_WHEN_LEFT_MS, SESSION_TTL_MS } from "./constants";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  /** CLIENT accounts: the linked CRM client. */
  clientId: string | null;
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (≥ 16 chars).");
    return "dev-only-insecure-session-secret";
  }
  return value;
}

/** Only an HMAC of the token is stored, so the sessions table alone cannot be replayed. */
function hashToken(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

/**
 * Cookie policy. Lax works when the client app and the API share a registrable domain
 * (localhost:3001 → localhost:3002, or www.elite.qa → api.elite.qa). Set
 * SESSION_COOKIE_SAMESITE=none (HTTPS only) if they are on unrelated domains.
 */
function cookieOptions(expires: Date) {
  const sameSite = (process.env.SESSION_COOKIE_SAMESITE ?? "lax").toLowerCase() as "lax" | "strict" | "none";
  return {
    httpOnly: true,
    sameSite,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    path: "/",
    expires,
    ...(process.env.SESSION_COOKIE_DOMAIN ? { domain: process.env.SESSION_COOKIE_DOMAIN } : {}),
  };
}

async function writeCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/**
 * Call from a Server Action / Route Handler only (sets a cookie). Returns the raw token so
 * API clients that cannot use cookies can send it as `Authorization: Bearer <token>`.
 */
export async function createSession(userId: string, { setCookie = true }: { setCookie?: boolean } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 250) ?? null;
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt, userAgent } });
  if (setCookie) await writeCookie(token, expiresAt);
  return { token, expiresAt };
}

/** Call from a Server Action / Route Handler only (clears a cookie). */
export async function destroySession(bearerToken?: string | null) {
  const store = await cookies();
  const token = bearerToken ?? store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  const { expires: _expires, ...opts } = cookieOptions(new Date(0));
  store.delete({ name: SESSION_COOKIE, ...opts });
}

export { revokeAllSessions } from "./session-store";

/**
 * Resolves the signed-in user for this request (memoised per request with React `cache`).
 * Returns null for missing, expired or revoked sessions and for deactivated users.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(token, { refreshCookie: true });
});

/** Looks up a raw session token (cookie value or Bearer token). */
export async function resolveSession(token: string, { refreshCookie = false } = {}): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, clientId: true, isActive: true } },
    },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !session.user.isActive) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Sliding expiry: extend the DB row when close to expiring. The cookie is refreshed on the
  // next Server Action (cookies can't be written during a page render).
  if (session.expiresAt.getTime() - now < SESSION_RENEW_WHEN_LEFT_MS) {
    const expiresAt = new Date(now + SESSION_TTL_MS);
    await db.session.update({ where: { id: session.id }, data: { expiresAt } }).catch(() => undefined);
    if (refreshCookie) {
      try {
        await writeCookie(token, expiresAt);
      } catch {
        // Rendering context — cookie will be refreshed by a later action.
      }
    }
  }

  const { isActive: _isActive, ...user } = session.user;
  return user;
}

/**
 * For CRM pages and layouts: redirect to /login when signed out, and send client-portal
 * accounts to the portal — they never see CRM pages.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isStaff(user)) redirect(CLIENT_PORTAL_URL);
  return user;
}
