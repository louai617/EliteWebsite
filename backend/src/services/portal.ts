import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { LeadStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import type { portalAccountUpdateSchema, portalEnquirySchema, publicLeadSchema } from "@/schemas/portal";
import { logActivity } from "./activity";
import { onLeadAssigned } from "./automation";

/**
 * Client portal. Every query is scoped to the CLIENT user's own CRM client record, taken
 * from the database session (`actor.clientId`) — never from the request. Responses use
 * explicit client-safe selects: no owner contacts, commissions, internal notes, lead
 * priority or staff-only activity.
 */

type PortalActor = Actor & { clientId?: string | null };

function clientIdOf(actor: PortalActor): string {
  if (actor.role !== "CLIENT" || !actor.clientId) throw forbidden("This area is for client accounts.");
  return actor.clientId;
}

/** Listing fields a client may see. */
export const portalPropertySelect = {
  id: true,
  reference: true,
  title: true,
  type: true,
  category: true,
  purpose: true,
  status: true,
  price: true,
  currency: true,
  bedrooms: true,
  bathrooms: true,
  areaSqm: true,
  area: true,
  city: true,
  buildingName: true,
  furnishing: true,
  description: true,
  images: { orderBy: { sortOrder: "asc" }, take: 6, select: { url: true, isPrimary: true } },
} satisfies Prisma.PropertySelect;

const agentContact = { select: { name: true, email: true, phone: true, avatarUrl: true } } as const;

/** Client-facing lead stages (internal stages are grouped). */
const ENQUIRY_STAGE: Record<LeadStatus, string> = {
  NEW: "Received",
  CONTACTED: "In progress",
  QUALIFIED: "In progress",
  VIEWING_SCHEDULED: "Viewing scheduled",
  NEGOTIATION: "Negotiating",
  WON: "Completed",
  LOST: "Closed",
};

/** Turns a public file path into an absolute URL for the portal on another origin. */
function absolute<T extends { images: { url: string; isPrimary: boolean }[] }>(property: T, base: string): T {
  return { ...property, images: property.images.map((i) => ({ ...i, url: i.url.startsWith("/") ? `${base}${i.url}` : i.url })) };
}

export async function portalOverview(actor: PortalActor, baseUrl: string) {
  const clientId = clientIdOf(actor);
  const now = new Date();
  const [client, shortlisted, upcoming, activeDeals, openEnquiries, openTasks] = await Promise.all([
    db.client.findUnique({ where: { id: clientId }, select: { id: true, fullName: true, email: true, phone: true, clientType: true, budgetMin: true, budgetMax: true, requirements: true, agent: agentContact } }),
    db.propertyInterest.count({ where: { clientId } }),
    db.viewing.findMany({ where: { clientId, status: "SCHEDULED", startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 5, select: { id: true, startsAt: true, endsAt: true, status: true, agent: agentContact, property: { select: portalPropertySelect } } }),
    db.deal.count({ where: { clientId, status: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } } }),
    db.lead.count({ where: { clientId, status: { notIn: ["WON", "LOST"] } } }),
    db.task.count({ where: { clientId, clientVisible: true, status: { in: ["TODO", "IN_PROGRESS"] } } }),
  ]);
  if (!client) throw notFound("Account");
  return {
    client,
    counts: { shortlisted, upcomingViewings: upcoming.length, activeDeals, openEnquiries, openTasks },
    upcomingViewings: upcoming.map((v) => ({ ...v, property: absolute(v.property, baseUrl) })),
  };
}

/** Shortlisted listings plus anything the client viewed or has a deal on. */
export async function portalProperties(actor: PortalActor, baseUrl: string) {
  const clientId = clientIdOf(actor);
  const properties = await db.property.findMany({
    where: { OR: [{ interests: { some: { clientId } } }, { viewings: { some: { clientId } } }, { deals: { some: { clientId } } }] },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      ...portalPropertySelect,
      interests: { where: { clientId }, select: { createdAt: true } },
      viewings: { where: { clientId }, orderBy: { startsAt: "desc" }, take: 1, select: { startsAt: true, status: true } },
      deals: { where: { clientId }, take: 1, select: { reference: true, status: true } },
    },
  });
  return properties.map(({ interests, viewings, deals, ...p }) => ({
    ...absolute(p, baseUrl),
    shortlistedAt: interests[0]?.createdAt ?? null,
    lastViewing: viewings[0] ?? null,
    deal: deals[0] ?? null,
  }));
}

