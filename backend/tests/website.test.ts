/**
 * Tests for the two-portal link: the public listings API the website (eliterealestate.qa) reads,
 * publish/unpublish from the agent app, and the client dashboard (bookings, saved homes,
 * preferences, recommendations, journey).
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { atLocalHour, businessDate, shiftDate, weekday } from "@/lib/business-day";
import { propertySchema, updatePropertySchema } from "@/schemas/property";
import { bookingSchema, preferencesSchema, registerClientSchema } from "@/schemas/portal";
import { createProperty, getPropertyForEdit, setPropertyStatus, updateProperty } from "@/services/properties";
import { setViewingStatus } from "@/services/viewings";
import { getPublicListing, listPublicListings, PUBLIC_STATUSES } from "@/services/public-listings";
import { registerClientAccount } from "@/services/client-accounts";
import {
  bookingCalendar, bookingSlots, bookViewing, cancelBooking, getPreferences, journey, listBookings, listSaved,
  recommendations, rescheduleBooking, saveHome, unsaveHome, updatePreferences,
} from "@/services/client-dashboard";
import type { Role } from "@/generated/prisma/enums";

let pass = 0;
let fail = 0;
function check(name: string, ok: unknown, extra?: unknown) {
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL  ${name}`, extra ?? "");
  }
}
async function rejects(name: string, fn: () => Promise<unknown>, match?: RegExp) {
  try {
    await fn();
    check(`${name} (expected rejection)`, false);
  } catch (e) {
    const msg = toPublicError(e).message;
    check(name, !match || match.test(msg), msg);
  }
}

const ORIGIN = "http://api.test";
const actorFor = async (email: string) => {
  const u = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true, clientId: true } });
  return u as { id: string; role: Role; clientId: string | null };
};

/** A Sunday–Thursday business date at least `days` ahead (full 09:00–20:00 hours). */
function weekdayAhead(days: number) {
  let date = shiftDate(businessDate(), days);
  while (weekday(date) === 5 || weekday(date) === 6) date = shiftDate(date, 1);
  return date;
}

