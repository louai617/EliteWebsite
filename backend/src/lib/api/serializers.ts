import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/permissions";

/** Public shape of the signed-in user (never includes password hashes or session data). */
export function serializeUser(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    clientId: user.clientId,
    /** Only staff accounts can sign in; they use the agent app (this server). */
    app: isStaff(user) ? ("crm" as const) : null,
  };
}

export type ApiUser = ReturnType<typeof serializeUser>;