export async function portalViewings(actor: PortalActor, baseUrl: string) {
  const clientId = clientIdOf(actor);
  const rows = await db.viewing.findMany({
    where: { clientId },
    orderBy: { startsAt: "desc" },
    take: 200,
    select: { id: true, startsAt: true, endsAt: true, status: true, agent: agentContact, property: { select: portalPropertySelect } },
  });
  return rows.map((v) => ({ ...v, property: absolute(v.property, baseUrl) }));
}

/** The client's enquiries (CRM leads linked to them), with client-friendly stages. */
export async function portalLeads(actor: PortalActor) {
  const clientId = clientIdOf(actor);
  const leads = await db.lead.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, status: true, purpose: true, interestedArea: true, bedrooms: true, budgetMin: true, budgetMax: true, createdAt: true, updatedAt: true,
      agent: agentContact,
      interests: { take: 5, select: { property: { select: { id: true, reference: true, title: true } } } },
    },
  });
  return leads.map(({ status, interests, ...l }) => ({ ...l, stage: ENQUIRY_STAGE[status], closed: status === "WON" || status === "LOST", properties: interests.map((i) => i.property) }));
}

/** Tasks a staff member explicitly marked as visible to the client. */
export async function portalTasks(actor: PortalActor) {
  const clientId = clientIdOf(actor);
  return db.task.findMany({
    where: { clientId, clientVisible: true },
    orderBy: [{ status: "asc" }, { dueDate: { sort: "asc", nulls: "last" } }],
    take: 200,
    select: { id: true, title: true, description: true, type: true, status: true, dueDate: true, completedAt: true, assignee: { select: { name: true } } },
  });
}

/** Deals and a small activity summary ("reports" for the client). */
export async function portalReports(actor: PortalActor) {
  const clientId = clientIdOf(actor);
  const [deals, viewingsByStatus, enquiries] = await Promise.all([
    db.deal.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, type: true, status: true, amount: true, contractDate: true, closingDate: true, closedAt: true, createdAt: true, property: { select: { id: true, reference: true, title: true, area: true } }, agent: agentContact },
    }),
    db.viewing.groupBy({ by: ["status"], where: { clientId }, _count: { _all: true } }),
    db.lead.count({ where: { clientId } }),
  ]);
  const viewings = Object.fromEntries(viewingsByStatus.map((v) => [v.status, v._count._all]));
  return { deals, summary: { enquiries, viewingsCompleted: viewings.COMPLETED ?? 0, viewingsScheduled: viewings.SCHEDULED ?? 0, dealsOpen: deals.filter((d) => !d.status.startsWith("CLOSED")).length, dealsCompleted: deals.filter((d) => d.status === "CLOSED_WON").length } };
}

/** Curated, client-safe timeline (built from records, not from the internal audit log). */
export async function portalActivity(actor: PortalActor) {
  const clientId = clientIdOf(actor);
  const [viewings, deals, interests, leads, tasks] = await Promise.all([
    db.viewing.findMany({ where: { clientId }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, status: true, startsAt: true, createdAt: true, updatedAt: true, property: { select: { reference: true, title: true } } } }),
    db.deal.findMany({ where: { clientId }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, reference: true, status: true, createdAt: true, updatedAt: true, property: { select: { reference: true, title: true } } } }),
    db.propertyInterest.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, createdAt: true, property: { select: { reference: true, title: true } } } }),
    db.lead.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, createdAt: true, interestedArea: true } }),
    db.task.findMany({ where: { clientId, clientVisible: true, status: "COMPLETED" }, orderBy: { completedAt: "desc" }, take: 50, select: { id: true, title: true, completedAt: true } }),
  ]);
  const items = [
    ...viewings.map((v) => ({ id: `viewing:${v.id}`, kind: "viewing", at: v.status === "SCHEDULED" ? v.createdAt : v.updatedAt, text: `${v.status === "SCHEDULED" ? "Viewing scheduled" : v.status === "COMPLETED" ? "Viewing completed" : v.status === "CANCELLED" ? "Viewing cancelled" : "Viewing updated"} — ${v.property.title} (${v.property.reference})` })),
    ...deals.map((d) => ({ id: `deal:${d.id}`, kind: "deal", at: d.updatedAt, text: `Deal ${d.reference} for ${d.property.title}: ${d.status.replaceAll("_", " ").toLowerCase()}` })),
    ...interests.map((i) => ({ id: `interest:${i.id}`, kind: "shortlist", at: i.createdAt, text: `${i.property.title} (${i.property.reference}) added to your shortlist` })),
    ...leads.map((l) => ({ id: `lead:${l.id}`, kind: "enquiry", at: l.createdAt, text: `Enquiry received${l.interestedArea ? ` — ${l.interestedArea}` : ""}` })),
    ...tasks.map((t) => ({ id: `task:${t.id}`, kind: "task", at: t.completedAt!, text: `Completed: ${t.title}` })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 100);
}

