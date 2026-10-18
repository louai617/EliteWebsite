import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { ReservationStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { keyedHash } from "@/lib/auth/secret";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { CLIENT_APP_URL } from "@/lib/env";
import { formatDateTime, formatMoney } from "@/lib/format";
import { isManager, isStaff, type Actor } from "@/lib/permissions";
import { like } from "@/lib/search";
import type { guestReservationSchema } from "@/schemas/website";
import type { z } from "zod";
import { logActivity } from "./activity";
import { reservationCreated, reservationUpdate, type BankDetails } from "./email-templates";
import { queueMail } from "./mail";
import { publicCardSelect, publicWhere, toPublicCard } from "./public-listings";
import { nextReference } from "./references";
import { deleteDocumentFile, safeFileName, saveDocumentFile } from "./storage";
import { notifyWebsite } from "./website-sync";
import { websiteLeadInTx } from "./website-leads";
import type { Tx } from "./types";

/**
 * Reservations: a visitor reserves a home from the website by paying a booking deposit.
 * There are no visitor accounts: the visitor leaves their name, phone and e-mail, becomes a
 * WEBSITE lead for the listing's agent, and gets a private link (e-mailed, and shown once in
 * the browser) to view the reservation and upload the Fawran / transfer receipt.
 *
 *   AWAITING_PAYMENT ──(visitor uploads the Fawran / transfer receipt)──▶ PAYMENT_SUBMITTED
 *   PAYMENT_SUBMITTED ──(agent/manager checks the bank)──▶ CONFIRMED  (property → Reserved)
 *   any open state ──(visitor, staff, or unpaid after the hold time)──▶ CANCELLED
 *
 * Only a keyed hash of the link token is stored. Payment methods: Fawran / bank transfer to the
 * company account (Settings). The online card gateway is shown as "coming soon".
 */

const OPEN: ReservationStatus[] = ["AWAITING_PAYMENT", "PAYMENT_SUBMITTED"];
const ACTIVE: ReservationStatus[] = [...OPEN, "CONFIRMED"];
const MAX_RECEIPTS = 5;

const tokenHash = (token: string) => keyedHash(`reservation-link:${token}`);
const newToken = () => randomBytes(32).toString("base64url");
const linkFor = (token: string) => `${CLIENT_APP_URL}/en/reservation/${token}`;

/** Who the reservation is for: the visitor's details, or the CRM client for older reservations. */
const personSelect = {
  contactName: true,
  contactEmail: true,
  client: { select: { fullName: true, email: true, portalUser: { select: { email: true } } } },
} satisfies Prisma.ReservationSelect;
type Person = Prisma.ReservationGetPayload<{ select: typeof personSelect }>;
const nameOf = (r: Person) => r.contactName ?? r.client?.fullName ?? "there";
const emailOf = (r: Person) => r.contactEmail ?? r.client?.portalUser?.email ?? r.client?.email ?? null;

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

// ───────────────────────────── Website (no account) ─────────────────────────────

/** Deposit, payment methods and bank details before reserving. */
export async function reservationQuote(ref: string) {
  const [property, cfg, options] = await Promise.all([liveProperty(ref), settings(), paymentOptions()]);
  return {
    property: { reference: property.reference, title: property.title, price: property.price, currency: property.currency, purpose: property.purpose },
    available: property.status === "AVAILABLE",
    amount: depositFor(property, cfg),
    currency: property.currency,
    ...options,
  };
}

/** Reserve a home. Returns the private link token once (it is also e-mailed). */
export async function createGuestReservation(input: z.output<typeof guestReservationSchema>) {
  if (input.method === "CARD") throw invalid("Card payments are coming soon. Please choose Fawran / bank transfer.", { method: ["Coming soon"] });
  const [property, cfg] = await Promise.all([liveProperty(input.property), settings()]);
  if (!cfg.fawranEnabled || !(cfg.bankIban || cfg.fawranAlias)) throw invalid("Online reservations are not open yet. Please contact the agent.");
  if (property.status !== "AVAILABLE") throw conflict("This home is already reserved. Ask the agent about similar homes.");
  const listing = await db.property.findUniqueOrThrow({ where: { id: property.id }, select: { id: true, reference: true, purpose: true, area: true, agentId: true } });

  const amount = depositFor(property, cfg);
  const payBy = new Date(Date.now() + cfg.reservationHoldHours * 3_600_000);
  const token = newToken();
  const result = await db.$transaction(async (tx) => {
    const lead = await websiteLeadInTx(tx, { fullName: input.name, phone: input.phone, email: input.email }, listing, "Website reservation", input.note);
    const open = await tx.reservation.findFirst({ where: { leadId: lead.id, propertyId: property.id, status: { in: ACTIVE } }, select: { id: true } });
    if (open) return { duplicateOf: open.id, reservation: null };

    const agentId = property.agentId ?? lead.agentId;
    const reference = await nextReference(tx, "reservation", "RS");
    const reservation = await tx.reservation.create({
      data: {
        reference, propertyId: property.id, leadId: lead.id, agentId, amount, currency: property.currency, method: "FAWRAN", payBy, clientNote: input.note,
        contactName: input.name, contactPhone: input.phone, contactEmail: input.email, accessTokenHash: tokenHash(token),
      },
      select: { id: true, reference: true },
    });
    await tx.task.create({
      data: {
        title: `New reservation ${reference}: ${property.reference} for ${input.name}`,
        description: `${input.name} (${input.phone}, ${input.email}) reserved ${property.reference} on the website. Deposit ${formatMoney(amount, property.currency)} by Fawran / bank transfer, due by ${formatDateTime(payBy)}. Call them to guide the payment.${input.note ? ` Note: “${input.note}”` : ""}`,
        type: "CLIENT_FOLLOW_UP", priority: "HIGH", dueDate: new Date(Math.min(payBy.getTime(), Date.now() + 4 * 3_600_000)),
        leadId: lead.id, propertyId: property.id, assigneeId: agentId, autoKey: `reservation:${reservation.id}`,
        events: { create: { type: "CREATED", message: "Created automatically from a website reservation" } },
      },
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "RESERVATION", entityId: reservation.id, entityLabel: reference, userId: null, leadId: lead.id, propertyId: property.id,
      description: `${input.name} reserved ${property.reference} on the website (deposit ${formatMoney(amount, property.currency)})`,
    });
    return { duplicateOf: null, reservation };
  });

  if (!result.reservation) {
    // Same visitor, same home: send a fresh link to the e-mail on the existing reservation
    // (never to the address just typed, and nothing about it is shown here).
    if (result.duplicateOf) await resendLink(result.duplicateOf);
    throw conflict("You already have a reservation for this home. We've e-mailed its link to the address you used when reserving.");
  }
  queueMail(
    input.email,
    "reservation-created",
    reservationCreated({ name: input.name, reference: result.reservation.reference, property: `${property.title} (${property.reference})`, amount, currency: property.currency, payBy: formatDateTime(payBy), bank: bankDetails(cfg), manageUrl: linkFor(token) }),
  );
  return { reference: result.reservation.reference, token };
}

async function resendLink(id: string) {
  const token = newToken();
  const r = await db.reservation.update({
    where: { id },
    data: { accessTokenHash: tokenHash(token) },
    select: { reference: true, amount: true, currency: true, payBy: true, status: true, property: { select: { title: true, reference: true } }, ...personSelect },
  });
  const cfg = await settings();
  const to = emailOf(r);
  if (!to) return;
  if (r.status === "AWAITING_PAYMENT") {
    queueMail(to, "reservation-link", reservationCreated({ name: nameOf(r), reference: r.reference, property: `${r.property.title} (${r.property.reference})`, amount: r.amount, currency: r.currency, payBy: formatDateTime(r.payBy), bank: bankDetails(cfg), manageUrl: linkFor(token) }));
  } else {
    const status = r.status === "CONFIRMED" ? "CONFIRMED" : "SUBMITTED";
    queueMail(to, "reservation-link", reservationUpdate({ name: nameOf(r), reference: r.reference, property: r.property.title, status, amount: r.amount, currency: r.currency, manageUrl: linkFor(token) }));
  }
}

const linkSelect = {
  id: true, reference: true, status: true, amount: true, currency: true, method: true, payBy: true, payerName: true, paymentReference: true,
  submittedAt: true, verifiedAt: true, cancelReason: true, createdAt: true, leadId: true, clientId: true, agentId: true, propertyId: true,
  ...personSelect,
  agent: { select: { name: true, phone: true, email: true } },
  property: { select: publicCardSelect },
  documents: { where: { kind: "PROOF_OF_PAYMENT" }, orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, createdAt: true } },
} satisfies Prisma.ReservationSelect;

