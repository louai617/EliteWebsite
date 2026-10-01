import { apiRoute } from "@/lib/api/handler";
import { portalOverview } from "@/services/portal";

/** GET /api/portal/overview — dashboard summary, assigned agent and upcoming viewings (signed-in client only, scoped to their own record). */
export const GET = apiRoute({ audience: "client" }, ({ user, request }) => portalOverview(user, new URL(request.url).origin));