async function main() {
  const omar = await actorFor("omar@elite.qa");
  const page = { page: 1, pageSize: 48, sort: "newest" as const };

  // ── Public listings (what the website shows) ──
  const pub = await listPublicListings({}, page, ORIGIN);
  check("public list only has AVAILABLE/RESERVED listings", pub.items.length > 0 && pub.items.every((p) => (PUBLIC_STATUSES as readonly string[]).includes(p.status.toUpperCase())), pub.items.map((p) => p.status));
  const expected = await db.property.count({ where: { websitePublished: true, status: { in: [...PUBLIC_STATUSES] } } });
  check("public total matches published inventory", pub.total === expected, { total: pub.total, expected });
  check("website listings were migrated into the CRM", Boolean(await db.property.findUnique({ where: { reference: "ELT-00123" } })));
  const withPhoto = pub.items.find((p) => p.images.length > 0);
  check("listing photos are absolute URLs", withPhoto && withPhoto.images.every((u) => /^https?:\/\//.test(u)), withPhoto?.images);
  const sale = await listPublicListings({ purpose: "SALE" }, page, ORIGIN);
  check("purpose filter", sale.items.length > 0 && sale.items.every((p) => p.purpose === "sale"));
  const cheap = await listPublicListings({}, { ...page, sort: "price_asc" }, ORIGIN);
  check("price sort ascending", cheap.items.every((p, i, a) => i === 0 || a[i - 1].price <= p.price));

  // ── Publishing from the agent app ──
  const owner = await db.owner.findFirstOrThrow({ select: { id: true, email: true, phone: true } });
  const base = propertySchema.parse({
    title: "Website sync test villa", type: "VILLA", purpose: "SALE", status: "AVAILABLE", price: "5000000", currency: "QAR",
    country: "Qatar", city: "Doha", area: "West Bay", bedrooms: "4", ownerId: owner.id, agentId: null,
    websitePublished: false, amenities: ["private_pool"], highlights: [], nearby: [], paymentPlan: [],
  });
  const hidden = await createProperty(omar, base);
  check("unpublished listing is not on the website", (await getPublicListing(hidden.reference, ORIGIN)) == null);
  check("no website posting recorded while hidden", (await db.agentActivity.count({ where: { propertyId: hidden.id, type: "PROPERTY_POST", outcome: "Website" } })) === 0);
  const edit = await getPropertyForEdit(omar, hidden.id);
  const published = updatePropertySchema.parse({ ...base, id: hidden.id, agentId: edit?.agentId ?? null, websitePublished: true });
  await updateProperty(omar, published);
  const live = await getPublicListing(hidden.reference, ORIGIN);
  check("publishing puts the listing on the website", live?.reference_number === hidden.reference);
  check("website posting is counted as a property post", (await db.agentActivity.count({ where: { propertyId: hidden.id, type: "PROPERTY_POST", outcome: "Website" } })) === 1);
  check("publish time recorded", Boolean((await db.property.findUniqueOrThrow({ where: { id: hidden.id } })).websitePublishedAt));
  await updateProperty(omar, published);
  check("re-saving doesn't double-count the posting", (await db.agentActivity.count({ where: { propertyId: hidden.id, type: "PROPERTY_POST", outcome: "Website" } })) === 1);
  const json = JSON.stringify(live);
  check("public listing never exposes owner contact", Boolean(live) && !json.includes(owner.phone) && (!owner.email || !json.includes(owner.email)) && !/"owner(_?id|_?name|_?phone|_?email)?"/i.test(json));
  check("public listing never exposes commission or internal notes", !/commission|internalNotes|ownerId/i.test(json));
  check("extra amenities reach the website", /pool/i.test(JSON.stringify(live?.amenities)), live?.amenities);
  await setPropertyStatus(omar, hidden.id, "SOLD");
  check("sold listing leaves the website", (await getPublicListing(hidden.reference, ORIGIN)) == null);
  await setPropertyStatus(omar, hidden.id, "AVAILABLE");

  // ── Client accounts ──
  const a = await registerClientAccount(registerClientSchema.parse({ name: "Web Client A", email: "web.a@example.com", phone: "+974 5000 4444", password: "WebClient2026" }));
  const b = await registerClientAccount(registerClientSchema.parse({ name: "Web Client B", email: "web.b@example.com", phone: "+974 5000 5555", password: "WebClient2026" }));
  check("journey starts at Joined", (await journey(a.clientId!)).current === 0);

  // ── Booking slots ──
  const day = weekdayAhead(3);
  await rejects("staff can't use client booking", () => bookingSlots(omar, hidden.reference, day), /client accounts/i);
  await rejects("can't book an unpublished listing", async () => {
    await db.property.update({ where: { id: hidden.id }, data: { websitePublished: false } });
    try {
      await bookingSlots(a, hidden.reference, day);
    } finally {
      await db.property.update({ where: { id: hidden.id }, data: { websitePublished: true } });
    }
  }, /not found/i);
  const slots = await bookingSlots(a, hidden.reference, day);
  check("slots run 09:00 to 19:15 on a weekday", slots.slots[0]?.label === "09:00" && slots.slots.at(-1)?.label === "19:00", slots.slots.map((s) => s.label));
  check("past days have no slots", (await bookingSlots(a, hidden.reference, shiftDate(businessDate(), -1))).slots.length === 0);

  // ── Booking a viewing ──
  const at10 = atLocalHour(day, 10);
  const booking = await bookViewing(a, bookingSchema.parse({ property: hidden.reference, startsAt: at10.toISOString(), note: "Coming with family" }), ORIGIN);
  check("website booking is SCHEDULED and awaits the agent", booking.status === "SCHEDULED" && booking.awaitingConfirmation && booking.bookedOnline);
  const viewing = await db.viewing.findUniqueOrThrow({ where: { id: booking.id } });
  check("booking lands in the CRM for the listing agent", viewing.agentId === omar.id && viewing.bookedByClient && viewing.clientNote === "Coming with family");
  const confirmTask = await db.task.findFirst({ where: { viewingId: booking.id, autoKey: { startsWith: "confirm-booking:" } } });
  check("agent gets a 'confirm website booking' task", confirmTask?.assigneeId === omar.id && confirmTask.status !== "COMPLETED");
  check("booked home is added to the shortlist", (await db.propertyInterest.count({ where: { clientId: a.clientId!, propertyId: hidden.id } })) === 1);
  check("journey moves to Viewing booked", (await journey(a.clientId!)).current === 2);
  const taken = (await bookingSlots(a, hidden.reference, day)).slots.find((s) => s.startsAt === at10.toISOString());
  check("booked slot is no longer offered", taken && !taken.available);
  await rejects("one active booking per home", () => bookViewing(a, bookingSchema.parse({ property: hidden.reference, startsAt: atLocalHour(day, 15).toISOString() }), ORIGIN), /already have a viewing/i);
  await rejects("another client can't take the agent's slot", () => bookViewing(b, bookingSchema.parse({ property: hidden.reference, startsAt: at10.toISOString() }), ORIGIN), /just taken/i);
  await rejects("off-grid times are rejected", () => bookViewing(b, bookingSchema.parse({ property: hidden.reference, startsAt: atLocalHour(day, 10, 10).toISOString() }), ORIGIN), /available times/i);
  await rejects("too-soon times are rejected", () => bookViewing(b, bookingSchema.parse({ property: hidden.reference, startsAt: atLocalHour(businessDate(), 9).toISOString() }), ORIGIN), /available times|2 hours/i);
  await rejects("bookings more than 30 days ahead are rejected", () => bookViewing(b, bookingSchema.parse({ property: hidden.reference, startsAt: atLocalHour(weekdayAhead(40), 10).toISOString() }), ORIGIN), /30 days/i);

  // Client isolation
  check("client B doesn't see client A's bookings", (await listBookings(b, ORIGIN)).upcoming.length === 0);
  await rejects("client B can't cancel client A's booking", () => cancelBooking(b, booking.id, null), /not found/i);
  await rejects("client B can't read client A's calendar file", () => bookingCalendar(b, booking.id, ORIGIN), /not found/i);
  const ics = await bookingCalendar(a, booking.id, ORIGIN);
  check("calendar file is a valid VEVENT", typeof ics === "object" ? JSON.stringify(ics).includes("BEGIN:VEVENT") : String(ics).includes("BEGIN:VEVENT"));

  // Agent confirms in the CRM
  await setViewingStatus(omar, booking.id, "CONFIRMED");
  check("confirming in the CRM completes the confirm task", (await db.task.findUniqueOrThrow({ where: { id: confirmTask!.id } })).status === "COMPLETED");
  const afterConfirm = (await listBookings(a, ORIGIN)).upcoming.find((x) => x.id === booking.id);
  check("client sees the booking confirmed", afterConfirm?.status === "CONFIRMED" && !afterConfirm.awaitingConfirmation);

  // Reschedule & cancel
  const moved = await rescheduleBooking(a, booking.id, atLocalHour(day, 16), ORIGIN);
  check("rescheduling moves the viewing and asks the agent to confirm again", moved.startsAt === atLocalHour(day, 16).toISOString() && moved.status === "SCHEDULED");
  check("rescheduling creates a fresh confirm task", (await db.task.count({ where: { viewingId: booking.id, autoKey: { startsWith: "confirm-booking:" }, status: { not: "COMPLETED" } } })) === 1);
  check("old slot is free again", (await bookingSlots(a, hidden.reference, day)).slots.find((s) => s.startsAt === at10.toISOString())?.available);
  await cancelBooking(a, booking.id, "Found another home");
  const cancelled = await db.viewing.findUniqueOrThrow({ where: { id: booking.id } });
  check("cancelling keeps the record (status CANCELLED)", cancelled.status === "CANCELLED");
  check("cancelling keeps the client's original note", cancelled.clientNote?.includes("Coming with family") && cancelled.clientNote.includes("Found another home"), cancelled.clientNote);
  check("cancelling closes open confirm tasks", (await db.task.count({ where: { viewingId: booking.id, autoKey: { startsWith: "confirm-booking:" }, status: { notIn: ["COMPLETED", "CANCELLED"] } } })) === 0);
  await rejects("a cancelled booking can't be cancelled again", () => cancelBooking(a, booking.id, null), /not active/i);
  const rebook = await bookViewing(b, bookingSchema.parse({ property: hidden.reference, startsAt: at10.toISOString() }), ORIGIN);
  check("a freed slot can be booked by someone else", rebook.status === "SCHEDULED");

  // ── Saved homes & price-drop alerts ──
  await unsaveHome(a, hidden.reference);
  check("unsave removes it", !(await listSaved(a, ORIGIN)).some((s) => s.property.reference_number === hidden.reference));
  await saveHome(a, hidden.reference);
  await saveHome(a, hidden.reference);
  check("saving twice keeps one entry", (await db.propertyInterest.count({ where: { clientId: a.clientId!, propertyId: hidden.id } })) === 1);
  check("save remembers the price", (await db.propertyInterest.findFirstOrThrow({ where: { clientId: a.clientId!, propertyId: hidden.id } })).priceAtSave === 5_000_000);
  await db.property.update({ where: { id: hidden.id }, data: { price: 4_500_000 } });
  const saved = (await listSaved(a, ORIGIN)).find((s) => s.property.reference_number === hidden.reference);
  check("price drop shows on saved homes", saved?.priceChangePercent === -10, saved?.priceChangePercent);
  check("staff can't use saved homes", await saveHome(omar, hidden.reference).then(() => false, () => true));
  await unsaveHome(a, hidden.reference);
  check("client A unsaving doesn't touch client B's shortlist", (await listSaved(b, ORIGIN)).some((s) => s.property.reference_number === hidden.reference));
  await saveHome(a, hidden.reference);

  // ── Preferences & recommendations ──
  check("preferences reject min > max budget", !preferencesSchema.safeParse({ purpose: "SALE", budgetMin: 9, budgetMax: 1 }).success);
  check("preferences reject unknown property types", !preferencesSchema.safeParse({ types: ["CASTLE"] }).success);
  await updatePreferences(a, preferencesSchema.parse({ purpose: "sale", types: ["VILLA"], areas: ["West Bay"], bedrooms: 3, budgetMin: null, budgetMax: 6_000_000, requirements: "Garden" }));
  const prefs = await getPreferences(a);
  check("preferences round-trip", prefs.purpose === "SALE" && prefs.types[0] === "VILLA" && prefs.areas[0] === "West Bay" && prefs.bedrooms === 3 && prefs.budgetMax === 6_000_000);
  const client = await db.client.findUniqueOrThrow({ where: { id: a.clientId! } });
  check("preferences are written to the CRM client record", client.budgetMax === 6_000_000 && client.requirements === "Garden");
  const match = await createProperty(omar, { ...base, title: "Recommendation test villa", price: 5_500_000, websitePublished: true });
  const recs = await recommendations(a, ORIGIN);
  check("recommendations use preferences", recs.basedOn === "preferences");
  check("recommendations are live sale listings", recs.items.length > 0 && recs.items.every((r) => r.property.purpose === "sale"));
  check("best match is the new villa in West Bay", recs.items[0]?.property.reference_number === match.reference, recs.items.slice(0, 3));
  check("homes already saved or viewed aren't recommended again", !recs.items.some((r) => r.property.reference_number === hidden.reference));
  const c = await registerClientAccount(registerClientSchema.parse({ name: "Web Client C", email: "web.c@example.com", phone: "+974 5000 6666", password: "WebClient2026" }));
  check("fresh clients get featured homes", (await recommendations(c, ORIGIN)).basedOn === "featured");

  console.log(`website tests: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
