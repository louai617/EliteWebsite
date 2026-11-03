import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { uploadPropertyPhoto } from "@/services/properties";

const body = z.object({ file: z.instanceof(File, { error: "Choose a photo" }) });

/**
 * POST /api/properties/:id/photos — multipart `file` (JPG, PNG, WebP or AVIF, max 10 MB).
 * The photo is re-encoded on the server (upright, metadata and GPS removed, max 2560 px WebP,
 * 640 px thumbnail, blurred preview) and appended to the listing; the first one becomes the
 * cover. Returns the stored photo plus `lowRes` when it is under 1600 px.
 */
export const POST = apiRoute(
  { audience: "staff", multipart: true, body, status: 201, rateLimit: { limit: 300, windowMs: 10 * 60_000 } },
  ({ user, params, body }) => uploadPropertyPhoto(user, params.id, body.file),
);
