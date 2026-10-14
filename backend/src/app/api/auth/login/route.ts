import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { serializeUser } from "@/lib/api/serializers";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/schemas/user";
import { authenticate } from "@/services/auth";

const body = loginSchema.extend({
  /** For non-browser clients: also return the session token for `Authorization: Bearer`. */
  issueToken: z.boolean().optional(),
});

/**
 * POST /api/auth/login — staff and client accounts. Sets the httpOnly session cookie.
 * The response says which app the user belongs to (CRM or client portal).
 */
export const POST = apiRoute({ audience: "public", body, rateLimit: { limit: 30, windowMs: 15 * 60_000 } }, async ({ body, request }) => {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const user = await authenticate(body.email, body.password, ip);
  const session = await createSession(user.id, { setCookie: !body.issueToken });
  return { user: serializeUser(user), ...(body.issueToken ? { token: session.token, expiresAt: session.expiresAt } : {}) };
});
