import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { can, scope, type Actor } from "@/lib/permissions";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { digitsOnly, like } from "@/lib/search";
import type { ownerSchema, updateOwnerSchema } from "@/schemas/owner";
import { logActivity } from "./activity";

export const OWNER_SORTS = ["fullName", "createdAt", "updatedAt"] as const;

export async function listOwners(actor: Actor, params: ListParams<(typeof OWNER_SORTS)[number]>, filters: { nationality?: string }) {
  const q = params.q;
  const where: Prisma.OwnerWhereInput = {
    AND: [
      scope.owners(actor),
      q ? { OR: [{ fullName: like(q) }, { email: like(q) }, ...(digitsOnly(q).length >= 4 ? [{ phone: like(digitsOnly(q).slice(-4)) }] : [])] } : {},
      filters.nationality ? { nationality: filters.nationality } : {},
    ],
  };
  const [rows, total] = await Promise.all([
    db.owner.findMany({
      where,
      orderBy: { [params.sort]: params.dir },
      ...skipTake(params.page, params.pageSize),
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        nationality: true,
        createdAt: true,
        _count: { select: { properties: true, deals: true } },
      },
    }),
    db.owner.count({ where }),
  ]);
  // Active listings per owner in one grouped query (no N+1).
  const active = rows.length
    ? await db.property.groupBy({ by: ["ownerId"], where: { ownerId: { in: rows.map((r) => r.id) }, status: "AVAILABLE" }, _count: { _all: true } })
    : [];
  const activeByOwner = new Map(active.map((a) => [a.ownerId, a._count._all]));
  const items = rows.map((r) => ({ ...r, activeListings: activeByOwner.get(r.id) ?? 0 }));
  return paginate(items, total, params.page, params.pageSize);
}

export type OwnerListItem = Awaited<ReturnType<typeof listOwners>>["items"][number];

export async function getOwner(actor: Actor, id: string) {
  const owner = await db.owner.findFirst({
    where: { id, ...scope.owners(actor) },
    include: {
      createdBy: { select: { id: true, name: true } },
      properties: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true, reference: true, title: true, status: true, purpose: true, price: true, currency: true, area: true, agentId: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        },
      },
      deals: {
        orderBy: { createdAt: "desc" },
        select: { id: true, reference: true, type: true, status: true, amount: true, closedAt: true, createdAt: true, property: { select: { reference: true } }, client: { select: { fullName: true } } },
      },
    },
  });
  if (!owner) return null;
  return owner;
}

export type OwnerDetail = NonNullable<Awaited<ReturnType<typeof getOwner>>>;

export async function createOwner(actor: Actor, input: z.output<typeof ownerSchema>) {
  return db.$transaction(async (tx) => {
    const owner = await tx.owner.create({ data: { ...input, createdById: actor.id }, select: { id: true, fullName: true } });
    await logActivity(tx, {
      action: "CREATED", entityType: "OWNER", entityId: owner.id, entityLabel: owner.fullName,
      description: `Added owner ${owner.fullName}`, userId: actor.id, ownerId: owner.id,
    });
    return owner;
  });
}

export async function updateOwner(actor: Actor, input: z.output<typeof updateOwnerSchema>) {
  const { id, ...data } = input;
  const existing = await db.owner.findFirst({ where: { id, ...scope.owners(actor) }, select: { id: true } });
  if (!existing) throw notFound("Owner");
  return db.$transaction(async (tx) => {
    const owner = await tx.owner.update({ where: { id }, data, select: { id: true, fullName: true } });
    await logActivity(tx, {
      action: "UPDATED", entityType: "OWNER", entityId: id, entityLabel: owner.fullName,
      description: `Updated owner ${owner.fullName}`, userId: actor.id, ownerId: id,
    });
    return owner;
  });
}

export async function deleteOwner(actor: Actor, id: string) {
  if (!can.deleteRecords(actor)) throw forbidden("Only managers can delete owners.");
  const owner = await db.owner.findUnique({ where: { id }, select: { fullName: true, _count: { select: { properties: true } } } });
  if (!owner) throw notFound("Owner");
  if (owner._count.properties > 0) {
    throw conflict(`${owner.fullName} still owns ${owner._count.properties} ${owner._count.properties === 1 ? "property" : "properties"}. Reassign or delete them first.`);
  }
  await db.$transaction(async (tx) => {
    await tx.owner.delete({ where: { id } });
    await logActivity(tx, { action: "DELETED", entityType: "OWNER", entityId: id, entityLabel: owner.fullName, description: `Deleted owner ${owner.fullName}`, userId: actor.id });
  });
}

export async function ownerNationalities(actor: Actor) {
  const rows = await db.owner.findMany({
    where: { ...scope.owners(actor), nationality: { not: null } },
    distinct: ["nationality"],
    select: { nationality: true },
    orderBy: { nationality: "asc" },
  });
  return rows.map((r) => r.nationality!).filter(Boolean);
}

