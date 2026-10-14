import { apiRoute } from "@/lib/api/handler";
import { publicLeadSchema } from "@/schemas/portal";
import { createPublicLead } from "@/services/portal";

/**
 * POST /api/public/leads — website contact/enquiry form (no account needed).
 * Rate-limited per IP; `website` is a honeypot that must stay empty.
 */
export const POST = apiRoute(
  { audience: "public", body: publicLeadSchema, status: 201, rateLimit: { limit: 5, windowMs: 15 * 60_000 } },
  async ({ body }) => (body.website ? { id: null, received: true } : createPublicLead(body)),
);
