import { Eye, MessageCircle, Phone } from "lucide-react";
import type { ListingInterest } from "@/services/listing-stats";
import { formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Website interest for one listing: page views and Call / WhatsApp presses. */
export function ListingInterestCard({ interest }: { interest: ListingInterest }) {
  const items = [
    { label: "Views", icon: Eye, recent: interest.last30.views, all: interest.allTime.views },
    { label: "Calls", icon: Phone, recent: interest.last30.calls, all: interest.allTime.calls },
    { label: "WhatsApp", icon: MessageCircle, recent: interest.last30.whatsapps, all: interest.allTime.whatsapps },
  ];
  const max = Math.max(1, ...interest.days.map((d) => d.views));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Website interest</CardTitle>
        <p className="text-xs text-muted-foreground">Last 30 days · all time below</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {items.map(({ label, icon: Icon, recent, all }) => (
            <div key={label} className="rounded-md border px-2 py-2">
              <Icon className="mx-auto size-3.5 text-muted-foreground" aria-hidden />
              <p className="tabular mt-1 text-lg font-semibold">{formatNumber(recent)}</p>
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="tabular text-[10px] text-muted-foreground/80">{formatNumber(all)} total</p>
            </div>
          ))}
        </div>
        <div>
          <div className="flex h-12 items-end gap-0.5" role="img" aria-label="Views per day, last 14 days">
            {interest.days.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.views} views · ${d.calls} calls · ${d.whatsapps} WhatsApp`}
                className="flex-1 rounded-sm bg-gold/70"
                style={{ height: `${Math.max(4, (d.views / max) * 100)}%`, opacity: d.views ? 1 : 0.25 }}
              />
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Views per day, last 14 days</p>
        </div>
      </CardContent>
    </Card>
  );
}
