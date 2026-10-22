import { apiRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/errors";
import { publicOrigin } from "@/lib/env";
import { getPublicListing } from "@/services/public-listings";

/** GET /api/public/properties/:ref — one published listing (by reference, e.g. ELT-1031) with agent, market data and similar homes. */
export const GET = apiRoute({ audience: "public" }, async ({ params, request }) => {
  const listing = await getPublicListing(decodeURIComponent(params.ref), publicOrigin(request));
  if (!listing) throw notFound("Listing");
  return listing;
});
