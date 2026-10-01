/**
 * Role-based access control.
 *
 *  ADMIN    everything, including settings, scoring weights and managing admins/managers
 *  MANAGER  all CRM data for the team, assignments, deletions, managing agents, imports
 *  AGENT    their own leads, clients, viewings, deals, tasks and activities; reads the full
 *           property inventory and edits the listings assigned to them
 *  CLIENT   client-portal only — never any CRM data. Portal queries are scoped to the
 *           client record linked to the account (see services/portal.ts).
 *
 * Rules are enforced on the server only (never trusted from the browser):
 *  - `hasPermission` / `PERMISSIONS` — a single role → capability matrix. New roles or
 *    capabilities are added here, not scattered through the code.
 *  - `scope.*` — Prisma where-filters that restrict what queries return.
 *  - services assert permissions before every mutation.
 */
import type { Role } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export interface Actor {
  id: string;
  role: Role;
}

export const PERMISSIONS = [
  "crm.access",
  "portal.access",
  "records.delete",
  "records.reassign",
  "users.manage",
  "settings.edit",
  "activity.viewAll",
  "tasks.assign",
  "tasks.viewTeam",
  "tasks.manageTemplates",
  "workActivities.logForOthers",
  "reports.viewTeam",
  "performance.viewTeam",
  "performance.configure",
  "imports.run",
  "clients.managePortal",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MANAGER_PERMISSIONS: Permission[] = [
  "crm.access",
  "records.delete",
  "records.reassign",
  "users.manage",
  "activity.viewAll",
  "tasks.assign",
  "tasks.viewTeam",
  "tasks.manageTemplates",
  "workActivities.logForOthers",
  "reports.viewTeam",
  "performance.viewTeam",
  "imports.run",
  "clients.managePortal",
];

/** The role → permission matrix. */
export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set<Permission>([...MANAGER_PERMISSIONS, "settings.edit", "performance.configure"]),
  MANAGER: new Set<Permission>(MANAGER_PERMISSIONS),
  AGENT: new Set<Permission>(["crm.access"]),
  CLIENT: new Set<Permission>(["portal.access"]),
};

export function hasPermission(actor: Actor, permission: Permission) {
  return ROLE_PERMISSIONS[actor.role]?.has(permission) ?? false;
}

export const isAdmin = (actor: Actor) => actor.role === "ADMIN";
export const isManager = (actor: Actor) => actor.role === "ADMIN" || actor.role === "MANAGER";
/** Staff = anyone who may use the CRM (not a client-portal account). */
export const isStaff = (actor: Actor) => hasPermission(actor, "crm.access");

export const can = {
  viewTeam: (actor: Actor) => hasPermission(actor, "tasks.viewTeam"),
  deleteRecords: (actor: Actor) => hasPermission(actor, "records.delete"),
  reassign: (actor: Actor) => hasPermission(actor, "records.reassign"),
  manageUsers: (actor: Actor) => hasPermission(actor, "users.manage"),
  editSettings: (actor: Actor) => hasPermission(actor, "settings.edit"),
  viewAllActivity: (actor: Actor) => hasPermission(actor, "activity.viewAll"),
  /** Managers can only manage agents; admins can manage every staff role. */
  manageRole: (actor: Actor, role: Role) => role !== "CLIENT" && (isAdmin(actor) || (actor.role === "MANAGER" && role === "AGENT")),
};

/** An agent may only assign records to themselves. */
export function canAssignTo(actor: Actor, agentId: string | null | undefined) {
  if (!isStaff(actor)) return false;
  if (hasPermission(actor, "tasks.assign")) return true;
  return !agentId || agentId === actor.id;
}

/** Matches nothing — the scope for anyone without CRM access (defence in depth). */
const NOTHING = { id: { in: [] as string[] } };

export const scope = {
  leads: (actor: Actor): Prisma.LeadWhereInput => (!isStaff(actor) ? NOTHING : isManager(actor) ? {} : { agentId: actor.id }),
  clients: (actor: Actor): Prisma.ClientWhereInput => (!isStaff(actor) ? NOTHING : isManager(actor) ? {} : { agentId: actor.id }),
  deals: (actor: Actor): Prisma.DealWhereInput => (!isStaff(actor) ? NOTHING : isManager(actor) ? {} : { agentId: actor.id }),
  viewings: (actor: Actor): Prisma.ViewingWhereInput => (!isStaff(actor) ? NOTHING : isManager(actor) ? {} : { agentId: actor.id }),
  tasks: (actor: Actor): Prisma.TaskWhereInput =>
    !isStaff(actor) ? NOTHING : isManager(actor) ? {} : { OR: [{ assigneeId: actor.id }, { createdById: actor.id }] },
  /** Inventory is shared so agents can match clients to any listing. */
  properties: (actor: Actor): Prisma.PropertyWhereInput => (!isStaff(actor) ? NOTHING : {}),
  owners: (actor: Actor): Prisma.OwnerWhereInput =>
    !isStaff(actor) ? NOTHING : isManager(actor) ? {} : { OR: [{ createdById: actor.id }, { properties: { some: { agentId: actor.id } } }] },
  workActivities: (actor: Actor): Prisma.AgentActivityWhereInput =>
    !isStaff(actor) ? NOTHING : hasPermission(actor, "reports.viewTeam") ? {} : { agentId: actor.id },
  activities: (actor: Actor): Prisma.ActivityWhereInput =>
    !isStaff(actor)
      ? NOTHING
      : isManager(actor)
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
  return isStaff(actor) && (isManager(actor) || property.agentId === actor.id);
}

/** Whether a sensitive owner contact can be shown for a given property. */
export function canSeeOwnerContact(actor: Actor, property: { agentId: string | null }) {
  return isStaff(actor) && (isManager(actor) || property.agentId === actor.id);
}
