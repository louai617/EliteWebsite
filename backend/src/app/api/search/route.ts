import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toPublicError } from "@/lib/errors";
import { globalSearch } from "@/services/search";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const groups = await globalSearch(user, q);
    return NextResponse.json({ groups }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: toPublicError(error).message }, { status: 500 });
  }
}
