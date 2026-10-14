import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { email } from "@/schemas/common";
import { passwordRule } from "@/schemas/user";
import { grantPortalAccess, portalAccessFor, revokePortalAccess } from "@/services/client-accounts";

/** GET /api/clients/:id/portal-access — the client's portal login (if any). */
export const GET = apiRoute({ audience: "staff", permission: "clients.managePortal" }, async ({ params }) => ({ account: await portalAccessFor(params.id) }));

/** POST /api/clients/:id/portal-access — { email, password }: grant or re-enable portal access. */
export const POST = apiRoute(
  { audience: "staff", permission: "clients.managePortal", body: z.object({ email, password: passwordRule }) },
  ({ user, params, body }) => grantPortalAccess(user, { clientId: params.id, ...body }),
);

/** DELETE /api/clients/:id/portal-access — revoke (signs the client out everywhere). */
export const DELETE = apiRoute({ audience: "staff", permission: "clients.managePortal" }, ({ user, params }) => revokePortalAccess(user, params.id));
