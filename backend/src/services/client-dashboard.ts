import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { ViewingStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { CLIENT_APP_URL } from "@/lib/env";
import { viewingBooked } from "./email-templates";
import { queueMail } from "./mail";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { APP_TIMEZONE, formatDateTime } from "@/lib/format";
import { atLocalHour, businessDate, isBusinessDate, shiftDate, weekday } from "@/lib/business-day";
import { PROPERTY_TYPE_META } from "@/lib/constants";
import type { bookingSchema, preferencesSchema } from "@/schemas/portal";
import { logActivity } from "./activity";
import { onViewingCancelled, onViewingScheduled } from "./automation";
import { assertNoClash } from "./viewings";
import { publicCardSelect, publicListingWhere, publicWhere, toPublicCard, type PublicListingCard } from "./public-listings";

/**
 * The client dashboard on the website (eliterealestate.qa): viewing bookings, saved homes with
 * price-drop alerts, search preferences, personalised recommendations and the purchase journey.
 *
 * Everything is keyed on the signed-in CLIENT's own CRM record (`actor.clientId` from the
 * database session) and written straight into the CRM, so agents see bookings, saved homes and
 * preferences instantly in the agent app (app.eliterealestate.qa).
 */

type PortalActor = Actor & { clientId?: string | null };

function clientIdOf(actor: PortalActor): string {
  if (actor.role !== "CLIENT" || !actor.clientId) throw forbidden("This area is for client accounts.");
  return actor.clientId;
}

/** A published listing by reference (or id). */
async function liveProperty(ref: string) {
  const property = await db.property.findFirst({
    where: { AND: [publicWhere, { OR: [{ reference: ref }, { id: ref }] }] },
    select: { id: true, reference: true, title: true, agentId: true, price: true, area: true, city: true, buildingName: true, street: true, latitude: true, longitude: true },
  });
  if (!property) throw notFound("Listing");
  return property;
}

// ───────────────────────────── Booking slots ─────────────────────────────

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

/** Free start times on a day for a listing (the agent's and the client's calendars are checked). */
export async function bookingSlots(actor: PortalActor, ref: string, date: string) {
  const clientId = clientIdOf(actor);
  if (!isBusinessDate(date)) throw invalid("Invalid date.");
  const property = await liveProperty(ref);
  const today = businessDate();
  if (date < today || date > shiftDate(today, MAX_DAYS_AHEAD)) return { date, slots: [] };
  const times = slotTimes(date);
  const dayStart = times[0];
  const dayEnd = new Date(times[times.length - 1].getTime() + VIEWING_MINUTES * 60_000);
  const busy = await db.viewing.findMany({
    where: {
      status: { in: ACTIVE },
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
      OR: [...(property.agentId ? [{ agentId: property.agentId }] : []), { clientId }],
    },
    select: { startsAt: true, endsAt: true },
  });
  const now = Date.now();
  const slots = times.map((start) => {
    const end = new Date(start.getTime() + VIEWING_MINUTES * 60_000);
    const taken = busy.some((b) => b.startsAt < end && b.endsAt > start);
    return { startsAt: start.toISOString(), label: start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIMEZONE }), available: !taken && start.getTime() >= now + LEAD_TIME_MS };
  });
  return { date, timeZone: APP_TIMEZONE, durationMinutes: VIEWING_MINUTES, slots };
}

// ───────────────────────────── Bookings ─────────────────────────────

const bookingSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  bookedByClient: true,
  clientNote: true,
  agent: { select: { name: true, phone: true, email: true, avatarUrl: true } },
  property: { select: { ...publicCardSelect, websitePublished: true, street: true, latitude: true, longitude: true } },
} satisfies Prisma.ViewingSelect;

type BookingRow = Prisma.ViewingGetPayload<{ select: typeof bookingSelect }>;