async function byToken(token: string) {
  const r = await db.reservation.findUnique({ where: { accessTokenHash: tokenHash(token) }, select: linkSelect });
  if (!r) throw notFound("Reservation");
  return r;
}

/** The private reservation page: status, bank details and the receipts sent so far (file names only). */
export async function reservationByLink(token: string, origin: string) {
  const [r, options] = await Promise.all([byToken(token), paymentOptions()]);
  return {
    reference: r.reference, status: r.status, amount: r.amount, currency: r.currency, method: r.method, payBy: r.payBy,
    payerName: r.payerName, paymentReference: r.paymentReference, submittedAt: r.submittedAt, verifiedAt: r.verifiedAt,
    cancelReason: r.cancelReason, createdAt: r.createdAt, name: nameOf(r),
    agent: r.agent, property: toPublicCard(r.property, origin),
    receipts: r.documents.map((d) => ({ fileName: d.fileName, uploadedAt: d.createdAt })),
    canUpload: OPEN.includes(r.status) && r.documents.length < MAX_RECEIPTS,
    canCancel: OPEN.includes(r.status),
    ...options,
  };
}

/** Optional payment details typed by the visitor (payer name, Fawran reference). */
export async function updatePaymentDetails(token: string, input: { payerName: string | null; paymentReference: string | null }) {
  const r = await byToken(token);
  if (!OPEN.includes(r.status)) throw invalid("This reservation can no longer be changed.");
  await db.reservation.update({ where: { id: r.id }, data: { payerName: input.payerName, paymentReference: input.paymentReference } });
  return { saved: true };
}

