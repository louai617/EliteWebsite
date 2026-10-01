import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/permissions";
import { CLIENT_PORTAL_URL } from "@/lib/env";

/** Public shape of the signed-in user (never includes password hashes or session data). */
export function serializeUser(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    clientId: user.clientId,
    /** Where the user's app lives: the staff CRM (this server) or the client portal. */
    app: isStaff(user) ? ("crm" as const) : ("portal" as const),
    portalUrl: isStaff(user) ? null : CLIENT_PORTAL_URL,
  };
}

export type ApiUser = ReturnType<typeof serializeUser>;
