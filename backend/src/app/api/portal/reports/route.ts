import { apiRoute } from "@/lib/api/handler";
import { portalReports } from "@/services/portal";

/** GET /api/portal/reports — deals and an activity summary (signed-in client only, scoped to their own record). */
export const GET = apiRoute({ audience: "client" }, ({ user }) => portalReports(user));
