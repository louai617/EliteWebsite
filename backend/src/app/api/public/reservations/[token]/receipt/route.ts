import { apiRoute } from "@/lib/api/handler";
import { notFound } from "@/lib/errors";
import { receiptUploadSchema, reservationToken } from "@/schemas/website";
import { uploadReceipt } from "@/services/reservations";

/**
 * POST /api/public/reservations/:token/receipt — multipart `file` (PDF / JPG / PNG / WebP, max 10 MB).
 * Stored privately; only staff can open it. The reservation moves to "payment to verify".
 */
export const POST = apiRoute(
  { audience: "public", multipart: true, body: receiptUploadSchema, status: 201, rateLimit: { limit: 10, windowMs: 60 * 60_000 } },
  ({ params, body }) => {
    const token = reservationToken.safeParse(params.token);
    if (!token.success) throw notFound("Reservation");
    return uploadReceipt(token.data, body.file);
  },
);
