import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { CustomerType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { can, canAssignTo, isManager, scope, type Actor } from "@/lib/permissions";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { digitsOnly, like } from "@/lib/search";
import type { clientSchema, updateClientSchema } from "@/schemas/client";
import { logActivity } from "./activity";
import { assertActiveUser, assertCanAccess } from "./access";

export const CLIENT_SORTS = ["fullName", "createdAt", "updatedAt", "budgetMax"] as const;

export interface ClientFilters {
  clientType?: CustomerType;
  agentId?: string;
}

export async function listClients(actor: Actor, params: ListParams<(typeof CLIENT_SORTS)[number]>, filters: ClientFilters) {
  const q = params.q;
  const digits = q ? digitsOnly(q) : "";
  const where: Prisma.ClientWhereInput = {
    AND: [
      scope.clients(actor),
      q ? { OR: [{ fullName: like(q) }, { email: like(q) }, { idReference: like(q) }, ...(digits.length >= 4 ? [{ phone: like(digits.slice(-4)) }] : [])] } : {},
      filters.clientType ? { clientType: filters.clientType } : {},
      filters.agentId ? (filters.agentId === "none" ? { agentId: null } : { agentId: filters.agentId }) : {},
    ],
  };
  const [items, total] = await Promise.all([
    db.client.findMany({
      where,
      orderBy: [{ [params.sort]: params.dir }, { id: "asc" }],
      ...skipTake(params.page, params.pageSize),
      select: {
        id: true, fullName: true, phone: true, email: true, nationality: true, clientType: true, budgetMin: true, budgetMax: true, createdAt: true, updatedAt: true,
        agent: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { deals: true, viewings: true, leads: true } },
      },
    }),
    db.client.count({ where }),
  ]);
  return paginate(items, total, params.page, params.pageSize);
}

export type ClientListItem = Awaited<ReturnType<typeof listClients>>["items"][number];

export async function getClient(actor: Actor, id: string) {
  return db.client.findFirst({
    where: { id, ...scope.clients(actor) },
    include: {
      agent: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
      leads: { select: { id: true, fullName: true, status: true, source: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      interests: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          property: {
            select: {
              id: true, reference: true, title: true, area: true, status: true, price: true, currency: true, purpose: true,
              images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
            },
          },
        },
      },
      viewings: {
        orderBy: { startsAt: "desc" },
        select: { id: true, startsAt: true, endsAt: true, status: true, property: { select: { id: true, reference: true, title: true } }, agent: { select: { name: true } } },
      },
      deals: {
        orderBy: { createdAt: "desc" },
        select: { id: true, reference: true, type: true, status: true, amount: true, commissionAmount: true, property: { select: { id: true, reference: true, title: true } } },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        select: { id: true, title: true, status: true, priority: true, dueDate: true, assignee: { select: { name: true } } },
      },
    },
  });
}

export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClient>>>;

async function checkAgent(actor: Actor, agentId: string | null) {
  if (!canAssignTo(actor, agentId)) throw forbidden("You can only assign clients to yourself.");
  await assertActiveUser(agentId);
}

export async function createClient(actor: Actor, input: z.output<typeof clientSchema>) {
  const data = { ...input, agentId: input.agentId ?? (isManager(actor) ? null : actor.id) };
  await checkAgent(actor, data.agentId);
  return db.$transaction(async (tx) => {
    const client = await tx.client.create({ data, select: { id: true, fullName: true } });
    await logActivity(tx, { action: "CREATED", entityType: "CLIENT", entityId: client.id, entityLabel: client.fullName, description: `Added client ${client.fullName}`, userId: actor.id, clientId: client.id });
    return client;
  });
}

export async function updateClient(actor: Actor, input: z.output<typeof updateClientSchema>) {
  const { id, ...data } = input;
  const current = await db.client.findFirst({ where: { id, ...scope.clients(actor) }, select: { id: true, agentId: true } });
  if (!current) throw notFound("Client");
  if (!isManager(actor) && data.agentId !== current.agentId) throw forbidden("Only managers can reassign clients.");
  await checkAgent(actor, data.agentId);
  return db.$transaction(async (tx) => {
    const client = await tx.client.update({ where: { id }, data, select: { id: true, fullName: true, agentId: true } });
    if (current.agentId !== client.agentId) {
      const agent = client.agentId ? await tx.user.findUnique({ where: { id: client.agentId }, select: { name: true } }) : null;
      await logActivity(tx, {
        action: "ASSIGNED", entityType: "CLIENT", entityId: id, entityLabel: client.fullName, userId: actor.id, clientId: id,
        description: agent ? `Assigned ${client.fullName} to ${agent.name}` : `Unassigned ${client.fullName}`,
      });
    }
    await logActivity(tx, { action: "UPDATED", entityType: "CLIENT", entityId: id, entityLabel: client.fullName, description: `Updated client ${client.fullName}`, userId: actor.id, clientId: id });
    return client;
  });
}

export async function deleteClient(actor: Actor, id: string) {
  if (!can.deleteRecords(actor)) throw forbidden("Only managers can delete clients.");
  const client = await db.client.findUnique({ where: { id }, select: { fullName: true, _count: { select: { deals: true } } } });
  if (!client) throw notFound("Client");
  if (client._count.deals > 0) throw conflict(`${client.fullName} has ${client._count.deals} deal(s) on record and can't be deleted.`);
  await db.$transaction(async (tx) => {
    await tx.client.delete({ where: { id } });
    await logActivity(tx, { action: "DELETED", entityType: "CLIENT", entityId: id, entityLabel: client.fullName, description: `Deleted client ${client.fullName}`, userId: actor.id });
  });
}

export async function addClientInterest(actor: Actor, clientId: string, propertyId: string) {
  await assertCanAccess(actor, "client", clientId);
  await assertCanAccess(actor, "property", propertyId);
  await db.propertyInterest.upsert({ where: { propertyId_clientId: { propertyId, clientId } }, create: { propertyId, clientId }, update: {} });
}

export async function removeClientInterest(actor: Actor, clientId: string, propertyId: string) {
  await assertCanAccess(actor, "client", clientId);
  await db.propertyInterest.deleteMany({ where: { clientId, propertyId } });
}
