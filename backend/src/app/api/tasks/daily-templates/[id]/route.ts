import { apiRoute } from "@/lib/api/handler";
import { dailyTemplateSchema } from "@/schemas/daily";
import { deleteDailyTemplate, updateDailyTemplate } from "@/services/daily";

export const PUT = apiRoute({ audience: "staff", permission: "tasks.manageTemplates", body: dailyTemplateSchema }, async ({ user, params, body }) =>
  updateDailyTemplate(user, { ...body, id: params.id }),
);

/** Generated tasks are kept as history. */
export const DELETE = apiRoute({ audience: "staff", permission: "tasks.manageTemplates" }, async ({ user, params }) => {
  await deleteDailyTemplate(user, params.id);
  return { deleted: true };
});
