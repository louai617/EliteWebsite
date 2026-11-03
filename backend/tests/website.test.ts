/**
 * Tests for the website link: the public listings API the website (eliterealestate.qa) reads,
 * publish/unpublish from the agent app, and guest viewing bookings / enquiries (the website has
 * no visitor accounts).
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { atLocalHour, businessDate, shiftDate, weekday } from "@/lib/business-day";
import { propertySchema, updatePropertySchema } from "@/schemas/property";
import { guestBookingSchema, publicLeadSchema } from "@/schemas/website";
import { createProperty, getPropertyForEdit, setPropertyStatus, updateProperty } from "@/services/properties";
import { setViewingStatus } from "@/services/viewings";
import { getPublicListing, listPublicListings, PUBLIC_STATUSES } from "@/services/public-listings";
import { bookGuestViewing, bookingSlots } from "@/services/guest-bookings";
import { addAvailability, availabilityBetween, removeAvailability } from "@/services/availability";
import { availabilitySchema } from "@/schemas/availability";
import { createPublicLead } from "@/services/website-leads";
import { listLeads } from "@/services/leads";
import { testMailbox } from "@/services/mail";
import { isSelfOrigin, requestOrigin } from "@/lib/cors";
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
  const u = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true } });
  return u as { id: string; role: Role };
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

  // ── Guest viewing bookings (no visitor accounts) ──
  const day = weekdayAhead(3);
  await rejects("can't book an unpublished listing", async () => {
    await db.property.update({ where: { id: hidden.id }, data: { websitePublished: false } });
    try {
      await bookingSlots(hidden.reference, day);
    } finally {
      await db.property.update({ where: { id: hidden.id }, data: { websitePublished: true } });
    }
  }, /not found/i);
  // ── Free for viewings: only the agent's marked hours are offered ──
  const none = await bookingSlots(hidden.reference, day);
  check("no free time marked → nothing to book", none.slots.length === 0 && none.freeDays.length === 0);
  const free = (over: Record<string, unknown> = {}) => availabilitySchema.parse({ date: day, from: "09:00", to: "20:00", repeatWeeks: 0, ...over });
  const aisha = await actorFor("aisha@elite.qa");
  const fatima = await actorFor("fatima@elite.qa");
  await rejects("agents can't set another agent's free time", () => addAvailability(aisha, free({ agentId: omar.id })), /own free time/i);
  await rejects("past days are refused", () => addAvailability(omar, free({ date: shiftDate(businessDate(), -1) })), /later day/i);
  await rejects("blocks shorter than a viewing are refused", () => addAvailability(omar, free({ from: "10:00", to: "10:30" })), /at least 45/i);
  check("schema: the end must be after the start", !availabilitySchema.safeParse({ date: day, from: "12:00", to: "11:00" }).success);
  const morning = await addAvailability(fatima, free({ agentId: omar.id, from: "16:00", to: "18:00" }));
  check("managers can mark an agent free", morning.added === 1);
  const repeated = await addAvailability(omar, free({ from: "09:00", to: "20:00", repeatWeeks: 2 }));
  check("repeating adds the same hours on the next weeks, skipping a day that already has free time", repeated.added === 2 && repeated.skipped === 1, repeated);
  const blocksThatDay = await availabilityBetween(omar, atLocalHour(day, 0), atLocalHour(shiftDate(day, 1), 0));
  check("the day keeps the block that was there first", blocksThatDay.length === 1 && blocksThatDay[0].agentId === omar.id && blocksThatDay[0].startsAt.getTime() === atLocalHour(day, 16).getTime(), blocksThatDay.length);
  check("agents only see their own blocks", (await availabilityBetween(aisha, atLocalHour(day, 0), atLocalHour(shiftDate(day, 1), 0))).length === 0);
  await removeAvailability(omar, blocksThatDay[0].id);
  await addAvailability(omar, free({ from: "09:00", to: "12:00" }));
  await addAvailability(omar, free({ from: "15:00", to: "20:00" }));
  const slots = await bookingSlots(hidden.reference, day);
  const labels = slots.slots.map((s) => s.label);
  check("only times inside the free hours are offered", labels[0] === "09:00" && labels.includes("11:00") && !labels.includes("11:30") && !labels.includes("13:00") && labels.includes("15:00") && labels.at(-1) === "19:00", labels);
  check("days with free time are listed for the website", slots.freeDays.includes(day) && slots.freeDays.includes(shiftDate(day, 7)), slots.freeDays);
  check("past days have no slots", (await bookingSlots(hidden.reference, shiftDate(businessDate(), -1))).slots.length === 0);
  check("slots never expose who booked", !/name|phone|email|lead|client/i.test(JSON.stringify(slots.slots[0])));

  const guest = (over: Record<string, unknown> = {}) =>
    guestBookingSchema.parse({ property: hidden.reference, startsAt: atLocalHour(day, 10).toISOString(), name: "Web Visitor A", phone: "+974 5000 4444", email: "web.a@example.com", note: "Coming with family", ...over });
  check("guest booking needs a name, phone and e-mail", !guestBookingSchema.safeParse({ property: hidden.reference, startsAt: new Date().toISOString() }).success);
  check("guest booking rejects a bad e-mail", !guestBookingSchema.safeParse({ property: hidden.reference, startsAt: new Date().toISOString(), name: "X", phone: "+974 5000 4444", email: "nope" }).success);

  const leadsBefore = await db.lead.count();
  const at10 = atLocalHour(day, 10);
  const booked = await bookGuestViewing(guest());
  check("booking returns the time and address", booked.startsAt === at10.toISOString() && booked.address.length > 0 && booked.reference === hidden.reference);
  const viewing = await db.viewing.findFirstOrThrow({ where: { propertyId: hidden.id, startsAt: at10 }, include: { lead: true } });
  check("booking is a SCHEDULED website viewing for the listing agent", viewing.status === "SCHEDULED" && viewing.bookedByClient && viewing.agentId === omar.id && viewing.clientNote === "Coming with family");
  check("booking creates a WEBSITE lead with the visitor's details", viewing.lead?.source === "WEBSITE" && viewing.lead.fullName === "Web Visitor A" && viewing.lead.email === "web.a@example.com" && viewing.lead.agentId === omar.id);
  check("no CRM client is created for a visitor", viewing.clientId == null);
  check("exactly one new lead", (await db.lead.count()) === leadsBefore + 1);
  check("lead stays New until the agent calls (24-hour rule applies)", viewing.lead?.status === "NEW");
  const listed = (await listLeads(omar, { page: 1, pageSize: 50, q: "Web Visitor A", sort: "createdAt", dir: "desc" }, {})).items[0];
  check("the lead is marked as having booked a viewing", listed?.viewings.length === 1 && new Date(listed.viewings[0].startsAt).getTime() === at10.getTime());
  const plain = (await listLeads(omar, { page: 1, pageSize: 50, sort: "createdAt", dir: "desc" }, {})).items.find((l) => l.source !== "WEBSITE");
  check("leads that didn't book online have no mark", !plain || plain.viewings.length === 0);
  const confirmTask = await db.task.findFirst({ where: { viewingId: viewing.id, autoKey: { startsWith: "confirm-booking:" } } });
  check("agent gets a 'confirm website booking' task", confirmTask?.assigneeId === omar.id && confirmTask.status !== "COMPLETED" && confirmTask.leadId === viewing.leadId);
  await new Promise((r) => setTimeout(r, 50));
  const mail = [...testMailbox()].reverse().find((m) => m.to === "web.a@example.com");
  check("visitor gets a 'viewing requested' e-mail with the property link", mail?.template === "viewing-booked" && mail.email.html.includes(`/en/properties/${hidden.reference}`), mail?.template);
  const taken = (await bookingSlots(hidden.reference, day)).slots.find((s) => s.startsAt === at10.toISOString());
  check("booked slot is no longer offered", taken && !taken.available);

  await rejects("same phone can't book the same home twice", () => bookGuestViewing(guest({ startsAt: atLocalHour(day, 15).toISOString(), phone: "0097450004444" })), /already booked/i);
  check("the repeat attempt reused the visitor's lead (no duplicate lead)", (await db.lead.count()) === leadsBefore + 1);
  await rejects("another visitor can't take the agent's slot", () => bookGuestViewing(guest({ name: "Web Visitor B", phone: "+974 5000 5555", email: "web.b@example.com" })), /just taken/i);
  await rejects("times outside the free hours are rejected", () => bookGuestViewing(guest({ startsAt: atLocalHour(day, 13).toISOString(), phone: "+974 5000 5555" })), /available times/i);
  await rejects("off-grid times are rejected", () => bookGuestViewing(guest({ startsAt: atLocalHour(day, 10, 10).toISOString(), phone: "+974 5000 5555" })), /available times/i);
  await rejects("too-soon times are rejected", () => bookGuestViewing(guest({ startsAt: atLocalHour(businessDate(), 9).toISOString(), phone: "+974 5000 5555" })), /available times|2 hours/i);
  await rejects("bookings more than 30 days ahead are rejected", () => bookGuestViewing(guest({ startsAt: atLocalHour(weekdayAhead(40), 10).toISOString(), phone: "+974 5000 5555" })), /30 days/i);

  // Agent confirms in the CRM → the visitor is e-mailed
  await setViewingStatus(omar, viewing.id, "CONFIRMED");
  check("confirming in the CRM completes the confirm task", (await db.task.findUniqueOrThrow({ where: { id: confirmTask!.id } })).status === "COMPLETED");
  await new Promise((r) => setTimeout(r, 50));
  check("visitor is e-mailed when the agent confirms", [...testMailbox()].some((m) => m.to === "web.a@example.com" && m.template === "viewing-confirmed"));
  await setViewingStatus(omar, viewing.id, "CANCELLED");
  const rebook = await bookGuestViewing(guest({ name: "Web Visitor B", phone: "+974 5000 5555", email: "web.b@example.com" }));
  check("a freed slot can be booked by someone else", rebook.startsAt === at10.toISOString());

  // ── Contact form ──
  const enquiry = await createPublicLead(publicLeadSchema.parse({ fullName: "Contact Form", phone: "+974 5000 7777", message: "Hi", propertyRef: hidden.reference }));
  const enquiryLead = await db.lead.findUniqueOrThrow({ where: { id: enquiry.id! }, include: { interests: true } });
  check("contact form lead goes to the listing agent with the listing attached", enquiryLead.agentId === omar.id && enquiryLead.interests.some((i) => i.propertyId === hidden.id));

  // ── Same-origin check behind nginx (request.url keeps 127.0.0.1:3002) ──
  const proxied = (origin: string, headers: Record<string, string> = { host: "app.eliterealestate.qa", "x-forwarded-proto": "https" }) =>
    isSelfOrigin(new Request("http://127.0.0.1:3002/api/properties/x/photos", { method: "POST", headers }), origin);
  check("behind the proxy the public origin comes from Host and X-Forwarded-Proto", requestOrigin(new Request("http://127.0.0.1:3002/api/x", { headers: { host: "app.eliterealestate.qa", "x-forwarded-proto": "https" } })) === "https://app.eliterealestate.qa");
  check("uploads from the agent app's own pages pass behind the proxy", proxied("https://app.eliterealestate.qa"));
  check("another site is still refused", !proxied("https://evil.example") && !proxied("https://eliterealestate.qa.evil.example"));
  check("plain http is not the https site", !proxied("http://app.eliterealestate.qa"));
  check("without a proxy the request's own origin works", isSelfOrigin(new Request("http://localhost:3002/api/x", { method: "POST", headers: { host: "localhost:3002" } }), "http://localhost:3002"));

  console.log(`website tests: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
