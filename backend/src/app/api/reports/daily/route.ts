import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { businessDate } from "@/lib/business-day";
import { getDailyReport } from "@/services/daily";

const query = z.object({ agentId: z.string().max(40).optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** GET /api/reports/daily?agentId&date — one agent's report for one day, with the score explanation. */
export const GET = apiRoute({ audience: "staff", query }, async ({ user, query: q }) => getDailyReport(user, q.agentId ?? user.id, q.date ?? businessDate()));
