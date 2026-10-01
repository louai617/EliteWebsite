import { apiRoute } from "@/lib/api/handler";
import { propertyPostingSchema } from "@/schemas/work-activity";
import { recordPropertyPosting } from "@/services/work-activities";

/** POST /api/properties/:id/postings — `{ kind: "PROPERTY_POST" | "PROPERTY_REPOST", outcome? }`. */
export const POST = apiRoute({ audience: "staff", body: propertyPostingSchema.omit({ propertyId: true }), status: 201 }, async ({ user, params, body }) =>
  recordPropertyPosting(user, { ...body, propertyId: params.id }),
);
