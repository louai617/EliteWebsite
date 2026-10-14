import { apiRoute } from "@/lib/api/handler";
import { portalViewings } from "@/services/portal";

/** GET /api/portal/viewings — all viewings (signed-in client only, scoped to their own record). */
export const GET = apiRoute({ audience: "client" }, ({ user, request }) => portalViewings(user, new URL(request.url).origin));
