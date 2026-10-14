import { apiRoute } from "@/lib/api/handler";
import { publicOrigin } from "@/lib/env";
import { saveSchema } from "@/schemas/portal";
import { listSaved, saveHome } from "@/services/client-dashboard";

/** GET /api/portal/saved — saved homes with price change since saving. */
export const GET = apiRoute({ audience: "client" }, ({ user, request }) => listSaved(user, publicOrigin(request)));

/** POST /api/portal/saved — { property: "ELT-1031" } (also visible to the agent in the CRM). */
export const POST = apiRoute({ audience: "client", body: saveSchema, rateLimit: { limit: 120, windowMs: 60 * 60_000 } }, ({ user, body }) => saveHome(user, body.property));
