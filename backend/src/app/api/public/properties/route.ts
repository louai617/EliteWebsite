import { z } from "zod";
import { ListingPurpose, PropertyCategory, PropertyType } from "@/generated/prisma/enums";
import { apiRoute } from "@/lib/api/handler";
import { publicOrigin } from "@/lib/env";
import { PUBLIC_SORTS, listPublicListings } from "@/services/public-listings";

const upper = (v: unknown) => (typeof v === "string" && v ? v.toUpperCase() : undefined);

const query = z.object({
  q: z.string().trim().max(100).optional(),
  purpose: z.preprocess(upper, z.enum(ListingPurpose).optional()),
  category: z.preprocess(upper, z.enum(PropertyCategory).optional()),
  type: z.preprocess(upper, z.enum(PropertyType).optional()),
  area: z.string().trim().max(120).optional(),
  beds: z.coerce.number().int().min(0).max(20).optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  featured: z.enum(["true", "false"]).optional(),
  sort: z.enum(PUBLIC_SORTS).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});

/**
 * GET /api/public/properties — published listings for the website (no login).
 * Filters: q, purpose (sale|rent), category, type, area, beds (min), priceMin, priceMax, featured; sort; page.
 */
export const GET = apiRoute({ audience: "public", query }, ({ query: q, request }) => {
  const { sort, page, pageSize, featured, ...filters } = q;
  return listPublicListings({ ...filters, featured: featured === "true" }, { page, pageSize, sort }, publicOrigin(request));
});
