import { apiRoute } from "@/lib/api/handler";
import { rangeQuery } from "@/lib/api/range-query";
import { agentPerformance } from "@/services/performance";

/** GET /api/performance/:agentId — score trend, breakdown, missed and overdue work. */
export const GET = apiRoute({ audience: "staff", query: rangeQuery }, async ({ user, params, query }) => agentPerformance(user, params.agentId, query.range));
