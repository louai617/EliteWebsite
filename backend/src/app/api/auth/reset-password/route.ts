import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { email } from "@/schemas/common";
import { passwordRule } from "@/schemas/user";
import { resetPassword } from "@/services/password-reset";

/** POST /api/auth/reset-password — { email, token, password }. Step 3: sets the new password. */
export const POST = apiRoute(
  {
    audience: "public",
    body: z.object({ email, token: z.string().min(20).max(200), password: passwordRule }),
    rateLimit: { limit: 10, windowMs: 15 * 60_000 },
  },
  ({ body }) => resetPassword(body.email, body.token, body.password),
);
