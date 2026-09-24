/**
 * Role-based permissions with per-user overrides.
 *
 * Every CRM resource has the same six actions:
 *
 *   read        see records in your own scope (assigned to you)
 *   read_all    see every record
 *   create      create records (assigned to yourself unless you also have update_all)
 *   update      edit records in your own scope
 *   update_all  edit any record, including re-assigning it to another agent
 *   delete      delete records you are allowed to edit
 *
 * A user's effective permissions are their role's defaults, plus anything in
 * `user.permissions`, minus anything in `user.revoked_permissions`. That lets an
 * admin give a senior broker `leads.read_all` without promoting them.
 *
 * This file is imported by both the server (authorisation) and the client (to
 * hide buttons a user cannot use). The server is the only place it is enforced.
 */

import type { Role } from './constants';

export const RESOURCES = [
  'leads',
  'clients',
  'properties',
  'viewings',
  'deals',
  'tasks',
  'users',
  'settings',
  'reports',
] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['read', 'read_all', 'create', 'update', 'update_all', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Resource}.${Action}`;

export const ALL_PERMISSIONS: Permission[] = RESOURCES.flatMap((resource) =>
  ACTIONS.map((action) => `${resource}.${action}` as Permission)
);

const full = (resource: Resource): Permission[] => ACTIONS.map((a) => `${resource}.${a}` as Permission);
const own = (resource: Resource): Permission[] => [
  `${resource}.read`,
  `${resource}.create`,
  `${resource}.update`,
  `${resource}.delete`,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL_PERMISSIONS,

  manager: [
    ...full('leads'),
    ...full('clients'),
    ...full('properties'),
    ...full('viewings'),
    ...full('deals'),
    ...full('tasks'),
    // Managers manage brokers and staff; the API stops them touching admins/managers.
    'users.read', 'users.read_all', 'users.create', 'users.update', 'users.update_all',
    'settings.read',
    'reports.read', 'reports.read_all',
  ],

  broker: [
    ...own('leads'),
    ...own('clients'),
    // Brokers can browse the whole inventory to match clients, but only edit their own listings.
    'properties.read', 'properties.read_all', 'properties.create', 'properties.update',
    ...own('viewings'),
    'deals.read', 'deals.create', 'deals.update',
    ...own('tasks'),
    'users.read',
    'settings.read',
    'reports.read',
  ],

  staff: [
    'leads.read', 'leads.read_all', 'leads.create',
    'clients.read', 'clients.read_all',
    'properties.read', 'properties.read_all',
    'viewings.read', 'viewings.read_all',
    ...own('tasks'),
    'users.read',
    'settings.read',
  ],

  user: [],
};

export interface PermissionSubject {
  role: Role;
  permissions?: string[];
  revoked_permissions?: string[];
}

export function effectivePermissions(subject: PermissionSubject): Set<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[subject.role] ?? []);
  for (const p of subject.permissions ?? []) {
    if ((ALL_PERMISSIONS as string[]).includes(p)) set.add(p as Permission);
  }
  for (const p of subject.revoked_permissions ?? []) set.delete(p as Permission);
  return set;
}

export function hasPermission(subject: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!subject) return false;
  return effectivePermissions(subject).has(permission);
}

/** Higher rank can manage lower rank. Admins can manage everyone. */
export const ROLE_RANK: Record<Role, number> = {
  admin: 100,
  manager: 80,
  broker: 50,
  staff: 40,
  user: 10,
};
