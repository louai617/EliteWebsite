import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { email } from "@/schemas/common";
import { requestPasswordReset } from "@/services/password-reset";

/**
 * POST /api/auth/forgot-password — { email }. Step 1 of the reset: e-mails a 6-digit code.
 * Always answers the same way (no account enumeration).
 */
export const POST = apiRoute(
  { audience: "public", body: z.object({ email }), rateLimit: { limit: 5, windowMs: 15 * 60_000 } },
  async ({ body, request }) => {
    await requestPasswordReset(body.email, request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null);
    return { sent: true, expiresInMinutes: 10 };
  },
);
