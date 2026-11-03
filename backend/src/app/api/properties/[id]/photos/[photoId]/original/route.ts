import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { isStaff } from "@/lib/permissions";
import { openPhotoOriginal } from "@/services/properties";

/**
 * GET /api/properties/:id/photos/:photoId/original — the clean photo (no watermark) as a JPEG
 * download, for the listing's agent and managers, e.g. to upload to portals. The website only
 * ever gets the watermarked copy.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/properties/[id]/photos/[photoId]/original">) {
  const { id, photoId } = await params;
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return new NextResponse("Please sign in to the agent portal.", { status: 401 });
  try {
    const file = await openPhotoOriginal(user, id, photoId);
    if (!file) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(file.buf), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(file.buf.length),
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/[^\w.-]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "FORBIDDEN") return new NextResponse(error.message, { status: 403 });
    console.error("[photos] original download failed", error);
    return new NextResponse("Something went wrong.", { status: 500 });
  }
}
