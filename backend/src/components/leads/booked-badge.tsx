import { CalendarCheck } from "lucide-react";
import { formatZoned } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export interface OnlineBooking {
  startsAt: Date | string;
  status: string;
}

/** Marks a lead whose client booked a viewing themselves on the website. */
export function BookedBadge({ booking, className }: { booking: OnlineBooking | undefined; className?: string }) {
  if (!booking) return null;
  const when = formatZoned(booking.startsAt, "EEE d MMM, HH:mm");
  return (
    <Badge tone="green" className={className} title={`Booked a viewing on the website for ${when}`}>
      <CalendarCheck /> Booked viewing · {when}
    </Badge>
  );
}
