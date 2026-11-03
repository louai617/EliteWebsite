import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import type { publicLeadSchema } from "@/schemas/website";
import { logActivity } from "./activity";
import { onLeadAssigned } from "./automation";
import type { Tx } from "./types";

/**
 * Leads from the public website (no visitor accounts): the contact form, the chat widget,
 * viewing bookings and reservations. Each lands in the CRM as a WEBSITE lead for the
 * listing's agent, or as an urgent "assign this lead" task for the managers.
 */

type ListingRef = { id: string; reference: string; purpose: "RENT" | "SALE"; area: string; agentId: string | null };

export interface WebsiteContact {
  fullName: string;
  phone: string;
  email: string | null;
}

/** Digits only, so "+974 5512 3456" and "0097455123456" compare equal on the last 8+ digits. */
const digits = (phone: string) => phone.replace(/[^0-9]/g, "");

async function createLeadInTx(tx: Tx, input: WebsiteContact & { property: ListingRef | null; message: string | null; label: string }) {
  const agentId = input.property?.agentId ?? null;
  const lead = await tx.lead.create({
    data: {
      fullName: input.fullName, phone: input.phone, email: input.email, source: "WEBSITE", agentId, assignedAt: agentId ? new Date() : null,
      purpose: input.property?.purpose, interestedArea: input.property?.area,
      notes: [input.label, input.property ? `Listing ${input.property.reference}` : null, input.message].filter(Boolean).join("\n"),
      ...(input.property ? { interests: { create: { propertyId: input.property.id } } } : {}),
    },
    select: { id: true, fullName: true, status: true, agentId: true },
  });
  await logActivity(tx, {
    action: "CREATED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName,
    description: `${input.label} from ${lead.fullName}`, userId: null, leadId: lead.id,
  });
  if (lead.agentId) await onLeadAssigned(tx, lead, null);
  else {
    // Nobody owns it yet: an unassigned, urgent response task for the managers.
    await tx.task.create({
      data: {
        title: `Assign and answer new website lead ${lead.fullName}`, type: "LEAD_RESPONSE", priority: "URGENT",
        dueDate: new Date(Date.now() + 60 * 60_000), leadId: lead.id,
        events: { create: { type: "CREATED", message: `Created automatically from a ${input.label.toLowerCase()}` } },
      },
    });
  }
  return { id: lead.id, fullName: lead.fullName, agentId: lead.agentId };
}

/**
 * The lead for a viewing booking or reservation. A visitor who already has an open lead for
 * this same listing (same phone number) keeps that lead, so the agent sees one conversation;
 * anyone else gets a new lead. Nothing about the existing lead is returned to the visitor.
 */
export async function websiteLeadInTx(tx: Tx, contact: WebsiteContact, property: ListingRef, label: string, message: string | null) {
  const candidates = await tx.lead.findMany({
    where: { status: { notIn: ["WON", "LOST"] }, interests: { some: { propertyId: property.id } }, createdAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, fullName: true, phone: true, agentId: true },
  });
  const phone = digits(contact.phone).slice(-8);
  const existing = candidates.find((l) => phone.length >= 7 && digits(l.phone).slice(-8) === phone);
  if (existing) {
    await logActivity(tx, {
      action: "UPDATED", entityType: "LEAD", entityId: existing.id, entityLabel: existing.fullName,
      description: `${label} from ${contact.fullName} (${property.reference})${message ? `: “${message.slice(0, 200)}”` : ""}`, userId: null, leadId: existing.id,
    });
    return { id: existing.id, fullName: existing.fullName, agentId: existing.agentId };
  }
  return createLeadInTx(tx, { ...contact, property, message, label });
}

/** Public website contact form / chat widget. */
export async function createPublicLead(input: z.output<typeof publicLeadSchema>) {
  const ref = input.propertyRef?.trim();
  const property = ref
    ? await db.property.findFirst({ where: { OR: [{ reference: ref }, { id: ref }], status: { in: ["AVAILABLE", "RESERVED"] } }, select: { id: true, reference: true, purpose: true, area: true, agentId: true } })
    : null;
  const lead = await db.$transaction((tx) =>
    createLeadInTx(tx, { fullName: input.fullName, phone: input.phone, email: input.email ?? null, property, message: input.message ?? null, label: "Website enquiry" }),
  );
  return { id: lead.id, received: true };
}
