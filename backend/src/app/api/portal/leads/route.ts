import { apiRoute } from "@/lib/api/handler";
import { portalLeads } from "@/services/portal";

/** GET /api/portal/leads — the client's enquiries with their stage (signed-in client only, scoped to their own record). */
export const GET = apiRoute({ audience: "client" }, ({ user }) => portalLeads(user));
