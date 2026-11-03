import { apiRoute } from "@/lib/api/handler";
import { dailyReportSubmitSchema } from "@/schemas/daily";
import { submitDailyReport } from "@/services/daily";

/** POST /api/reports/daily/submit — the agent's end-of-day summary for today. */
export const POST = apiRoute({ audience: "staff", body: dailyReportSubmitSchema }, async ({ user, body }) => submitDailyReport(user, body));
