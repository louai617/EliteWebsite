import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { email } from "@/schemas/common";
import { requestPasswordReset } from "@/services/client-accounts";

/**
 * POST /api/auth/forgot-password — { email }. Always answers the same way (no account
 * enumeration); if an active account exists, the team gets a task to reset it.
 */
export const POST = apiRoute(
  { audience: "public", body: z.object({ email }), rateLimit: { limit: 5, windowMs: 15 * 60_000 } },
  async ({ body }) => {
    await requestPasswordReset(body.email);
    return { received: true };
  },
);
