import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { readUpload } from "@/services/storage";

/** Serves uploaded property photos to signed-in staff. */
export async function GET(_request: Request, { params }: RouteContext<"/api/uploads/[...path]">) {
  if (!(await getCurrentUser())) return new NextResponse("Unauthorized", { status: 401 });
  const { path } = await params;
  const file = await readUpload(path);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.buf), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
