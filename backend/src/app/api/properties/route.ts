import { z } from "zod";
import { Furnishing, ListingPurpose, PropertyCategory, PropertyStatus, PropertySubcategory, PropertyType } from "@/generated/prisma/enums";
import { apiRoute, listQuery } from "@/lib/api/handler";
import { propertySchema } from "@/schemas/property";
import { PROPERTY_SORTS, createProperty, listProperties } from "@/services/properties";

const query = listQuery.extend({
  sort: z.enum(PROPERTY_SORTS).default("updatedAt"),
  category: z.enum(PropertyCategory).optional(),
  subcategory: z.enum(PropertySubcategory).optional(),
  status: z.enum(PropertyStatus).optional(),
  purpose: z.enum(ListingPurpose).optional(),
  type: z.enum(PropertyType).optional(),
  furnishing: z.enum(Furnishing).optional(),
  area: z.string().trim().max(120).optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  beds: z.coerce.number().int().min(0).max(20).optional(),
  agentId: z.string().max(40).optional(),
});

/** GET /api/properties — filterable list (Residential/Commercial × Company/Private, status, price…). */
export const GET = apiRoute({ audience: "staff", query }, async ({ user, query: q }) => {
  const { page, pageSize, q: search, sort, dir, ...filters } = q;
  return listProperties(user, { page, pageSize, q: search, sort, dir }, filters);
});

/** POST /api/properties — create a listing. `category` defaults from `type` when omitted. */
export const POST = apiRoute({ audience: "staff", body: propertySchema, status: 201 }, async ({ user, body }) => createProperty(user, body));
