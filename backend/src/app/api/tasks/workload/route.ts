import { apiRoute } from "@/lib/api/handler";
import { teamWorkload } from "@/services/tasks";

/** GET /api/tasks/workload — per-agent open / overdue / due today / completed counts (managers). */
export const GET = apiRoute({ audience: "staff", permission: "tasks.viewTeam" }, async ({ user }) => teamWorkload(user));
