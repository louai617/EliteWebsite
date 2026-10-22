import { apiRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/errors";
import { clientSchema } from "@/schemas/client";
import { deleteClient, getClient, updateClient } from "@/services/clients";

/** GET /api/clients/:id */
export const GET = apiRoute({ audience: "staff" }, async ({ user, params }) => {
  const client = await getClient(user, params.id);
  if (!client) throw notFound("Client");
  return client;
});

/** PUT /api/clients/:id — full update. */
export const PUT = apiRoute({ audience: "staff", body: clientSchema }, ({ user, params, body }) => updateClient(user, { ...body, id: params.id }));

/** DELETE /api/clients/:id (managers; blocked when deals exist). */
export const DELETE = apiRoute({ audience: "staff" }, async ({ user, params }) => {
  await deleteClient(user, params.id);
  return { deleted: true };
});
