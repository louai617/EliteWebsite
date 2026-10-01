import { apiRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/errors";
import { leadSchema } from "@/schemas/lead";
import { deleteLead, getLead, updateLead } from "@/services/leads";

/** GET /api/leads/:id */
export const GET = apiRoute({ audience: "staff" }, async ({ user, params }) => {
  const lead = await getLead(user, params.id);
  if (!lead) throw notFound("Lead");
  return lead;
});

/** PUT /api/leads/:id — full update (same validation as the CRM form). */
export const PUT = apiRoute({ audience: "staff", body: leadSchema }, ({ user, params, body }) => updateLead(user, { ...body, id: params.id }));

/** DELETE /api/leads/:id (managers). */
export const DELETE = apiRoute({ audience: "staff" }, async ({ user, params }) => {
  await deleteLead(user, params.id);
  return { deleted: true };
});
