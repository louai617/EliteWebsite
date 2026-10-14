import { apiRoute } from "@/lib/api/handler";
import { publicOrigin } from "@/lib/env";
import { recommendations } from "@/services/client-dashboard";

/** GET /api/portal/recommendations — "Homes for you", with the reasons each home was picked. */
export const GET = apiRoute({ audience: "client" }, ({ user, request }) => recommendations(user, publicOrigin(request)));
