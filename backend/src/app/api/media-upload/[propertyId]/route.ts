import { getCurrentUser } from "@/lib/auth/session";
import { apiError, apiOk } from "@/lib/api/response";
import { forbidden, toPublicError, unauthorized } from "@/lib/errors";
import { isStaff } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { zodFieldErrors } from "@/lib/action";
import { isSelfOrigin } from "@/lib/cors";
import { mediaUploadQuery } from "@/schemas/media";
import { uploadMedia } from "@/services/property-media";

/**
 * POST /api/media-upload/:propertyId?kind=VIDEO|FLOOR_PLAN|BROCHURE&title=…
 * The request body is the raw file (not multipart), streamed straight to disk — videos up to
 * 200 MB never sit in memory. This path is excluded from the proxy (src/proxy.ts) so the body
 * isn't buffered there either. Staff session + same-origin only (the agent app's media panel).
 */
export async function POST(request: Request, { params }: RouteContext<"/api/media-upload/[propertyId]">) {
  try {
    const origin = request.headers.get("origin");
    if (origin && !isSelfOrigin(request, origin)) throw forbidden("Cross-origin upload blocked.");
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    if (!isStaff(user)) throw forbidden();
    const limited = rateLimit(`media-upload:${user.id}`, 30, 10 * 60_000);
    if (!limited.ok) return apiError("RATE_LIMITED", "Too many uploads. Try again in a few minutes.");
    const url = new URL(request.url);
    const query = mediaUploadQuery.safeParse(Object.fromEntries(url.searchParams));
    if (!query.success) return apiError("VALIDATION", query.error.issues[0]?.message ?? "Invalid upload.", zodFieldErrors(query.error));
    const { propertyId } = await params;
    const media = await uploadMedia(user, propertyId, query.data.kind, query.data.title, request.body);
    return apiOk(media, 201);
  } catch (error) {
    const { code, message, fieldErrors } = toPublicError(error);
    return apiError(code, message, fieldErrors);
  }
}
