import { NextResponse } from "next/server";
import { getCurrentUser, resolveSession } from "@/lib/auth/session";
import { openDocument } from "@/services/documents";

/**
 * GET /api/documents/:id — streams a document after a permission check (staff: records in
 * their scope; clients: their own file). `?download=1` forces a download.
 * Never cached, never sniffed, and rendered in a sandbox so a crafted file can't run scripts.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  const { id } = await params;
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const user = bearer ? await resolveSession(bearer) : await getCurrentUser();
  if (!user) return new NextResponse("Please sign in to view this document.", { status: 401 });
  const file = await openDocument(user, id);
  if (!file) return new NextResponse("Not found", { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(file.buf), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.buf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; plugin-types application/pdf",
      "Cross-Origin-Resource-Policy": "same-site",
    },
  });
}
