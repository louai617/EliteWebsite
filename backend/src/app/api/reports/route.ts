import { apiRoute } from "@/lib/api/handler";
import { rangeQuery } from "@/lib/api/range-query";
import { reportRows, summarize } from "@/services/daily";

/**
 * GET /api/reports?preset=today|yesterday|week|month|custom&from&to&agentId
 * Daily-report rows for the range (finalized history + today's live numbers) and totals.
 * Agents only ever get their own rows.
 */
export const GET = apiRoute({ audience: "staff", query: rangeQuery }, async ({ user, query }) => {
  const rows = await reportRows(user, query.range, query.agentId);
  return { range: query.range, rows, summary: summarize(rows) };
});
