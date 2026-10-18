import "server-only";
import type { z } from "zod";
import type { ViewingStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { CLIENT_APP_URL } from "@/lib/env";
import { conflict, invalid, notFound } from "@/lib/errors";
import { APP_TIMEZONE, formatDateTime } from "@/lib/format";
import { atLocalHour, businessDate, isBusinessDate, shiftDate, weekday } from "@/lib/business-day";
import type { guestBookingSchema } from "@/schemas/website";
import { logActivity } from "./activity";
import { onViewingScheduled } from "./automation";
import { viewingBooked } from "./email-templates";
import { queueMail } from "./mail";
import { publicWhere } from "./public-listings";
import { assertNoClash } from "./viewings";
import { websiteLeadInTx } from "./website-leads";

/**
 * Viewing bookings from the public website. Visitors don't have accounts: they pick a free
 * time on the listing and leave their name, phone and e-mail. The booking lands in the CRM as
 * a viewing on a WEBSITE lead for the listing's agent, with a "confirm" task; the visitor gets
 * an e-mail now and another when the agent confirms.
 */

export const VIEWING_MINUTES = 45;
const SLOT_STEP_MINUTES = 30;
const LEAD_TIME_MS = 2 * 3_600_000;
const MAX_DAYS_AHEAD = 30;
const ACTIVE: ViewingStatus[] = ["SCHEDULED", "CONFIRMED"];

/** Viewing hours in the business time zone: 09:00–20:00, Fridays from 14:00. */
function hoursFor(date: string) {
  return weekday(date) === 5 ? { open: 14, close: 20 } : { open: 9, close: 20 };
}

function slotTimes(date: string) {
  const { open, close } = hoursFor(date);
  const out: Date[] = [];
  for (let minutes = open * 60; minutes + VIEWING_MINUTES <= close * 60; minutes += SLOT_STEP_MINUTES) {
    out.push(atLocalHour(date, Math.floor(minutes / 60), minutes % 60));
  }
  return out;
}

function assertBookableTime(startsAt: Date) {
  const date = businessDate(startsAt);
  const valid = slotTimes(date).some((t) => t.getTime() === startsAt.getTime());
  if (!valid) throw invalid("Please choose one of the available times.", { startsAt: ["Not an available time"] });
  if (startsAt.getTime() < Date.now() + LEAD_TIME_MS) throw invalid("Viewings must be booked at least 2 hours ahead.", { startsAt: ["Too soon"] });
  if (date > shiftDate(businessDate(), MAX_DAYS_AHEAD)) throw invalid(`Viewings can be booked up to ${MAX_DAYS_AHEAD} days ahead.`, { startsAt: ["Too far ahead"] });
}

/** A published listing by reference (or id). */
async function liveProperty(ref: string) {
  const property = await db.property.findFirst({
    where: { AND: [publicWhere, { OR: [{ reference: ref }, { id: ref }] }] },
    select: { id: true, reference: true, title: true, purpose: true, area: true, city: true, buildingName: true, street: true, latitude: true, longitude: true, agentId: true, agent: { select: { name: true, phone: true } } },
  });
  if (!property) throw notFound("Listing");
  return property;
}

const addressOf = (p: { street: string | null; buildingName: string | null; area: string; city: string }) => [p.street, p.buildingName, p.area, p.city].filter(Boolean).join(", ");

/** Free start times on a day for a listing (only the agent's calendar is checked; no visitor data is returned). */
export async function bookingSlots(ref: string, date: string) {
  if (!isBusinessDate(date)) throw invalid("Invalid date.");
  const property = await liveProperty(ref);
  const today = businessDate();
  if (date < today || date > shiftDate(today, MAX_DAYS_AHEAD)) return { date, timeZone: APP_TIMEZONE, durationMinutes: VIEWING_MINUTES, slots: [] };
  const times = slotTimes(date);
  const dayStart = times[0];
  const dayEnd = new Date(times[times.length - 1].getTime() + VIEWING_MINUTES * 60_000);
  const busy = property.agentId
    ? await db.viewing.findMany({
        where: { agentId: property.agentId, status: { in: ACTIVE }, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
        select: { startsAt: true, endsAt: true },
      })
    : [];
  const now = Date.now();
  const slots = times.map((start) => {
    const end = new Date(start.getTime() + VIEWING_MINUTES * 60_000);
    const taken = busy.some((b) => b.startsAt < end && b.endsAt > start);
    return { startsAt: start.toISOString(), label: start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIMEZONE }), available: !taken && start.getTime() >= now + LEAD_TIME_MS };
  });
  return { date, timeZone: APP_TIMEZONE, durationMinutes: VIEWING_MINUTES, slots };
}

