import { apiRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/errors";
import { zodFieldErrors } from "@/lib/action";
import { apiError } from "@/lib/api/response";
import { patchPropertySchema, updatePropertySchema } from "@/schemas/property";
import { deleteProperty, getProperty, getPropertyForEdit, updateProperty } from "@/services/properties";

/** GET /api/properties/:id */
export const GET = apiRoute({ audience: "staff" }, async ({ user, params }) => {
  const property = await getProperty(user, params.id);
  if (!property) throw notFound("Property");
  return property;
});

/** PATCH /api/properties/:id — partial update; the merged record is re-validated in full. */
export const PATCH = apiRoute({ audience: "staff", body: patchPropertySchema.omit({ id: true }) }, async ({ user, params, body }) => {
  const current = await getPropertyForEdit(user, params.id);
  if (!current) throw notFound("Property");
  const parsed = updatePropertySchema.safeParse({ ...current, ...body, id: params.id });
  if (!parsed.success) return apiError("VALIDATION", "Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  return updateProperty(user, parsed.data);
});

/** DELETE /api/properties/:id (managers; blocked when deals exist). */
export const DELETE = apiRoute({ audience: "staff" }, async ({ user, params }) => {
  await deleteProperty(user, params.id);
  return { deleted: true };
});
