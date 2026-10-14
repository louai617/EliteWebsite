import { apiRoute } from "@/lib/api/handler";
import { portalActivity } from "@/services/portal";

/** GET /api/portal/activity — client-safe timeline (signed-in client only, scoped to their own record). */
export const GET = apiRoute({ audience: "client" }, ({ user }) => portalActivity(user));