/** Book a viewing from the website without an account. */
export async function bookGuestViewing(input: z.output<typeof guestBookingSchema>) {
  const property = await liveProperty(input.property);
  assertBookableTime(input.startsAt);
  const endsAt = new Date(input.startsAt.getTime() + VIEWING_MINUTES * 60_000);
  const contact = { fullName: input.name, phone: input.phone, email: input.email };

  await db.$transaction(async (tx) => {
    if (property.agentId) await assertNoClash(tx, property.agentId, input.startsAt, endsAt).catch(() => {
      throw conflict("Sorry, that time was just taken. Please pick another slot.", { startsAt: ["Just taken"] });
    });
    const lead = await websiteLeadInTx(tx, contact, property, "Website viewing request", input.note);
    const already = await tx.viewing.findFirst({ where: { leadId: lead.id, propertyId: property.id, status: { in: ACTIVE }, startsAt: { gt: new Date() } }, select: { id: true } });
    if (already) throw conflict("A viewing of this home is already booked with this phone number. The agent will contact you to confirm or change it.");

    const agentId = property.agentId ?? lead.agentId;
    const viewing = await tx.viewing.create({
      data: { propertyId: property.id, leadId: lead.id, agentId, startsAt: input.startsAt, endsAt, status: "SCHEDULED", bookedByClient: true, clientNote: input.note },
      select: { id: true },
    });
    const label = `${property.reference} with ${input.name}`;
    await onViewingScheduled(tx, { id: viewing.id, agentId, startsAt: input.startsAt, propertyId: property.id, leadId: lead.id, clientId: null, label }, null);
    // The lead stays where it is: the agent moves it on after calling the visitor (the 24-hour rule still applies).
    await tx.task.create({
      data: {
        title: `Confirm website booking: ${label}`,
        description: `${input.name} (${input.phone}${input.email ? `, ${input.email}` : ""}) booked a viewing on the website for ${formatDateTime(input.startsAt)}.${input.note ? ` Note: “${input.note}”` : ""} Call to confirm it, then mark it Confirmed in Viewings.`,
        type: "VIEWING",
        priority: "HIGH",
        dueDate: new Date(Math.min(input.startsAt.getTime() - 60 * 60_000, Date.now() + 2 * 3_600_000)),
        viewingId: viewing.id,
        propertyId: property.id,
        leadId: lead.id,
        assigneeId: agentId,
        autoKey: `confirm-booking:${viewing.id}:${input.startsAt.getTime()}`,
        events: { create: { type: "CREATED", message: "Created automatically from a website booking" } },
      },
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "VIEWING", entityId: viewing.id, entityLabel: label,
      description: `${input.name} booked a viewing of ${property.reference} on the website for ${formatDateTime(input.startsAt)}`,
      userId: null, viewingId: viewing.id, propertyId: property.id, leadId: lead.id,
    });
  });

  const address = addressOf(property);
  const listingUrl = `${CLIENT_APP_URL}/en/properties/${encodeURIComponent(property.reference)}`;
  queueMail(
    input.email,
    "viewing-booked",
    viewingBooked({ name: input.name, property: property.title, reference: property.reference, when: formatDateTime(input.startsAt), address, agent: property.agent?.name ?? null, listingUrl, confirmed: false }),
  );
  return {
    startsAt: input.startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    address,
    title: property.title,
    reference: property.reference,
    agent: property.agent ? { name: property.agent.name, phone: property.agent.phone } : null,
    directionsUrl:
      property.latitude != null && property.longitude != null
        ? `https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
  };
}
