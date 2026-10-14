import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ReservationStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { CLIENT_APP_URL } from "@/lib/env";
import { formatDateTime, formatMoney } from "@/lib/format";
import { isManager, isStaff, type Actor } from "@/lib/permissions";
import { like } from "@/lib/search";
import { logActivity } from "./activity";
import { reservationCreated, reservationUpdate, type BankDetails } from "./email-templates";
import { queueMail } from "./mail";
import { publicCardSelect, publicWhere, toPublicCard } from "./public-listings";
import { nextReference } from "./references";
import { notifyWebsite } from "./website-sync";
import type { Tx } from "./types";

/**
 * Reservations: a client reserves a home from the website by paying a booking deposit.
 *
 *   AWAITING_PAYMENT ──(client uploads the Fawran / transfer receipt)──▶ PAYMENT_SUBMITTED
 *   PAYMENT_SUBMITTED ──(agent/manager checks the bank)──▶ CONFIRMED  (property → Reserved)
 *   any open state ──(client, staff, or unpaid after the hold time)──▶ CANCELLED
 *
 * Payment methods: Fawran / bank transfer to the company account (Settings). The online card
 * gateway is shown as "coming soon".
 */

type PortalActor = Actor & { clientId?: string | null };

const OPEN: ReservationStatus[] = ["AWAITING_PAYMENT", "PAYMENT_SUBMITTED"];
const ACTIVE: ReservationStatus[] = [...OPEN, "CONFIRMED"];
const manageUrl = () => `${CLIENT_APP_URL}/en/dashboard/bookings#reservations`;

/** The client's sign-in e-mail (the one they use on the website), else the CRM contact e-mail. */
const emailOf = (c: { email: string | null; portalUser: { email: string } | null }) => c.portalUser?.email ?? c.email;

function clientIdOf(actor: PortalActor) {
  if (actor.role !== "CLIENT" || !actor.clientId) throw forbidden("This area is for client accounts.");
  return actor.clientId;
}

async function settings() {
  return db.settings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
}

export function bankDetails(cfg: Awaited<ReturnType<typeof settings>>): BankDetails {
  return {
    bankName: cfg.bankName,
    accountName: cfg.bankAccountName,
    iban: cfg.bankIban,
    accountNumber: cfg.bankAccountNumber,
    swift: cfg.bankSwift,
    fawranAlias: cfg.fawranAlias,
    instructions: cfg.paymentInstructions,
  };
}

/** What a client can pay with right now. */
export async function paymentOptions() {
  const cfg = await settings();
  return {
    methods: [
      { method: "FAWRAN" as const, label: "Fawran / bank transfer", enabled: cfg.fawranEnabled && Boolean(cfg.bankIban || cfg.fawranAlias), comingSoon: false },
      { method: "CARD" as const, label: "Debit / credit card", enabled: false, comingSoon: true },
    ],
    bank: bankDetails(cfg),
    holdHours: cfg.reservationHoldHours,
  };
}

export function depositFor(property: { price: number; purpose: "SALE" | "RENT"; bookingDeposit: number | null }, cfg: { saleDepositPercent: number; rentDepositMonths: number }) {
  if (property.bookingDeposit) return property.bookingDeposit;
  if (property.purpose === "SALE") return Math.round((property.price * cfg.saleDepositPercent) / 100 / 100) * 100;
  return property.price * Math.max(1, cfg.rentDepositMonths);
}

async function liveProperty(ref: string) {
  const property = await db.property.findFirst({
    where: { AND: [publicWhere, { OR: [{ reference: ref }, { id: ref }] }] },
    select: { id: true, reference: true, title: true, status: true, price: true, currency: true, purpose: true, bookingDeposit: true, agentId: true },
  });
  if (!property) throw notFound("Listing");
  return property;
}

// ───────────────────────────── Client (website) ─────────────────────────────

/** Deposit, payment methods and bank details before reserving. */
export async function reservationQuote(actor: PortalActor, ref: string) {
  const clientId = clientIdOf(actor);
  const [property, cfg, options] = await Promise.all([liveProperty(ref), settings(), paymentOptions()]);
  const existing = await db.reservation.findFirst({ where: { clientId, propertyId: property.id, status: { in: ACTIVE } }, select: { id: true, reference: true, status: true } });
  return {
    property: { reference: property.reference, title: property.title, price: property.price, currency: property.currency, purpose: property.purpose },
    available: property.status === "AVAILABLE",
    amount: depositFor(property, cfg),
    currency: property.currency,
    existing,
    ...options,
  };
}

