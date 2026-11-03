import { apiRoute } from "@/lib/api/handler";
import { createSession, revokeAllSessions } from "@/lib/auth/session";
import { changePasswordSchema } from "@/schemas/user";
import { changePassword } from "@/services/users";

/** POST /api/auth/password — change own password; signs out other devices. */
export const POST = apiRoute(
  { audience: "authenticated", body: changePasswordSchema, rateLimit: { limit: 10, windowMs: 15 * 60_000 } },
  async ({ user, body, bearerToken }) => {
    await changePassword(user, body);
    await revokeAllSessions(user.id);
    const session = await createSession(user.id, { setCookie: !bearerToken });
    return { changed: true, ...(bearerToken ? { token: session.token } : {}) };
  },
);
