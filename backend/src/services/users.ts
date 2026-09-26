import "server-only";
import { cache } from "react";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session-store";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { like } from "@/lib/search";
import type { changePasswordSchema, createUserSchema, profileSchema, updateUserSchema } from "@/schemas/user";
import { logActivity } from "./activity";

export const USER_SORTS = ["name", "role", "createdAt", "lastLoginAt"] as const;

export const userListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatarUrl: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { leads: true, properties: true, deals: true, assignedTasks: true } },
} satisfies Prisma.UserSelect;

export async function listUsers(
  actor: Actor,
  params: ListParams<(typeof USER_SORTS)[number]>,
  filters: { role?: Role; active?: boolean },
) {
  if (!can.manageUsers(actor)) throw forbidden();
  const where: Prisma.UserWhereInput = {
    AND: [
      params.q ? { OR: [{ name: like(params.q) }, { email: like(params.q) }, { phone: like(params.q) }] } : {},
      filters.role ? { role: filters.role } : {},
      filters.active === undefined ? {} : { isActive: filters.active },
    ],
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { [params.sort]: params.dir },
      ...skipTake(params.page, params.pageSize),
      select: userListSelect,
    }),
    db.user.count({ where }),
  ]);
  return paginate(items, total, params.page, params.pageSize);
}

/** Active staff for assignment pickers (small table — fetched once per request). */
export const listAssignableUsers = cache(() =>
  db.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, avatarUrl: true },
  }),
);

export async function getUser(actor: Actor, id: string) {
  if (!can.manageUsers(actor) && actor.id !== id) throw forbidden();
  const user = await db.user.findUnique({ where: { id }, select: userListSelect });
  if (!user) throw notFound("User");
  return user;
}

async function assertEmailFree(email: string, exceptId?: string) {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== exceptId) throw conflict("That e-mail is already used by another account.", { email: ["Already in use"] });
}

export async function createUser(actor: Actor, input: z.output<typeof createUserSchema>) {
  if (!can.manageRole(actor, input.role)) throw forbidden("You can't create users with that role.");
  await assertEmailFree(input.email);
  const { password, ...data } = input;
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { ...data, passwordHash: await hashPassword(password) }, select: { id: true, name: true } });
    await logActivity(tx, {
      action: "CREATED", entityType: "USER", entityId: user.id, entityLabel: user.name,
      description: `Added team member ${user.name} (${input.role.toLowerCase()})`, userId: actor.id,
    });
    return user;
  });
}

export async function updateUser(actor: Actor, input: z.output<typeof updateUserSchema>) {
  const current = await db.user.findUnique({ where: { id: input.id }, select: { id: true, role: true, isActive: true, name: true } });
  if (!current) throw notFound("User");
  if (!can.manageRole(actor, current.role) || !can.manageRole(actor, input.role)) throw forbidden("You can't manage users with that role.");
  if (actor.id === input.id && (input.role !== current.role || !input.isActive)) {
    throw invalid("You can't change your own role or deactivate yourself.");
  }
  if (current.role === "ADMIN" && (input.role !== "ADMIN" || !input.isActive)) {
    const admins = await db.user.count({ where: { role: "ADMIN", isActive: true, id: { not: input.id } } });
    if (admins === 0) throw invalid("There must always be at least one active admin.");
  }
  await assertEmailFree(input.email, input.id);

  const { id, password, ...data } = input;
  const revoke = Boolean(password) || current.role !== input.role || (current.isActive && !input.isActive);
  const user = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
      select: { id: true, name: true },
    });
    await logActivity(tx, {
      action: "UPDATED", entityType: "USER", entityId: id, entityLabel: user.name,
      description: current.isActive && !input.isActive ? `Deactivated ${user.name}` : `Updated team member ${user.name}`,
      userId: actor.id,
    });
    return user;
  });
  if (revoke) await revokeAllSessions(id);
  return user;
}

export async function updateProfile(actor: Actor, input: z.output<typeof profileSchema>) {
  return db.user.update({ where: { id: actor.id }, data: input, select: { id: true } });
}

export async function changePassword(actor: Actor, input: z.output<typeof changePasswordSchema>) {
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw invalid("Current password is incorrect.", { currentPassword: ["Incorrect password"] });
  }
  await db.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
}
