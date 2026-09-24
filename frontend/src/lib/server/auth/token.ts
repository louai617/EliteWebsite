/**
 * Session token signing/verification.
 *
 * Kept free of `server-only`, Mongoose and `next/headers` so the proxy
 * (`src/proxy.ts`) can verify tokens too. It is still server code: it reads
 * AUTH_SECRET, which has no NEXT_PUBLIC_ prefix and is never sent to browsers.
 */
import { jwtVerify, SignJWT } from 'jose';
import type { Role } from '@/lib/shared/constants';

export const SESSION_COOKIE = 'elite_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionClaims {
  sub: string;
  role: Role;
  /** token_version at sign-in; a mismatch means the session was revoked. */
  tv: number;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to at least 32 characters (see .env.example).');
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, tv: claims.tv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setIssuer('elite-crm')
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
      issuer: 'elite-crm',
    });
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null;
    return { sub: payload.sub, role: payload.role as Role, tv: Number(payload.tv ?? 0) };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
