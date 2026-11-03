import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { watermarkSettingsSchema } from "@/schemas/settings";
import { renderWatermarkPreview } from "@/services/photos";

/**
 * GET /api/settings/watermark-preview?watermarkEnabled=true&watermarkPosition=CENTER&watermarkSize=30&watermarkOpacity=45
 * Admins only: the latest uploaded photo with that watermark, for the live preview in Settings.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can.editSettings(user)) return new NextResponse("Not found", { status: 404 });
  const limited = rateLimit(`watermark-preview:${user.id}`, 120, 60_000);
  if (!limited.ok) return new NextResponse("Too many requests", { status: 429 });
  const parsed = watermarkSettingsSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { watermarkEnabled, watermarkPosition, watermarkSize, watermarkOpacity } = parsed.data;
  const image = await renderWatermarkPreview({ enabled: watermarkEnabled, position: watermarkPosition, size: watermarkSize, opacity: watermarkOpacity });
  return new NextResponse(new Uint8Array(image), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
