import { apiRoute } from "@/lib/api/handler";
import { portalProperties } from "@/services/portal";

/** GET /api/portal/properties — shortlisted / viewed / contracted listings (signed-in client only, scoped to their own record). */
export const GET = apiRoute({ audience: "client" }, ({ user, request }) => portalProperties(user, new URL(request.url).origin));
