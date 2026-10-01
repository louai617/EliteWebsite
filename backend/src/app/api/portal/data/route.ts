import { apiRoute } from "@/lib/api/handler";
import { portalDataExport } from "@/services/portal";

/** GET /api/portal/data — export of everything the client can see about themselves (JSON). */
export const GET = apiRoute({ audience: "client", rateLimit: { limit: 20, windowMs: 60 * 60_000 } }, ({ user, request }) => portalDataExport(user, new URL(request.url).origin));
