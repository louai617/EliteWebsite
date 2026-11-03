import { apiRoute } from "@/lib/api/handler";
import { propertyHierarchy } from "@/services/properties";

/** GET /api/properties/categories — the Residential/Commercial × Company/Private tree with counts. */
export const GET = apiRoute({ audience: "staff" }, async ({ user }) => propertyHierarchy(user));
