import { apiRoute } from "@/lib/api/handler";
import { serializeUser } from "@/lib/api/serializers";

/** GET /api/auth/me — the signed-in user, or 401. */
export const GET = apiRoute({ audience: "authenticated" }, async ({ user }) => ({ user: serializeUser(user) }));
