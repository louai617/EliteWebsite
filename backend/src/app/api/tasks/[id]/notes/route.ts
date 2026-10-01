import { apiRoute } from "@/lib/api/handler";
import { requiredText } from "@/schemas/common";
import { z } from "zod";
import { addTaskNote } from "@/services/tasks";

/** POST /api/tasks/:id/notes — add a note to the task history. */
export const POST = apiRoute({ audience: "staff", body: z.object({ message: requiredText(2000, "Note") }), status: 201 }, async ({ user, params, body }) =>
  addTaskNote(user, params.id, body.message),
);
