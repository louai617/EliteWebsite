import { apiRoute } from "@/lib/api/handler";
import { destroySession } from "@/lib/auth/session";

/** POST /api/auth/logout — ends the current session (cookie or Bearer token). */
export const POST = apiRoute({ audience: "public" }, async ({ bearerToken }) => {
  await destroySession(bearerToken);
  return { signedOut: true };
});
