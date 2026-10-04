import { apiRoute } from "@/lib/api/handler";
import { publicOrigin } from "@/lib/env";
import { bookingCalendar } from "@/services/client-dashboard";

/** GET /api/portal/bookings/:id/calendar — .ics file ("Add to calendar"). */
export const GET = apiRoute({ audience: "client" }, async ({ user, params, request }) => {
  const ics = await bookingCalendar(user, params.id, publicOrigin(request));
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="elite-viewing-${params.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
});