function toBooking(v: BookingRow, origin: string) {
  const { websitePublished: _published, street, latitude, longitude, ...card } = v.property;
  const upcoming = v.startsAt.getTime() > Date.now() && ACTIVE.includes(v.status);
  const where = [street, card.buildingName, card.area, card.city].filter(Boolean).join(", ");
  return {
    id: v.id,
    startsAt: v.startsAt.toISOString(),
    endsAt: v.endsAt.toISOString(),
    status: v.status,
    /** Website bookings wait for the agent to confirm. */
    awaitingConfirmation: v.status === "SCHEDULED" && v.bookedByClient,
    bookedOnline: v.bookedByClient,
    note: v.clientNote,
    upcoming,
    canChange: upcoming && v.startsAt.getTime() > Date.now() + LEAD_TIME_MS,
    agent: v.agent ? { name: v.agent.name, phone: v.agent.phone, email: v.agent.email, photo: v.agent.avatarUrl, whatsapp: v.agent.phone?.replace(/[^0-9]/g, "") ?? null } : null,
    address: where,
    directionsUrl: latitude != null && longitude != null ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}`,
    property: toPublicCard(card, origin),
  };
}

export async function listBookings(actor: PortalActor, origin: string) {
  const clientId = clientIdOf(actor);
  const rows = await db.viewing.findMany({ where: { clientId }, orderBy: { startsAt: "desc" }, take: 200, select: bookingSelect });
  const bookings = rows.map((r) => toBooking(r, origin));
  return {
    upcoming: bookings.filter((b) => b.upcoming).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    past: bookings.filter((b) => !b.upcoming),
  };
}

async function ownBooking(actor: PortalActor, id: string) {
  const clientId = clientIdOf(actor);
  const viewing = await db.viewing.findFirst({ where: { id, clientId }, select: { id: true, status: true, startsAt: true, agentId: true, propertyId: true, clientNote: true, property: { select: { reference: true } } } });
  if (!viewing) throw notFound("Booking");
  return viewing;
}

/** Book a viewing from the website. Lands in the CRM with a "confirm" task for the agent. */
export async function bookViewing(actor: PortalActor, input: z.output<typeof bookingSchema>, origin: string) {
  const clientId = clientIdOf(actor);
  const property = await liveProperty(input.property);
  assertBookableTime(input.startsAt);
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId }, select: { fullName: true, agentId: true } });
  const agentId = property.agentId ?? client.agentId;
  const existing = await db.viewing.findFirst({ where: { clientId, propertyId: property.id, status: { in: ACTIVE }, startsAt: { gt: new Date() } }, select: { startsAt: true } });
  if (existing) throw conflict(`You already have a viewing of this property on ${formatDateTime(existing.startsAt)}. Reschedule it from your bookings instead.`);

  const endsAt = new Date(input.startsAt.getTime() + VIEWING_MINUTES * 60_000);
  const id = await db.$transaction(async (tx) => {
    if (agentId) await assertNoClash(tx, agentId, input.startsAt, endsAt).catch(() => {
      throw conflict("Sorry, that time was just taken. Please pick another slot.", { startsAt: ["Just taken"] });
    });
    const mine = await tx.viewing.findFirst({ where: { clientId, status: { in: ACTIVE }, startsAt: { lt: endsAt }, endsAt: { gt: input.startsAt } }, select: { id: true } });
    if (mine) throw conflict("You already have another viewing at that time.", { startsAt: ["Overlaps your booking"] });

    const viewing = await tx.viewing.create({
      data: { propertyId: property.id, clientId, agentId, startsAt: input.startsAt, endsAt, status: "SCHEDULED", bookedByClient: true, clientNote: input.note },
      select: { id: true },
    });
    const label = `${property.reference} with ${client.fullName}`;
    await onViewingScheduled(tx, { id: viewing.id, agentId, startsAt: input.startsAt, propertyId: property.id, leadId: null, clientId, label }, null);
    await tx.task.create({
      data: {
        title: `Confirm website booking: ${label}`,
        description: `${client.fullName} booked a viewing on the website for ${formatDateTime(input.startsAt)}.${input.note ? ` Note: “${input.note}”` : ""} Confirm it in Viewings (or call to reschedule).`,
        type: "VIEWING",
        priority: "HIGH",
        dueDate: new Date(Math.min(input.startsAt.getTime() - 60 * 60_000, Date.now() + 2 * 3_600_000)),
        viewingId: viewing.id,
        propertyId: property.id,
        clientId,
        assigneeId: agentId,
        autoKey: `confirm-booking:${viewing.id}:${input.startsAt.getTime()}`,
        events: { create: { type: "CREATED", message: "Created automatically from a website booking" } },
      },
    });
    // Booking a viewing also puts the home on the client's shortlist.
    await tx.propertyInterest.upsert({
      where: { propertyId_clientId: { propertyId: property.id, clientId } },
      create: { propertyId: property.id, clientId, priceAtSave: property.price },
      update: {},
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "VIEWING", entityId: viewing.id, entityLabel: label,
      description: `${client.fullName} booked a viewing of ${property.reference} on the website for ${formatDateTime(input.startsAt)}`,
      userId: null, viewingId: viewing.id, propertyId: property.id, clientId,
    });
    return viewing.id;
  });
  const row = await db.viewing.findUniqueOrThrow({ where: { id }, select: bookingSelect });
  const booking = toBooking(row, origin);
  const me = await db.client.findUnique({ where: { id: clientId }, select: { fullName: true, email: true, portalUser: { select: { email: true } } } });
  queueMail(
    me?.portalUser?.email ?? me?.email,
    "viewing-booked",
    viewingBooked({
      name: me?.fullName ?? "there", property: property.title, reference: property.reference, when: formatDateTime(input.startsAt), address: booking.address,
      agent: booking.agent?.name ?? null, manageUrl: `${CLIENT_APP_URL}/en/dashboard/bookings`, confirmed: false,
    }),
  );
  return booking;
}

export async function rescheduleBooking(actor: PortalActor, id: string, startsAt: Date, origin: string) {
  const clientId = clientIdOf(actor);
  const current = await ownBooking(actor, id);
  if (!ACTIVE.includes(current.status) || current.startsAt.getTime() <= Date.now() + LEAD_TIME_MS) throw invalid("This booking can no longer be changed online. Please call your agent.");
  assertBookableTime(startsAt);
  const endsAt = new Date(startsAt.getTime() + VIEWING_MINUTES * 60_000);
  await db.$transaction(async (tx) => {
    if (current.agentId) await assertNoClash(tx, current.agentId, startsAt, endsAt, id).catch(() => {
      throw conflict("Sorry, that time was just taken. Please pick another slot.", { startsAt: ["Just taken"] });
    });
    // A new time needs the agent's confirmation again.
    await tx.viewing.update({ where: { id }, data: { startsAt, endsAt, status: "SCHEDULED", bookedByClient: true } });
    await tx.task.updateMany({ where: { viewingId: id, autoKey: `viewing:${id}`, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { dueDate: startsAt } });
    await tx.task.updateMany({ where: { viewingId: id, autoKey: { startsWith: "confirm-booking:" }, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    await tx.task.create({
      data: {
        title: `Confirm rescheduled booking: ${current.property.reference}`,
        description: `The client moved this viewing to ${formatDateTime(startsAt)} on the website. Confirm it in Viewings.`,
        type: "VIEWING", priority: "HIGH", dueDate: new Date(Math.min(startsAt.getTime() - 60 * 60_000, Date.now() + 2 * 3_600_000)),
        viewingId: id, propertyId: current.propertyId, clientId, assigneeId: current.agentId,
        autoKey: `confirm-booking:${id}:${startsAt.getTime()}`,
        events: { create: { type: "CREATED", message: "Created automatically: the client rescheduled online" } },
      },
    });
    await logActivity(tx, {
      action: "STATUS_CHANGED", entityType: "VIEWING", entityId: id, entityLabel: current.property.reference,
      description: `The client rescheduled the viewing of ${current.property.reference} to ${formatDateTime(startsAt)} on the website`,
      userId: null, viewingId: id, propertyId: current.propertyId, clientId,
    });
  });
  return toBooking(await db.viewing.findUniqueOrThrow({ where: { id }, select: bookingSelect }), origin);
}

export async function cancelBooking(actor: PortalActor, id: string, reason: string | null) {
  const clientId = clientIdOf(actor);
  const current = await ownBooking(actor, id);
  if (!ACTIVE.includes(current.status)) throw invalid("This booking is not active.");
  if (current.startsAt.getTime() <= Date.now()) throw invalid("This viewing has already started.");
  await db.$transaction(async (tx) => {
    await tx.viewing.update({ where: { id }, data: { status: "CANCELLED", ...(reason ? { clientNote: [current.clientNote, `Cancelled by client: ${reason}`].filter(Boolean).join(" — ") } : {}) } });
    await onViewingCancelled(tx, id, `The client cancelled on the website${reason ? `: ${reason}` : ""}`, null);
    await logActivity(tx, {
      action: "CANCELLED", entityType: "VIEWING", entityId: id, entityLabel: current.property.reference,
      description: `The client cancelled the viewing of ${current.property.reference} on the website${reason ? ` — “${reason}”` : ""}`,
      userId: null, viewingId: id, propertyId: current.propertyId, clientId,
    });
  });
  return { cancelled: true };
}

const icsEscape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** iCalendar file for "Add to calendar". */
export async function bookingCalendar(actor: PortalActor, id: string, origin: string) {
  const clientId = clientIdOf(actor);
  const v = await db.viewing.findFirst({ where: { id, clientId }, select: bookingSelect });
  if (!v) throw notFound("Booking");
  const b = toBooking(v, origin);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ELITE Real Estate//Client portal//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:viewing-${v.id}@eliterealestate.qa`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(v.startsAt)}`,
    `DTEND:${icsDate(v.endsAt)}`,
    `SUMMARY:${icsEscape(`Viewing: ${b.property.title_en}`)}`,
    `LOCATION:${icsEscape(b.address)}`,
    `DESCRIPTION:${icsEscape(`Reference ${b.property.reference_number}${b.agent ? `\nAgent: ${b.agent.name}${b.agent.phone ? ` (${b.agent.phone})` : ""}` : ""}\nDirections: ${b.directionsUrl}`)}`,
    `STATUS:${v.status === "CANCELLED" ? "CANCELLED" : v.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE"}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Property viewing in 1 hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

// ───────────────────────────── Saved homes ─────────────────────────────

export async function listSaved(actor: PortalActor, origin: string) {
  const clientId = clientIdOf(actor);
  const rows = await db.propertyInterest.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { createdAt: true, priceAtSave: true, property: { select: { ...publicCardSelect, websitePublished: true } } },
  });
  return rows.map((r) => {
    const { websitePublished, ...card } = r.property;
    const live = websitePublished && ["AVAILABLE", "RESERVED"].includes(card.status);
    const change = r.priceAtSave && r.priceAtSave !== card.price ? Math.round(((card.price - r.priceAtSave) / r.priceAtSave) * 1000) / 10 : 0;
    return {
      savedAt: r.createdAt.toISOString(),
      priceAtSave: r.priceAtSave,
      /** Percent vs. the price when saved; negative = price drop. */
      priceChangePercent: change,
      live,
      property: toPublicCard(card, origin),
    };
  });
}

