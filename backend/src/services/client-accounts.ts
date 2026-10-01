import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session-store";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { hasPermission, scope, type Actor } from "@/lib/permissions";
import type { portalAccessSchema, registerClientSchema } from "@/schemas/portal";
import { logActivity } from "./activity";

/**
 * Client-portal accounts. A CLIENT user is linked 1:1 to a CRM `Client` record; everything
 * the portal shows is scoped to that record (see services/portal.ts).
 */

async function assertEmailFree(email: string, exceptUserId?: string) {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== exceptUserId) throw conflict("An account with this e-mail already exists.", { email: ["Already registered"] });
}

/** Website self-registration: creates a CRM client (unassigned) and its portal login. */
export async function registerClientAccount(input: z.output<typeof registerClientSchema>) {
  await assertEmailFree(input.email);
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: { fullName: input.name, email: input.email, phone: input.phone, clientType: input.clientType ?? "BUYER", notes: "Registered on the website" },
      select: { id: true, fullName: true },
    });
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, phone: input.phone, role: "CLIENT", clientId: client.id, passwordHash },
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, clientId: true },
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "CLIENT", entityId: client.id, entityLabel: client.fullName,
      description: `${client.fullName} registered on the website`, userId: null, clientId: client.id,
    });
    // Unassigned follow-up so a manager picks the new client up.
    await tx.task.create({
      data: {
        title: `Welcome new website client ${client.fullName}`,
        description: "Self-registered on the client portal. Assign an agent and make first contact.",
        type: "CLIENT_FOLLOW_UP",
        priority: "HIGH",
        dueDate: new Date(Date.now() + 24 * 3_600_000),
        clientId: client.id,
        events: { create: { type: "CREATED", message: "Created automatically from website registration" } },
      },
    });
    return user;
  });
}

async function scopedClient(actor: Actor, clientId: string) {
  if (!hasPermission(actor, "clients.managePortal")) throw forbidden("Only managers can manage client portal access.");
  const client = await db.client.findFirst({ where: { id: clientId, ...scope.clients(actor) }, select: { id: true, fullName: true, portalUser: { select: { id: true, isActive: true } } } });
  if (!client) throw notFound("Client");
  return client;
}

/** Grant portal access (or re-enable it with a new e-mail/password). */
export async function grantPortalAccess(actor: Actor, input: z.output<typeof portalAccessSchema>) {
  const client = await scopedClient(actor, input.clientId);
  await assertEmailFree(input.email, client.portalUser?.id);
  const passwordHash = await hashPassword(input.password);
  const user = await db.$transaction(async (tx) => {
    const user = client.portalUser
      ? await tx.user.update({ where: { id: client.portalUser.id }, data: { email: input.email, passwordHash, isActive: true }, select: { id: true, email: true } })
      : await tx.user.create({ data: { name: client.fullName, email: input.email, role: "CLIENT", clientId: client.id, passwordHash }, select: { id: true, email: true } });
    await logActivity(tx, {
      action: "UPDATED", entityType: "CLIENT", entityId: client.id, entityLabel: client.fullName,
      description: `Granted client-portal access to ${client.fullName} (${user.email})`, userId: actor.id, clientId: client.id,
    });
    return user;
  });
  if (client.portalUser) await revokeAllSessions(client.portalUser.id);
  return user;
}

export async function revokePortalAccess(actor: Actor, clientId: string) {
  const client = await scopedClient(actor, clientId);
  if (!client.portalUser) return { revoked: false };
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: client.portalUser!.id }, data: { isActive: false } });
    await logActivity(tx, {
      action: "UPDATED", entityType: "CLIENT", entityId: client.id, entityLabel: client.fullName,
      description: `Revoked client-portal access for ${client.fullName}`, userId: actor.id, clientId: client.id,
    });
  });
  await revokeAllSessions(client.portalUser.id);
  return { revoked: true };
}

export function portalAccessFor(clientId: string) {
  return db.user.findUnique({ where: { clientId }, select: { id: true, email: true, isActive: true, lastLoginAt: true, createdAt: true } });
}
