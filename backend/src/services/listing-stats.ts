import "server-only";
import { db } from "@/lib/db";
import { businessDate, shiftDate } from "@/lib/business-day";
import { rateLimit } from "@/lib/rate-limit";
import { publicWhere } from "./public-listings";

/**
 * Website interest per listing: page views and presses of Call / WhatsApp, counted per
 * business day. The website reports them anonymously; the same visitor (IP) is counted once
 * per listing and event every half hour, so reloading the page doesn't inflate the figures.
 */

export const LISTING_EVENTS = ["view", "call", "whatsapp"] as const;
export type ListingEvent = (typeof LISTING_EVENTS)[number];

const COLUMN = { view: "views", call: "calls", whatsapp: "whatsapps" } as const;
const REPEAT_WINDOW_MS = 30 * 60_000;

/** Records one event; returns whether it was counted (false for repeats and unknown listings). */
export async function recordListingEvent(reference: string, event: ListingEvent, visitor: string, now = new Date()) {
  if (!rateLimit(`listing-event:${visitor}:${reference}:${event}`, 1, REPEAT_WINDOW_MS).ok) return false;
  const property = await db.property.findFirst({ where: { reference, ...publicWhere }, select: { id: true } });
  if (!property) return false;
  const day = businessDate(now);
  const column = COLUMN[event];
  await db.listingStat.upsert({
    where: { propertyId_day: { propertyId: property.id, day } },
    create: { propertyId: property.id, day, [column]: 1 },
    update: { [column]: { increment: 1 } },
  });
  return true;
}

export interface InterestTotals {
  views: number;
  calls: number;
  whatsapps: number;
}

/** Totals per listing for the last `days` days (today included), for a page of listings. */
export async function interestByProperty(propertyIds: string[], days = 30) {
  if (!propertyIds.length) return new Map<string, InterestTotals>();
  const since = shiftDate(businessDate(), -(days - 1));
  const rows = await db.listingStat.groupBy({
    by: ["propertyId"],
    where: { propertyId: { in: propertyIds }, day: { gte: since } },
    _sum: { views: true, calls: true, whatsapps: true },
  });
  return new Map(rows.map((r) => [r.propertyId, { views: r._sum.views ?? 0, calls: r._sum.calls ?? 0, whatsapps: r._sum.whatsapps ?? 0 }]));
}

/** One listing: the last 30 days, all time, and the last 14 days day by day (for a small chart). */
export async function listingInterest(propertyId: string) {
  const today = businessDate();
  const since30 = shiftDate(today, -29);
  const since14 = shiftDate(today, -13);
  const [all, recent, daily] = await Promise.all([
    db.listingStat.aggregate({ where: { propertyId }, _sum: { views: true, calls: true, whatsapps: true } }),
    db.listingStat.aggregate({ where: { propertyId, day: { gte: since30 } }, _sum: { views: true, calls: true, whatsapps: true } }),
    db.listingStat.findMany({ where: { propertyId, day: { gte: since14 } }, orderBy: { day: "asc" }, select: { day: true, views: true, calls: true, whatsapps: true } }),
  ]);
  const sum = (a: typeof all): InterestTotals => ({ views: a._sum.views ?? 0, calls: a._sum.calls ?? 0, whatsapps: a._sum.whatsapps ?? 0 });
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = shiftDate(since14, i);
    const row = byDay.get(day);
    return { day, views: row?.views ?? 0, calls: row?.calls ?? 0, whatsapps: row?.whatsapps ?? 0 };
  });
  return { last30: sum(recent), allTime: sum(all), days };
}

export type ListingInterest = Awaited<ReturnType<typeof listingInterest>>;
