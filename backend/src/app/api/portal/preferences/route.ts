import { apiRoute } from "@/lib/api/handler";
import { preferencesSchema } from "@/schemas/portal";
import { getPreferences, updatePreferences } from "@/services/client-dashboard";

/** GET /api/portal/preferences — search preferences (+ area/type options). */
export const GET = apiRoute({ audience: "client" }, ({ user }) => getPreferences(user));

/** PUT /api/portal/preferences — { purpose, types[], areas[], bedrooms, budgetMin, budgetMax, requirements }. */
export const PUT = apiRoute({ audience: "client", body: preferencesSchema }, ({ user, body }) => updatePreferences(user, body));
