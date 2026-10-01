import { apiRoute } from "@/lib/api/handler";
import { serializeUser } from "@/lib/api/serializers";
import { portalAccountUpdateSchema } from "@/schemas/portal";
import { portalOverview, updatePortalAccount } from "@/services/portal";

/** GET /api/portal/account — the signed-in client's account and CRM profile. */
export const GET = apiRoute({ audience: "client" }, async ({ user, request }) => {
  const { client } = await portalOverview(user, new URL(request.url).origin);
  return { user: serializeUser(user), profile: client };
});

/** PATCH /api/portal/account — { name, phone } (e-mail changes go through the agent). */
export const PATCH = apiRoute({ audience: "client", body: portalAccountUpdateSchema }, ({ user, body }) => updatePortalAccount(user, body));