const clientReservationSelect = {
  id: true, reference: true, status: true, amount: true, currency: true, method: true, payBy: true, payerName: true, paymentReference: true,
  submittedAt: true, verifiedAt: true, cancelReason: true, createdAt: true,
  agent: { select: { name: true, phone: true, email: true } },
  property: { select: publicCardSelect },
  documents: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, fileName: true, createdAt: true } },
} satisfies Prisma.ReservationSelect;

export async function listClientReservations(actor: PortalActor, origin: string) {
  const clientId = clientIdOf(actor);
  const [rows, options] = await Promise.all([
    db.reservation.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 50, select: clientReservationSelect }),
    paymentOptions(),
  ]);
  return {
    items: rows.map(({ property, ...r }) => ({ ...r, canCancel: OPEN.includes(r.status), canUpload: OPEN.includes(r.status), property: toPublicCard(property, origin) })),
    ...options,
  };
}

export async function createReservation(actor: PortalActor, input: { property: string; method: "FAWRAN" | "CARD"; note: string | null }, origin: string) {
  const clientId = clientIdOf(actor);
  if (input.method === "CARD") throw invalid("Card payments are coming soon. Please choose Fawran / bank transfer.", { method: ["Coming soon"] });
  const [property, cfg] = await Promise.all([liveProperty(input.property), settings()]);
  if (!cfg.fawranEnabled || !(cfg.bankIban || cfg.fawranAlias)) throw invalid("Online reservations are not open yet. Please contact your agent.");
  if (property.status !== "AVAILABLE") throw conflict("This home is already reserved. Ask your agent about similar homes.");
  const mine = await db.reservation.findFirst({ where: { clientId, propertyId: property.id, status: { in: ACTIVE } }, select: { reference: true } });
  if (mine) throw conflict(`You already have reservation ${mine.reference} for this home.`);

  const amount = depositFor(property, cfg);
  const payBy = new Date(Date.now() + cfg.reservationHoldHours * 3_600_000);
  const result = await db.$transaction(async (tx) => {
    const client = await tx.client.findUniqueOrThrow({ where: { id: clientId }, select: { fullName: true, email: true, agentId: true, portalUser: { select: { email: true } } } });
    const agentId = property.agentId ?? client.agentId;
    const reference = await nextReference(tx, "reservation", "RS");
    const reservation = await tx.reservation.create({
      data: { reference, propertyId: property.id, clientId, agentId, amount, currency: property.currency, method: "FAWRAN", payBy, clientNote: input.note },
      select: { id: true, reference: true },
    });
    await tx.propertyInterest.upsert({
      where: { propertyId_clientId: { propertyId: property.id, clientId } },
      create: { propertyId: property.id, clientId, priceAtSave: property.price },
      update: {},
    });
    await tx.task.create({
      data: {
        title: `New reservation ${reference}: ${property.reference} for ${client.fullName}`,
        description: `${client.fullName} reserved ${property.reference} on the website. Deposit ${formatMoney(amount, property.currency)} by Fawran / bank transfer, due by ${formatDateTime(payBy)}. Call them to guide the payment.${input.note ? ` Note: “${input.note}”` : ""}`,
        type: "CLIENT_FOLLOW_UP", priority: "HIGH", dueDate: new Date(Math.min(payBy.getTime(), Date.now() + 4 * 3_600_000)),
        clientId, propertyId: property.id, assigneeId: agentId, autoKey: `reservation:${reservation.id}`,
        events: { create: { type: "CREATED", message: "Created automatically from a website reservation" } },
      },
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "RESERVATION", entityId: reservation.id, entityLabel: reference, userId: null, clientId, propertyId: property.id,
      description: `${client.fullName} reserved ${property.reference} on the website (deposit ${formatMoney(amount, property.currency)})`,
    });
    return { reservation, client };
  });
  queueMail(
    emailOf(result.client),
    "reservation-created",
    reservationCreated({ name: result.client.fullName, reference: result.reservation.reference, property: `${property.title} (${property.reference})`, amount, currency: property.currency, payBy: formatDateTime(payBy), bank: bankDetails(cfg), manageUrl: manageUrl() }),
  );
  const row = await db.reservation.findUniqueOrThrow({ where: { id: result.reservation.id }, select: clientReservationSelect });
  const { property: card, ...rest } = row;
  return { ...rest, canCancel: true, canUpload: true, property: toPublicCard(card, origin) };
}

/** Optional payment details typed by the client (payer name, Fawran reference). */
export async function updatePaymentDetails(actor: PortalActor, id: string, input: { payerName: string | null; paymentReference: string | null }) {
  const clientId = clientIdOf(actor);
  const r = await db.reservation.findFirst({ where: { id, clientId }, select: { status: true } });
  if (!r) throw notFound("Reservation");
  if (!OPEN.includes(r.status)) throw invalid("This reservation can no longer be changed.");
  await db.reservation.update({ where: { id }, data: { payerName: input.payerName, paymentReference: input.paymentReference } });
  return { saved: true };
}