export async function saveHome(actor: PortalActor, ref: string) {
  const clientId = clientIdOf(actor);
  const property = await liveProperty(ref);
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId }, select: { fullName: true } });
  const existing = await db.propertyInterest.findUnique({ where: { propertyId_clientId: { propertyId: property.id, clientId } }, select: { id: true } });
  if (existing) return { saved: true };
  await db.$transaction(async (tx) => {
    await tx.propertyInterest.create({ data: { propertyId: property.id, clientId, priceAtSave: property.price } });
    await logActivity(tx, {
      action: "UPDATED", entityType: "CLIENT", entityId: clientId, entityLabel: client.fullName,
      description: `${client.fullName} saved ${property.reference} on the website`, userId: null, clientId, propertyId: property.id,
    });
  });
  return { saved: true };
}

export async function unsaveHome(actor: PortalActor, ref: string) {
  const clientId = clientIdOf(actor);
  const property = await db.property.findFirst({ where: { OR: [{ reference: ref }, { id: ref }] }, select: { id: true } });
  if (!property) throw notFound("Listing");
  await db.propertyInterest.deleteMany({ where: { propertyId: property.id, clientId } });
  return { saved: false };
}

// ───────────────────────────── Preferences & recommendations ─────────────────────────────

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export async function getPreferences(actor: PortalActor) {
  const clientId = clientIdOf(actor);
  const c = await db.client.findUniqueOrThrow({ where: { id: clientId }, select: { preferredPurpose: true, preferredTypes: true, preferredAreas: true, preferredBedrooms: true, budgetMin: true, budgetMax: true, requirements: true } });
  const areas = await db.property.groupBy({ by: ["area"], where: publicWhere, orderBy: { area: "asc" } });
  return {
    purpose: c.preferredPurpose,
    types: parseList(c.preferredTypes),
    areas: parseList(c.preferredAreas),
    bedrooms: c.preferredBedrooms,
    budgetMin: c.budgetMin,
    budgetMax: c.budgetMax,
    requirements: c.requirements,
    options: {
      areas: areas.map((a) => a.area),
      types: Object.entries(PROPERTY_TYPE_META).map(([value, meta]) => ({ value, label: meta.label })),
    },
  };
}

