import { apiRoute } from "@/lib/api/handler";
import { unsaveHome } from "@/services/client-dashboard";

/** DELETE /api/portal/saved/:ref — remove from saved homes. */
export const DELETE = apiRoute({ audience: "client" }, ({ user, params }) => unsaveHome(user, decodeURIComponent(params.ref)));
