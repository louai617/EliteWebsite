import { apiRoute } from "@/lib/api/handler";
import { updateUserSchema } from "@/schemas/user";
import { getUser, updateUser } from "@/services/users";

/** GET /api/users/:id — admins/managers, or yourself. */
export const GET = apiRoute({ audience: "staff" }, ({ user, params }) => getUser(user, params.id));

/** PUT /api/users/:id — update a staff account (password optional; changes revoke sessions). */
export const PUT = apiRoute({ audience: "staff", permission: "users.manage", body: updateUserSchema.omit({ id: true }) }, ({ user, params, body }) => updateUser(user, { ...body, id: params.id }));
