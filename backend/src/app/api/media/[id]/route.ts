import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/permissions";
import { publicWhere } from "@/services/public-listings";
import { openMediaFile } from "@/services/storage";

/**
 * GET /api/media/:id — an uploaded video / floor plan / brochure.
 *  - Public (cacheable, embeddable by the website) while the listing is live on the website.
 *  - Otherwise staff only.
 * Supports HTTP Range requests so browsers can seek in videos.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/media/[id]">) {
  const { id } = await params;
  const media = await db.propertyMedia.findUnique({ where: { id }, select: { storageKey: true, mimeType: true, title: true, propertyId: true } });
  if (!media?.storageKey || !media.mimeType) return new NextResponse("Not found", { status: 404 });
  const isPublic = (await db.property.count({ where: { id: media.propertyId, ...publicWhere } })) > 0;
  if (!isPublic) {
    const user = await getCurrentUser();
    if (!user || !isStaff(user)) return new NextResponse("Not found", { status: 404 });
  }
  const file = await openMediaFile(media.storageKey);
  if (!file) return new NextResponse("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": media.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    ...(media.mimeType === "application/pdf" ? { "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}),
    ...(isPublic ? { "Cross-Origin-Resource-Policy": "cross-origin" } : {}),
  };

  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  let start = 0;
  let end = file.size - 1;
  let status = 200;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      end = range[2] ? Math.min(Number(range[2]), file.size - 1) : file.size - 1;
    } else {
      start = Math.max(0, file.size - Number(range[2])); // suffix range: last N bytes
    }
    if (start > end || start >= file.size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${file.size}`;
  }
  headers["Content-Length"] = String(end - start + 1);
  const body = Readable.toWeb(file.stream(start, end)) as ReadableStream<Uint8Array>;
  return new NextResponse(body, { status, headers });
}
