import { apiRoute } from "@/lib/api/handler";
import { deleteWorkActivity } from "@/services/work-activities";

/** DELETE /api/activities/:id — remove a mistaken manual entry (today only; past days are final). */
export const DELETE = apiRoute({ audience: "staff" }, async ({ user, params }) => {
  await deleteWorkActivity(user, params.id);
  return { deleted: true };
});
