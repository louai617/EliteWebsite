import Link from "next/link";
import { CalendarClock, Handshake } from "lucide-react";
import type { DealStatus, DealType, ViewingStatus } from "@/generated/prisma/enums";
import { DEAL_STATUS_META, DEAL_TYPE_META, VIEWING_STATUS_META } from "@/lib/constants";
import { formatDayLabel, formatMoney, formatTime, isInPast } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { EnumBadge } from "./enum-badge";

export function ViewingMiniList({
  viewings,
}: {
  viewings: { id: string; startsAt: Date; status: ViewingStatus; property: { id: string; reference: string; title: string }; agent: { name: string } | null }[];
}) {
  if (!viewings.length) return <EmptyState compact icon={CalendarClock} title="No viewings yet" />;
  return (
    <ul className="divide-y">
      {viewings.map((v) => {
        const past = isInPast(v.startsAt);
        return (
          <li key={v.id} className={cn("flex items-center gap-3 py-2.5 first:pt-0 last:pb-0", past && v.status !== "COMPLETED" && "opacity-70")}>
            <div className="w-16 shrink-0 text-center">
              <p className="text-xs font-medium">{formatDayLabel(v.startsAt)}</p>
              <p className="tabular text-xs text-muted-foreground">{formatTime(v.startsAt)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/properties/${v.property.id}`} className="line-clamp-1 text-sm hover:underline">
                {v.property.reference} · {v.property.title}
              </Link>
              <p className="text-xs text-muted-foreground">{v.agent?.name ?? "No agent"}</p>
            </div>
            <EnumBadge meta={VIEWING_STATUS_META} value={v.status} />
          </li>
        );
      })}
    </ul>
  );
}

export function DealMiniList({
  deals,
}: {
  deals: { id: string; reference: string; type: DealType; status: DealStatus; amount: number; property: { reference: string } }[];
}) {
  if (!deals.length) return <EmptyState compact icon={Handshake} title="No deals yet" />;
  return (
    <ul className="divide-y">
      {deals.map((d) => (
        <li key={d.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <Link href={`/deals/${d.id}`} className="text-sm font-medium hover:underline">
              {d.reference}
            </Link>
            <p className="text-xs text-muted-foreground">
              {DEAL_TYPE_META[d.type].label} · {d.property.reference}
            </p>
          </div>
          <span className="tabular text-sm">{formatMoney(d.amount)}</span>
          <EnumBadge meta={DEAL_STATUS_META} value={d.status} />
        </li>
      ))}
    </ul>
  );
}