/** Everything the CRM holds about the client that is theirs to see (data export). */
export async function portalDataExport(actor: PortalActor, baseUrl: string) {
  const clientId = clientIdOf(actor);
  const [profile, properties, viewings, enquiries, tasks, reports] = await Promise.all([
    db.client.findUnique({ where: { id: clientId }, select: { fullName: true, email: true, phone: true, nationality: true, clientType: true, budgetMin: true, budgetMax: true, requirements: true, createdAt: true } }),
    portalProperties(actor, baseUrl),
    portalViewings(actor, baseUrl),
    portalLeads(actor),
    portalTasks(actor),
    portalReports(actor),
  ]);
  return { exportedAt: new Date().toISOString(), profile, properties, viewings, enquiries, tasks, deals: reports.deals };
}

export async function updatePortalAccount(actor: PortalActor, input: z.output<typeof portalAccountUpdateSchema>) {
  const clientId = clientIdOf(actor);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { name: input.name, phone: input.phone } });
    const client = await tx.client.update({ where: { id: clientId }, data: { fullName: input.name, phone: input.phone }, select: { fullName: true } });
    await logActivity(tx, { action: "UPDATED", entityType: "CLIENT", entityId: clientId, entityLabel: client.fullName, description: `${client.fullName} updated their contact details on the portal`, userId: null, clientId });
  });
  return { updated: true };
}

/** A signed-in client asks about a listing (or anything): becomes a lead for their agent. */
export async function createPortalEnquiry(actor: PortalActor, input: z.output<typeof portalEnquirySchema>) {
  const clientId = clientIdOf(actor);
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true, fullName: true, phone: true, email: true, agentId: true, clientType: true } });
  if (!client) throw notFound("Account");
  const property = input.propertyId ? await db.property.findFirst({ where: { id: input.propertyId, status: { in: ["AVAILABLE", "RESERVED"] } }, select: { id: true, reference: true, purpose: true, area: true } }) : null;
  if (input.propertyId && !property) throw notFound("Listing");
  return createLeadRecord({
    fullName: client.fullName, phone: client.phone, email: client.email, clientId: client.id, agentId: client.agentId,
    source: "WEBSITE", message: input.message, property, label: "Client portal enquiry",
  });
}

/** Public website contact form (no account). */
export async function createPublicLead(input: z.output<typeof publicLeadSchema>) {
  const ref = input.propertyRef?.trim();
  const property = ref ? await db.property.findFirst({ where: { OR: [{ reference: ref }, { id: ref }], status: { in: ["AVAILABLE", "RESERVED"] } }, select: { id: true, reference: true, purpose: true, area: true, agentId: true } }) : null;
  return createLeadRecord({
    fullName: input.fullName, phone: input.phone, email: input.email ?? null, clientId: null, agentId: property?.agentId ?? null,
    source: "WEBSITE", message: input.message ?? null, property, label: "Website enquiry",
  });
}

async function createLeadRecord(input: {
  fullName: string; phone: string; email: string | null; clientId: string | null; agentId: string | null;
  source: "WEBSITE"; message: string | null; property: { id: string; reference: string; purpose: "RENT" | "SALE"; area: string } | null; label: string;
}) {
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        fullName: input.fullName, phone: input.phone, email: input.email, source: input.source, clientId: input.clientId, agentId: input.agentId,
        purpose: input.property?.purpose, interestedArea: input.property?.area,
        notes: [input.label, input.property ? `Listing ${input.property.reference}` : null, input.message].filter(Boolean).join("\n"),
        ...(input.property ? { interests: { create: { propertyId: input.property.id } } } : {}),
      },
      select: { id: true, fullName: true, status: true, agentId: true },
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName,
      description: `${input.label} from ${lead.fullName}`, userId: null, leadId: lead.id, clientId: input.clientId,
    });
    if (lead.agentId) await onLeadAssigned(tx, lead, null);
    else {
      // Nobody owns it yet: an unassigned, urgent response task for the managers.
      await tx.task.create({
        data: {
          title: `Assign and answer new website lead ${lead.fullName}`, type: "LEAD_RESPONSE", priority: "URGENT",
          dueDate: new Date(Date.now() + 60 * 60_000), leadId: lead.id, clientId: input.clientId,
          events: { create: { type: "CREATED", message: `Created automatically from a ${input.label.toLowerCase()}` } },
        },
      });
    }
    return { id: lead.id, received: true };
  });
}