/** Called after the client uploads a proof of payment for a reservation. */
export async function onProofUploaded(reservationId: string) {
  const r = await db.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, reference: true, status: true, amount: true, currency: true, agentId: true, clientId: true, propertyId: true, client: { select: { fullName: true, email: true, portalUser: { select: { email: true } } } }, property: { select: { reference: true, title: true } } },
  });
  if (!r || r.status !== "AWAITING_PAYMENT") return;
  await db.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id: r.id }, data: { status: "PAYMENT_SUBMITTED", submittedAt: new Date() } });
    await tx.task.updateMany({ where: { autoKey: `reservation:${r.id}`, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.task.create({
      data: {
        title: `Verify payment for ${r.reference} (${r.client.fullName})`,
        description: `The client uploaded a payment proof for ${formatMoney(r.amount, r.currency)}. Check the bank / Fawran, then confirm the reservation in Reservations.`,
        type: "CLIENT_FOLLOW_UP", priority: "URGENT", dueDate: new Date(Date.now() + 2 * 3_600_000),
        clientId: r.clientId, propertyId: r.propertyId, assigneeId: r.agentId, autoKey: `verify-payment:${r.id}`,
        events: { create: { type: "CREATED", message: "Created automatically: payment proof uploaded" } },
      },
    });
    await logActivity(tx, {
      action: "STATUS_CHANGED", entityType: "RESERVATION", entityId: r.id, entityLabel: r.reference, userId: null, clientId: r.clientId, propertyId: r.propertyId,
      description: `${r.client.fullName} uploaded the payment proof for ${r.reference}`,
    });
  });
  queueMail(emailOf(r.client), "reservation-submitted", reservationUpdate({ name: r.client.fullName, reference: r.reference, property: r.property.title, status: "SUBMITTED", amount: r.amount, currency: r.currency, manageUrl: manageUrl() }));
}

export async function cancelClientReservation(actor: PortalActor, id: string, reason: string | null) {
  const clientId = clientIdOf(actor);
  const r = await db.reservation.findFirst({ where: { id, clientId }, select: { id: true, status: true } });
  if (!r) throw notFound("Reservation");
  if (!OPEN.includes(r.status)) throw invalid("Confirmed reservations can only be cancelled by your agent.");
  await cancelInTx(r.id, `Cancelled by the client${reason ? `: ${reason}` : ""}`, null);
  return { cancelled: true };
}

// ───────────────────────────── Staff (agent app) ─────────────────────────────

function staffScope(actor: Actor): Prisma.ReservationWhereInput {
  if (!isStaff(actor)) return { id: { in: [] } };
  return isManager(actor) ? {} : { OR: [{ agentId: actor.id }, { client: { agentId: actor.id } }] };
}

export const RESERVATION_FILTERS = ["open", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED", "CANCELLED"] as const;

export async function listReservations(actor: Actor, filter: (typeof RESERVATION_FILTERS)[number] | undefined, q?: string) {
  const where: Prisma.ReservationWhereInput = {
    AND: [
      staffScope(actor),
      filter === "open" ? { status: { in: OPEN } } : filter ? { status: filter } : {},
      q ? { OR: [{ reference: like(q) }, { client: { fullName: like(q) } }, { property: { reference: like(q) } }] } : {},
    ],
  };
  const rows = await db.reservation.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: {
      id: true, reference: true, status: true, amount: true, currency: true, method: true, payBy: true, payerName: true, paymentReference: true,
      submittedAt: true, verifiedAt: true, cancelReason: true, clientNote: true, createdAt: true,
      client: { select: { id: true, fullName: true, phone: true } },
      property: { select: { id: true, reference: true, title: true, status: true } },
      agent: { select: { id: true, name: true, avatarUrl: true } },
      verifiedBy: { select: { name: true } },
      documents: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, fileName: true } },
    },
  });
  // Payments to verify first, then those awaiting payment, then the rest (newest first).
  const rank: Record<ReservationStatus, number> = { PAYMENT_SUBMITTED: 0, AWAITING_PAYMENT: 1, CONFIRMED: 2, CANCELLED: 3 };
  return rows.sort((a, b) => rank[a.status] - rank[b.status]);
}

export type ReservationRow = Awaited<ReturnType<typeof listReservations>>[number];

async function scoped(actor: Actor, id: string) {
  const r = await db.reservation.findFirst({ where: { AND: [{ id }, staffScope(actor)] }, select: { id: true, status: true } });
  if (!r) throw notFound("Reservation");
  return r;
}

