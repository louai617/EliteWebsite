import { apiRoute } from "@/lib/api/handler";
import { portalTasks } from "@/services/portal";

/** GET /api/portal/tasks — tasks staff shared with the client (signed-in client only, scoped to their own record). */
export const GET = apiRoute({ audience: "client" }, ({ user }) => portalTasks(user));
