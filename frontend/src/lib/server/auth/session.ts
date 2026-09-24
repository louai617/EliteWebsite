import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import type mongoose from 'mongoose';
import { STAFF_ROLES, type Role } from '@/lib/shared/constants';
import {
  effectivePermissions,
  type Permission,
  type Resource,
} from '@/lib/shared/permissions';
import { User, USER_PUBLIC_FIELDS, type UserDoc } from '../models';
import { forbidden, unauthorized } from '../http';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
} from './token';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScopeFilter = Record<string, any>;

export interface Auth {
  id: mongoose.Types.ObjectId;
  role: Role;
  user: UserDoc;
  permissions: Set<Permission>;
  can(permission: Permission): boolean;
  /** Throws 403 unless the user has the permission. */
  require(permission: Permission): void;
  /** Mongo filter limiting reads of `resource` to what this user may see. */
  readScope(resource: Resource): ScopeFilter;
  /** Mongo filter limiting edits/deletes of `resource` to what this user may change. */
  writeScope(resource: Resource): ScopeFilter;
}

function buildAuth(user: UserDoc): Auth {
  const permissions = effectivePermissions({
    role: user.role as Role,
    permissions: user.permissions as string[] | undefined,
    revoked_permissions: user.revoked_permissions as string[] | undefined,
  });
  const can = (permission: Permission) => permissions.has(permission);
  return {
    id: user._id,
    role: user.role as Role,
    user,
    permissions,
    can,
    require(permission) {
      if (!can(permission)) throw forbidden();
    },
    readScope(resource) {
      if (can(`${resource}.read_all`)) return {};
      if (can(`${resource}.read`)) return { assigned_agent: user._id };
      throw forbidden();
    },
    writeScope(resource) {
      if (can(`${resource}.update_all`)) return {};
      if (can(`${resource}.update`)) return { assigned_agent: user._id };
      throw forbidden();
    },
  };
}

/** Resolve the signed-in user from the session cookie, re-checking the database every time. */
export async function getAuth(request: NextRequest): Promise<Auth | null> {
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const user = await User.findById(claims.sub)
    .select(`${USER_PUBLIC_FIELDS} token_version`)
    .lean<UserDoc & { token_version?: number }>();

  // Deactivated users and revoked sessions (password changed, forced sign-out) are rejected.
  if (!user || !user.is_active || (user.token_version ?? 0) !== claims.tv) return null;
  delete (user as { token_version?: number }).token_version;
  return buildAuth(user);
}

export async function requireAuth(request: NextRequest): Promise<Auth> {
  const auth = await getAuth(request);
  if (!auth) throw unauthorized();
  return auth;
}

/** Signed in AND a CRM role (admin, manager, broker, staff). */
export async function requireStaff(request: NextRequest): Promise<Auth> {
  const auth = await requireAuth(request);
  if (!STAFF_ROLES.includes(auth.role)) throw forbidden('This area is for ELITE staff only.');
  return auth;
}

export async function setSessionCookie(
  response: NextResponse,
  user: { _id: mongoose.Types.ObjectId; role: string; token_version?: number | null }
) {
  const token = await signSessionToken({
    sub: String(user._id),
    role: user.role as Role,
    tv: user.token_version ?? 0,
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0));
}

/** The shape of "who am I" sent to the browser — no secrets, effective permissions included. */
export function serializeSessionUser(user: UserDoc) {
  const permissions = effectivePermissions({
    role: user.role as Role,
    permissions: user.permissions as string[] | undefined,
    revoked_permissions: user.revoked_permissions as string[] | undefined,
  });
  return {
    id: String(user._id),
    full_name: user.full_name,
    email: user.email,
    phone: user.phone ?? null,
    photo: user.photo ?? null,
    role: user.role as Role,
    title_en: user.title_en ?? null,
    permissions: [...permissions],
  };
}

export type SessionUser = ReturnType<typeof serializeSessionUser>;
