import { apiRoute } from "@/lib/api/handler";
import { portalDocumentSchema } from "@/schemas/document";
import { portalDocuments, portalUploadDocument } from "@/services/documents";

/** GET /api/portal/documents — the client's documents (QID, passport, receipts, contracts…). */
export const GET = apiRoute({ audience: "client" }, ({ user }) => portalDocuments(user));

/**
 * POST /api/portal/documents — multipart: kind, file, title?, number?, expiresAt?, reservationId?.
 * A proof of payment for a reservation moves it to "payment to verify".
 */
export const POST = apiRoute(
  { audience: "client", multipart: true, body: portalDocumentSchema, rateLimit: { limit: 20, windowMs: 10 * 60_000 }, status: 201 },
  ({ user, body }) => portalUploadDocument(user, body),
);
