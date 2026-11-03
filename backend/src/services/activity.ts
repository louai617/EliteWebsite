import "server-only";
import type { ActivityAction, EntityType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { scope, type Actor } from "@/lib/permissions";
import { paginate, skipTake } from "@/lib/list-params";
import { like } from "@/lib/search";
import type { Tx } from "./types";

export interface ActivityLinks {
  leadId?: string | null;
  clientId?: string | null;
  ownerId?: string | null;
  propertyId?: string | null;
  dealId?: string | null;
  viewingId?: string | null;
  taskId?: string | null;
}

export interface LogActivityInput extends ActivityLinks {
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  description: string;
  userId: string | null;
  meta?: Record<string, unknown>;
}

/** Append an event to the activity log (call inside the mutation's transaction). */
export async function logActivity(tx: Tx, input: LogActivityInput) {
  const { meta, ...rest } = input;
  await tx.activity.create({ data: { ...rest, meta: meta ? JSON.stringify(meta) : null } });
}

export const activitySelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  entityLabel: true,
  description: true,
  createdAt: true,
  user: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.ActivitySelect;

export type ActivityItem = Prisma.ActivityGetPayload<{ select: typeof activitySelect }>;

export type TimelineKey = keyof ActivityLinks;

/** Timeline for one record, e.g. timeline("propertyId", id). */
export function timeline(key: TimelineKey, id: string, take = 30) {
  return db.activity.findMany({
    where: { [key]: id },
    orderBy: { createdAt: "desc" },
    take,
    select: activitySelect,
  });
}

export function recentActivity(actor: Actor, take = 12) {
  return db.activity.findMany({
    where: scope.activities(actor),
    orderBy: { createdAt: "desc" },
    take,
    select: activitySelect,
  });
}

export interface ActivityFilters {
  entityType?: EntityType;
  userId?: string;
  from?: Date;
  to?: Date;
  q?: string;
}

export async function listActivities(actor: Actor, filters: ActivityFilters, page: number, pageSize: number) {
  const where: Prisma.ActivityWhereInput = {
    AND: [
      scope.activities(actor),
      filters.entityType ? { entityType: filters.entityType } : {},
      filters.userId ? { userId: filters.userId } : {},
      filters.from || filters.to ? { createdAt: { gte: filters.from, lt: filters.to } } : {},
      filters.q ? { OR: [{ description: like(filters.q) }, { entityLabel: like(filters.q) }] } : {},
    ],
  };
  const [items, total] = await Promise.all([
    db.activity.findMany({ where, orderBy: { createdAt: "desc" }, ...skipTake(page, pageSize), select: activitySelect }),
    db.activity.count({ where }),
  ]);
  return paginate(items, total, page, pageSize);
}
