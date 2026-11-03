import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { toPublicError } from "@/lib/errors";
import { isStaff } from "@/lib/permissions";
import { LOOKUP_TYPES, lookup, lookupLabel, type LookupType } from "@/services/search";

export async function GET(request: NextRequest, { params }: RouteContext<"/api/lookup/[type]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStaff(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { type } = await params;
  if (!(LOOKUP_TYPES as readonly string[]).includes(type)) return NextResponse.json({ error: "Unknown lookup" }, { status: 404 });
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const option = await lookupLabel(user, type as LookupType, id);
      return NextResponse.json({ options: option ? [option] : [] }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const options = await lookup(user, type as LookupType, request.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ options }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: toPublicError(error).message }, { status: 500 });
  }
}