/** Payment received: the reservation is confirmed and the listing is marked Reserved. */
export async function confirmReservation(actor: Actor, id: string) {
  const current = await scoped(actor, id);
  if (!OPEN.includes(current.status)) throw invalid("Only reservations awaiting payment can be confirmed.");
  const r = await db.$transaction(async (tx) => {
    const r = await tx.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", verifiedById: actor.id, verifiedAt: new Date() },
      select: { id: true, reference: true, amount: true, currency: true, clientId: true, propertyId: true, client: { select: { fullName: true, email: true, portalUser: { select: { email: true } } } }, property: { select: { reference: true, title: true, status: true } } },
    });
    await tx.task.updateMany({ where: { autoKey: { in: [`reservation:${id}`, `verify-payment:${id}`] }, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "COMPLETED", completedAt: new Date() } });
    if (r.property.status === "AVAILABLE") {
      await tx.property.update({ where: { id: r.propertyId }, data: { status: "RESERVED" } });
      await logActivity(tx, {
        action: "STATUS_CHANGED", entityType: "PROPERTY", entityId: r.propertyId, entityLabel: r.property.reference, userId: actor.id, propertyId: r.propertyId, clientId: r.clientId,
        description: `${r.property.reference} reserved for ${r.client.fullName} (${r.reference})`, meta: { from: "AVAILABLE", to: "RESERVED" },
      });
    }
    await logActivity(tx, {
      action: "COMPLETED", entityType: "RESERVATION", entityId: id, entityLabel: r.reference, userId: actor.id, clientId: r.clientId, propertyId: r.propertyId,
      description: `Confirmed the ${formatMoney(r.amount, r.currency)} deposit for ${r.reference}`,
    });
    return r;
  });
  notifyWebsite();
  queueMail(emailOf(r.client), "reservation-confirmed", reservationUpdate({ name: r.client.fullName, reference: r.reference, property: r.property.title, status: "CONFIRMED", amount: r.amount, currency: r.currency, manageUrl: manageUrl() }));
  return { confirmed: true };
}

async function cancelInTx(id: string, reason: string, actorId: string | null, txIn?: Tx) {
  const run = async (tx: Tx) => {
    const r = await tx.reservation.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: reason },
      select: { id: true, reference: true, amount: true, currency: true, clientId: true, propertyId: true, client: { select: { fullName: true, email: true, portalUser: { select: { email: true } } } }, property: { select: { reference: true, title: true, status: true } } },
    });
    await tx.task.updateMany({ where: { autoKey: { in: [`reservation:${id}`, `verify-payment:${id}`] }, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    let released = false;
    if (r.property.status === "RESERVED") {
      const holding = await tx.reservation.count({ where: { propertyId: r.propertyId, status: "CONFIRMED", id: { not: id } } });
      const deals = await tx.deal.count({ where: { propertyId: r.propertyId, status: "PENDING_CONTRACT" } });
      if (!holding && !deals) {
        await tx.property.update({ where: { id: r.propertyId }, data: { status: "AVAILABLE" } });
        released = true;
      }
    }
    await logActivity(tx, {
      action: "CANCELLED", entityType: "RESERVATION", entityId: id, entityLabel: r.reference, userId: actorId, clientId: r.clientId, propertyId: r.propertyId,
      description: `${r.reference} cancelled — ${reason}${released ? ` (${r.property.reference} is available again)` : ""}`,
    });
    return { r, released };
  };
  const { r, released } = txIn ? await run(txIn) : await db.$transaction(run);
  if (released) notifyWebsite();
  queueMail(emailOf(r.client), "reservation-cancelled", reservationUpdate({ name: r.client.fullName, reference: r.reference, property: r.property.title, status: "CANCELLED", amount: r.amount, currency: r.currency, reason, manageUrl: manageUrl() }));
}

export async function cancelReservation(actor: Actor, id: string, reason: string) {
  const current = await scoped(actor, id);
  if (current.status === "CANCELLED") throw conflict("This reservation is already cancelled.");
  if (current.status === "CONFIRMED" && !isManager(actor)) throw forbidden("Only managers can cancel a confirmed reservation (the deposit may need a refund).");
  await cancelInTx(id, reason, actor.id);
  return { cancelled: true };
}

/** Scheduler: unpaid reservations past their pay-by time are released. */
export async function expireUnpaidReservations(now = new Date()) {
  const due = await db.reservation.findMany({ where: { status: "AWAITING_PAYMENT", payBy: { lt: now } }, take: 100, select: { id: true } });
  for (const r of due) await cancelInTx(r.id, "Not paid in time", null);
  return due.length;
}