/** The visitor uploads the Fawran / transfer receipt: the reservation moves to "payment to verify". */
export async function uploadReceipt(token: string, file: File) {
  const r = await byToken(token);
  if (!OPEN.includes(r.status)) throw invalid("This reservation can no longer be changed.");
  if (r.documents.length >= MAX_RECEIPTS) throw invalid("You've already sent several receipts. Please contact your agent.");
  const saved = await saveDocumentFile(file); // validates type and size first
  try {
    await db.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          kind: "PROOF_OF_PAYMENT", title: `Payment proof for ${r.reference}`,
          fileName: safeFileName(file.name, saved.mimeType), mimeType: saved.mimeType, size: saved.size, storageKey: saved.storageKey,
          reservationId: r.id, leadId: r.leadId, clientId: r.clientId, uploadedByClient: true,
        },
        select: { id: true },
      });
      await logActivity(tx, {
        action: "CREATED", entityType: "DOCUMENT", entityId: doc.id, entityLabel: "Proof of payment", userId: null, leadId: r.leadId, clientId: r.clientId, propertyId: r.propertyId,
        description: `${nameOf(r)} uploaded a payment proof for ${r.reference} on the website`,
      });
    });
  } catch (error) {
    await deleteDocumentFile(saved.storageKey);
    throw error;
  }
  await onProofUploaded(r.id, linkFor(token));
  return { uploaded: true };
}

