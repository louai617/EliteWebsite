import { z } from "zod";
import { MediaKind } from "@/generated/prisma/enums";
import { id, optionalText } from "./common";

/** Add a video / 360° tour / floor plan / brochure by link. */
export const mediaLinkSchema = z.object({
  propertyId: id,
  kind: z.enum(MediaKind, { error: "Choose the media type" }),
  url: z.string({ error: "Paste a link" }).trim().url("Paste a full link starting with https://").max(1000),
  title: optionalText(120),
});

/** Query string of the streaming upload endpoint (the body is the raw file). */
export const mediaUploadQuery = z.object({
  kind: z.enum(["VIDEO", "FLOOR_PLAN", "BROCHURE"], { error: "Videos, floor plans and brochures can be uploaded; add 360° tours as a link" }),
  title: optionalText(120),
});
