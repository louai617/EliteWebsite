import { apiRoute } from "@/lib/api/handler";
import { dailyTemplateSchema } from "@/schemas/daily";
import { createDailyTemplate, listDailyTemplates } from "@/services/daily";

/** GET /api/tasks/daily-templates — recurring daily tasks. */
export const GET = apiRoute({ audience: "staff" }, async ({ user }) => listDailyTemplates(user));

/** POST /api/tasks/daily-templates — managers; today's tasks are generated immediately. */
export const POST = apiRoute({ audience: "staff", permission: "tasks.manageTemplates", body: dailyTemplateSchema, status: 201 }, async ({ user, body }) =>
  createDailyTemplate(user, body),
);
