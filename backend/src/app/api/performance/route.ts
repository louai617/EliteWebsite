import { apiRoute } from "@/lib/api/handler";
import { rangeQuery } from "@/lib/api/range-query";
import { performanceBoard } from "@/services/performance";

/** GET /api/performance?preset=today|week|month|custom — scores with breakdowns (team for managers, own for agents). */
export const GET = apiRoute({ audience: "staff", query: rangeQuery }, async ({ user, query }) => performanceBoard(user, query.range));
