/**
 * Role-based access control.
 *
 *  ADMIN    everything, including settings and managing admins/managers
 *  MANAGER  all CRM data for the team, assignments, deletions, managing agents
 *  AGENT    their own leads, clients, viewings, deals and tasks; reads the full property
 *           inventory and edits the listings assigned to them
 *
 * The same rules are applied twice: `scope*` helpers restrict what queries return, and
 * `assert*` helpers guard every mutation in the service layer.
 */
import type { Role } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export interface Actor {
  id: string;
  role: Role;
}

export const isAdmin = (actor: Actor) => actor.role === "ADMIN";
export const isManager = (actor: Actor) => actor.role === "ADMIN" || actor.role === "MANAGER";

export const can = {
  viewTeam: isManager,
  deleteRecords: isManager,
  reassign: isManager,
  manageUsers: isManager,
  editSettings: isAdmin,
  viewAllActivity: isManager,
  /** Managers can only manage agents; admins can manage everyone. */
  manageRole: (actor: Actor, role: Role) => isAdmin(actor) || (actor.role === "MANAGER" && role === "AGENT"),
};

/** An agent may only assign records to themselves. */
export function canAssignTo(actor: Actor, agentId: string | null | undefined) {
  if (isManager(actor)) return true;
  return !agentId || agentId === actor.id;
}

export const scope = {
  leads: (actor: Actor): Prisma.LeadWhereInput => (isManager(actor) ? {} : { agentId: actor.id }),
  clients: (actor: Actor): Prisma.ClientWhereInput => (isManager(actor) ? {} : { agentId: actor.id }),
  deals: (actor: Actor): Prisma.DealWhereInput => (isManager(actor) ? {} : { agentId: actor.id }),
  viewings: (actor: Actor): Prisma.ViewingWhereInput => (isManager(actor) ? {} : { agentId: actor.id }),
  tasks: (actor: Actor): Prisma.TaskWhereInput =>
    isManager(actor) ? {} : { OR: [{ assigneeId: actor.id }, { createdById: actor.id }] },
  /** Inventory is shared so agents can match clients to any listing. */
  properties: (_actor: Actor): Prisma.PropertyWhereInput => ({}),
  owners: (actor: Actor): Prisma.OwnerWhereInput =>
    isManager(actor) ? {} : { OR: [{ createdById: actor.id }, { properties: { some: { agentId: actor.id } } }] },
  activities: (actor: Actor): Prisma.ActivityWhereInput =>
    isManager(actor)
      ? {}
      : {
          OR: [
            { userId: actor.id },
            { lead: { agentId: actor.id } },
            { client: { agentId: actor.id } },
            { deal: { agentId: actor.id } },
            { viewing: { agentId: actor.id } },
            { property: { agentId: actor.id } },
            { task: { assigneeId: actor.id } },
          ],
        },
};

/** Whether the actor may edit a property (own listing or manager). */
export function canEditProperty(actor: Actor, property: { agentId: string | null }) {
  return isManager(actor) || property.agentId === actor.id;
}

/** Whether a sensitive owner contact can be shown for a given property. */
export function canSeeOwnerContact(actor: Actor, property: { agentId: string | null }) {
  return isManager(actor) || property.agentId === actor.id;
}