/** Called after a proof of payment is on file for a reservation. */
export async function onProofUploaded(reservationId: string, manageUrl: string | null = null) {
  const r = await db.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, reference: true, status: true, amount: true, currency: true, agentId: true, clientId: true, leadId: true, propertyId: true, ...personSelect, property: { select: { reference: true, title: true } } },
  });
  if (!r || r.status !== "AWAITING_PAYMENT") return;
  await db.$transaction(async (tx) => {
    await tx.reservation.update({ where: { id: r.id }, data: { status: "PAYMENT_SUBMITTED", submittedAt: new Date() } });
    await tx.task.updateMany({ where: { autoKey: `reservation:${r.id}`, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.task.create({
      data: {
        title: `Verify payment for ${r.reference} (${nameOf(r)})`,
        description: `A payment proof for ${formatMoney(r.amount, r.currency)} was uploaded. Check the bank / Fawran, then confirm the reservation in Reservations.`,
        type: "CLIENT_FOLLOW_UP", priority: "URGENT", dueDate: new Date(Date.now() + 2 * 3_600_000),
        clientId: r.clientId, leadId: r.leadId, propertyId: r.propertyId, assigneeId: r.agentId, autoKey: `verify-payment:${r.id}`,
        events: { create: { type: "CREATED", message: "Created automatically: payment proof uploaded" } },
      },
    });
    await logActivity(tx, {
      action: "STATUS_CHANGED", entityType: "RESERVATION", entityId: r.id, entityLabel: r.reference, userId: null, clientId: r.clientId, leadId: r.leadId, propertyId: r.propertyId,
      description: `${nameOf(r)} uploaded the payment proof for ${r.reference}`,
    });
  });
  queueMail(emailOf(r), "reservation-submitted", reservationUpdate({ name: nameOf(r), reference: r.reference, property: r.property.title, status: "SUBMITTED", amount: r.amount, currency: r.currency, manageUrl }));
}

export async function cancelByLink(token: string, reason: string | null) {
  const r = await byToken(token);
  if (!OPEN.includes(r.status)) throw invalid("Confirmed reservations can only be cancelled by your agent.");
  await cancelInTx(r.id, `Cancelled by the visitor${reason ? `: ${reason}` : ""}`, null);
  return { cancelled: true };
}

// ───────────────────────────── Staff (agent app) ─────────────────────────────

function staffScope(actor: Actor): Prisma.ReservationWhereInput {
  if (!isStaff(actor)) return { id: { in: [] } };
  return isManager(actor) ? {} : { OR: [{ agentId: actor.id }, { client: { agentId: actor.id } }, { lead: { agentId: actor.id } }] };
}

export const RESERVATION_FILTERS = ["open", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED", "CANCELLED"] as const;

export async function listReservations(actor: Actor, filter: (typeof RESERVATION_FILTERS)[number] | undefined, q?: string) {
  const where: Prisma.ReservationWhereInput = {
    AND: [
      staffScope(actor),
      filter === "open" ? { status: { in: OPEN } } : filter ? { status: filter } : {},
      q ? { OR: [{ reference: like(q) }, { contactName: like(q) }, { contactPhone: like(q) }, { client: { fullName: like(q) } }, { property: { reference: like(q) } }] } : {},
    ],
  };
  const rows = await db.reservation.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: {
      id: true, reference: true, status: true, amount: true, currency: true, method: true, payBy: true, payerName: true, paymentReference: true,
      submittedAt: true, verifiedAt: true, cancelReason: true, clientNote: true, createdAt: true,
      contactName: true, contactPhone: true, contactEmail: true,
      client: { select: { id: true, fullName: true, phone: true } },
      lead: { select: { id: true, fullName: true, phone: true } },
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
      select: { id: true, reference: true, amount: true, currency: true, clientId: true, leadId: true, propertyId: true, ...personSelect, property: { select: { reference: true, title: true, status: true } } },
    });
    await tx.task.updateMany({ where: { autoKey: { in: [`reservation:${id}`, `verify-payment:${id}`] }, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "COMPLETED", completedAt: new Date() } });
    if (r.property.status === "AVAILABLE") {
      await tx.property.update({ where: { id: r.propertyId }, data: { status: "RESERVED" } });
      await logActivity(tx, {
        action: "STATUS_CHANGED", entityType: "PROPERTY", entityId: r.propertyId, entityLabel: r.property.reference, userId: actor.id, propertyId: r.propertyId, clientId: r.clientId,
        leadId: r.leadId,
        description: `${r.property.reference} reserved for ${nameOf(r)} (${r.reference})`, meta: { from: "AVAILABLE", to: "RESERVED" },
      });
    }
    await logActivity(tx, {
      action: "COMPLETED", entityType: "RESERVATION", entityId: id, entityLabel: r.reference, userId: actor.id, clientId: r.clientId, leadId: r.leadId, propertyId: r.propertyId,
      description: `Confirmed the ${formatMoney(r.amount, r.currency)} deposit for ${r.reference}`,
    });
    return r;
  });
  notifyWebsite();
  queueMail(emailOf(r), "reservation-confirmed", reservationUpdate({ name: nameOf(r), reference: r.reference, property: r.property.title, status: "CONFIRMED", amount: r.amount, currency: r.currency }));
  return { confirmed: true };
}

async function cancelInTx(id: string, reason: string, actorId: string | null, txIn?: Tx) {
  const run = async (tx: Tx) => {
    const r = await tx.reservation.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: reason },
      select: { id: true, reference: true, amount: true, currency: true, clientId: true, leadId: true, propertyId: true, ...personSelect, property: { select: { reference: true, title: true, status: true } } },
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
      action: "CANCELLED", entityType: "RESERVATION", entityId: id, entityLabel: r.reference, userId: actorId, clientId: r.clientId, leadId: r.leadId, propertyId: r.propertyId,
      description: `${r.reference} cancelled — ${reason}${released ? ` (${r.property.reference} is available again)` : ""}`,
    });
    return { r, released };
  };
  const { r, released } = txIn ? await run(txIn) : await db.$transaction(run);
  if (released) notifyWebsite();
  queueMail(emailOf(r), "reservation-cancelled", reservationUpdate({ name: nameOf(r), reference: r.reference, property: r.property.title, status: "CANCELLED", amount: r.amount, currency: r.currency, reason }));
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
