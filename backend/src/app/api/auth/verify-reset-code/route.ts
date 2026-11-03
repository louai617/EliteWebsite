import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { email } from "@/schemas/common";
import { verifyResetCode } from "@/services/password-reset";

/** POST /api/auth/verify-reset-code — { email, code } → { resetToken }. Step 2 of the reset. */
export const POST = apiRoute(
  {
    audience: "public",
    body: z.object({ email, code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }),
    rateLimit: { limit: 15, windowMs: 15 * 60_000 },
  },
  ({ body }) => verifyResetCode(body.email, body.code),
);
