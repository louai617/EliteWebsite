import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PUBLIC_PREFIX, readUpload } from "@/services/storage";
import { publicWhere } from "@/services/public-listings";

/**
 * Serves uploaded property photos.
 *  - Photos of listings that are live on the public website are public (cacheable), so the
 *    website on eliterealestate.qa can show them.
 *  - Everything else (unpublished, sold, off-market listings) needs a signed-in session.
 */
async function isPublicPhoto(segments: string[]) {
  if (segments[0] !== "properties" || !segments[1]) return false;
  const url = `${PUBLIC_PREFIX}${segments.join("/")}`;
  const image = await db.propertyImage.findFirst({ where: { url, property: { id: segments[1], ...publicWhere } }, select: { id: true } });
  return Boolean(image);
}

export async function GET(_request: Request, { params }: RouteContext<"/api/uploads/[...path]">) {
  const { path } = await params;
  const isPublic = await isPublicPhoto(path);
  if (!isPublic && !(await getCurrentUser())) return new NextResponse("Unauthorized", { status: 401 });
  const file = await readUpload(path);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.buf), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": isPublic ? "public, max-age=3600, stale-while-revalidate=86400" : "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      // Allow the website (another origin) to embed published photos.
      ...(isPublic ? { "Cross-Origin-Resource-Policy": "cross-origin" } : {}),
    },
  });
}
