import { apiRoute } from "@/lib/api/handler";
import { serializeUser } from "@/lib/api/serializers";
import { createSession } from "@/lib/auth/session";
import { registerClientSchema } from "@/schemas/portal";
import { registerClientAccount } from "@/services/client-accounts";

/**
 * POST /api/auth/register — website self-registration. Always creates a CLIENT account
 * (the role is never taken from the request) linked to a new CRM client record.
 */
export const POST = apiRoute(
  { audience: "public", body: registerClientSchema, rateLimit: { limit: 5, windowMs: 60 * 60_000 }, status: 201 },
  async ({ body }) => {
    const user = await registerClientAccount(body);
    await createSession(user.id);
    return { user: serializeUser(user) };
  },
);