export async function updatePreferences(actor: PortalActor, input: z.output<typeof preferencesSchema>) {
  const clientId = clientIdOf(actor);
  await db.$transaction(async (tx) => {
    const client = await tx.client.update({
      where: { id: clientId },
      data: {
        preferredPurpose: input.purpose,
        preferredTypes: input.types.length ? JSON.stringify(input.types) : null,
        preferredAreas: input.areas.length ? JSON.stringify(input.areas) : null,
        preferredBedrooms: input.bedrooms,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        requirements: input.requirements,
      },
      select: { fullName: true },
    });
    await logActivity(tx, {
      action: "UPDATED", entityType: "CLIENT", entityId: clientId, entityLabel: client.fullName,
      description: `${client.fullName} updated their search preferences on the website`, userId: null, clientId,
    });
  });
  return getPreferences(actor);
}

/**
 * "Homes for you": published listings scored against the client's preferences and the homes
 * they saved or viewed. Each result says why it was picked.
 */
export async function recommendations(actor: PortalActor, origin: string, limit = 12) {
  const clientId = clientIdOf(actor);
  const [client, saved, viewed] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: clientId }, select: { preferredPurpose: true, preferredTypes: true, preferredAreas: true, preferredBedrooms: true, budgetMin: true, budgetMax: true, clientType: true } }),
    db.propertyInterest.findMany({ where: { clientId }, select: { propertyId: true, property: { select: { area: true, type: true, purpose: true, price: true } } } }),
    db.viewing.findMany({ where: { clientId }, select: { propertyId: true } }),
  ]);
  const types = parseList(client.preferredTypes);
  const areas = parseList(client.preferredAreas);
  const exclude = new Set([...saved.map((s) => s.propertyId), ...viewed.map((v) => v.propertyId)]);
  const purpose = client.preferredPurpose ?? (saved[0]?.property.purpose ?? (["TENANT"].includes(client.clientType) ? "RENT" : null));
  const savedAreas = new Set(saved.map((s) => s.property.area));
  const savedTypes = new Set(saved.map((s) => s.property.type));
  const hasSignals = Boolean(purpose || types.length || areas.length || client.budgetMax || saved.length);

  const candidates = await db.property.findMany({
    where: { AND: [publicListingWhere({ purpose: purpose ?? undefined }), exclude.size ? { id: { notIn: [...exclude] } } : {}] },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: publicCardSelect,
  });

  const scored = candidates.map((p) => {
    let score = 0;
    const reasons: string[] = [];
    if (areas.includes(p.area)) {
      score += 3;
      reasons.push(`In ${p.area}`);
    } else if (savedAreas.has(p.area)) {
      score += 1.5;
      reasons.push(`Near homes you saved`);
    }
    if (types.includes(p.type)) {
      score += 3;
      reasons.push(PROPERTY_TYPE_META[p.type].label);
    } else if (savedTypes.has(p.type)) score += 1;
    if (client.budgetMax != null) {
      if (p.price <= client.budgetMax && (client.budgetMin == null || p.price >= client.budgetMin)) {
        score += 3;
        reasons.push("Within your budget");
      } else if (p.price <= client.budgetMax * 1.1) {
        score += 1;
        reasons.push("Just above budget");
      } else score -= 3;
    }
    if (client.preferredBedrooms != null && p.bedrooms != null) {
      if (p.bedrooms >= client.preferredBedrooms) {
        score += 2;
        reasons.push(client.preferredBedrooms === 0 ? "Studio or larger" : `${client.preferredBedrooms}+ bedrooms`);
      } else score -= 2;
    }
    if (p.isFeatured) score += 0.5;
    const ageDays = (Date.now() - (p.websitePublishedAt ?? p.createdAt).getTime()) / 86_400_000;
    if (ageDays <= 7) {
      score += 0.5;
      reasons.push("New this week");
    }
    return { score, reasons, card: toPublicCard(p, origin) };
  });

  const picked = scored
    .filter((s) => !hasSignals || s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  const top = picked[0]?.score || 1;
  return {
    basedOn: hasSignals ? "preferences" : "featured",
    items: picked.map((s) => ({ matchPercent: hasSignals ? Math.max(40, Math.min(99, Math.round((s.score / Math.max(top, 8)) * 100))) : null, reasons: s.reasons.slice(0, 3), property: s.card })),
  };
}

