import { z } from "zod";
import { apiRoute, clientIp } from "@/lib/api/handler";
import { LISTING_EVENTS, recordListingEvent } from "@/services/listing-stats";

const trackSchema = z.object({ event: z.enum(LISTING_EVENTS) });

/**
 * POST /api/public/properties/:ref/track — { event: "view" | "call" | "whatsapp" }.
 * Called by the website when a listing page is opened or Call / WhatsApp is pressed.
 * Anonymous; repeats from the same visitor within half an hour aren't counted.
 */
export const POST = apiRoute(
  { audience: "public", body: trackSchema, rateLimit: { key: "listing-track", limit: 120, windowMs: 60_000 } },
  async ({ body, params, request }) => ({ counted: await recordListingEvent(decodeURIComponent(params.ref), body.event, clientIp(request)) }),
);
