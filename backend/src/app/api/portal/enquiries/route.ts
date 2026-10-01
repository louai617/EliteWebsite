import { apiRoute } from "@/lib/api/handler";
import { portalEnquirySchema } from "@/schemas/portal";
import { createPortalEnquiry } from "@/services/portal";

/** POST /api/portal/enquiries — { message, propertyId? } → a lead for the client's agent. */
export const POST = apiRoute(
  { audience: "client", body: portalEnquirySchema, status: 201, rateLimit: { limit: 10, windowMs: 60 * 60_000 } },
  ({ user, body }) => createPortalEnquiry(user, body),
);