// ───────────────────────────── Journey ─────────────────────────────

export const JOURNEY_STEPS = ["Joined", "Enquiry", "Viewing booked", "Viewed", "Offer", "Contract", "Keys"] as const;

/** Where the client is on the way to their new home, from real CRM records. */
export async function journey(clientId: string) {
  const [leads, viewings, deals] = await Promise.all([
    db.lead.findMany({ where: { clientId }, select: { status: true } }),
    db.viewing.findMany({ where: { clientId }, select: { status: true } }),
    db.deal.findMany({ where: { OR: [{ clientId }, { lead: { clientId } }] }, select: { status: true } }),
  ]);
  let step = 0;
  if (leads.length || viewings.length) step = 1;
  if (viewings.some((v) => v.status !== "CANCELLED")) step = 2;
  if (viewings.some((v) => v.status === "COMPLETED")) step = 3;
  if (leads.some((l) => l.status === "NEGOTIATION" || l.status === "WON")) step = Math.max(step, 4);
  if (deals.some((d) => d.status === "PENDING_CONTRACT")) step = Math.max(step, 5);
  const complete = deals.some((d) => d.status === "CLOSED");
  if (complete) step = JOURNEY_STEPS.length - 1;
  return { steps: [...JOURNEY_STEPS], current: step, complete };
}

export type { PublicListingCard };
