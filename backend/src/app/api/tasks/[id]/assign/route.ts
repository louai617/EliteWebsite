import { apiRoute } from "@/lib/api/handler";
import { reassignTaskSchema } from "@/schemas/task";
import { reassignTask } from "@/services/tasks";

/** POST /api/tasks/:id/assign — managers/admins reassign (or unassign with assigneeId: null). */
export const POST = apiRoute({ audience: "staff", permission: "tasks.assign", body: reassignTaskSchema.omit({ id: true }) }, async ({ user, params, body }) =>
  reassignTask(user, { ...body, id: params.id }),
);
