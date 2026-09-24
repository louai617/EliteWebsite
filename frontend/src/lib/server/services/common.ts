import 'server-only';
import mongoose, { type Model } from 'mongoose';
import { STAFF_ROLES } from '@/lib/shared/constants';
import type { Resource } from '@/lib/shared/permissions';
import type { Auth } from '../auth/session';
import { badRequest, forbidden } from '../http';
import { User } from '../models';

type Plain = Record<string, unknown>;
/** Mongo filter object. Mongoose 9 types filters strictly per model; these are built dynamically. */
export type Filter = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** `compact()` output: same keys, with `null` removed from every value type. */
export type Compacted<T> = { [K in keyof T]: Exclude<T[K], null> };

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof mongoose.Types.ObjectId);

/** Remove null/undefined values (recursively) — used when creating documents. */
export function compact<T extends Plain>(input: T): Compacted<T> {
  const out: Plain = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    out[key] = isPlainObject(value) ? compact(value) : value;
  }
  return out as Compacted<T>;
}

/**
 * Apply a validated PATCH body to a hydrated document. `undefined` keys are
 * left alone, `null` clears the field, nested objects are merged key by key.
 */
export function applyPatch(doc: mongoose.Document, patch: Plain, prefix = '') {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === null) doc.set(path, undefined);
    else if (isPlainObject(value)) applyPatch(doc, value, path);
    else doc.set(path, value);
  }
}

/** `-created_at` → `{ created_at: -1, _id: -1 }` (the _id tiebreak keeps paging stable). */
export function parseSort(sort: string): Record<string, 1 | -1> {
  const desc = sort.startsWith('-');
  const field = sort.replace(/^-/, '');
  return { [field]: desc ? -1 : 1, _id: desc ? -1 : 1 };
}

/** Combine the permission scope with request filters without either overwriting the other. */
export function andFilter(...parts: Filter[]): Filter {
  const nonEmpty = parts.filter((p) => Object.keys(p).length > 0);
  if (nonEmpty.length === 0) return {};
  if (nonEmpty.length === 1) return nonEmpty[0];
  return { $and: nonEmpty };
}

export const toObjectId = (id: string) => new mongoose.Types.ObjectId(id);

/** Translate the `assigned_agent` list filter (`me`, `unassigned`, or an id). */
export function agentFilter(auth: Auth, value: string | undefined): Filter {
  if (!value) return {};
  if (value === 'me') return { assigned_agent: auth.id };
  if (value === 'unassigned') return { assigned_agent: null };
  return { assigned_agent: toObjectId(value) };
}

/**
 * Decide who a record is assigned to.
 *  - Users with `<resource>.update_all` may assign anyone on the team.
 *  - Everyone else may only assign themselves.
 *  - `required` resources (viewings, deals, tasks) default to the current user.
 */
export async function resolveAssignee(
  auth: Auth,
  resource: Resource,
  requested: string | null | undefined,
  opts: { required?: boolean; defaultToSelf?: boolean } = {}
): Promise<mongoose.Types.ObjectId | null | undefined> {
  if (requested === undefined) {
    if (opts.required || opts.defaultToSelf) return auth.id;
    // Managers leave new records unassigned; brokers own what they create;
    // staff without edit rights (e.g. reception) create unassigned records.
    if (auth.can(`${resource}.update_all`)) return undefined;
    return auth.can(`${resource}.update`) ? auth.id : undefined;
  }
  if (requested === null) {
    if (opts.required) throw badRequest('An assigned agent is required.');
    if (!auth.can(`${resource}.update_all`)) throw forbidden('Only managers can unassign records.');
    return null;
  }
  if (requested === String(auth.id)) return auth.id;
  if (!auth.can(`${resource}.update_all`)) {
    throw forbidden('You can only assign records to yourself.');
  }
  const agent = await User.findOne({
    _id: toObjectId(requested),
    role: { $in: STAFF_ROLES },
    is_active: true,
  })
    .select('_id')
    .lean();
  if (!agent) throw badRequest('The selected agent does not exist or is inactive.');
  return agent._id;
}

/** Ensure referenced ids exist (and, when a scope is given, that the user may see them). */
export async function assertExists(
  model: Model<never> | Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  ids: string | string[] | null | undefined,
  label: string,
  scope: Filter = {}
) {
  if (!ids || (Array.isArray(ids) && ids.length === 0)) return;
  const list = [...new Set(Array.isArray(ids) ? ids : [ids])];
  const count = await model.countDocuments(andFilter({ _id: { $in: list.map(toObjectId) } }, scope));
  if (count !== list.length) throw badRequest(`${label} not found or not accessible.`);
}

/** Fields populated onto list/detail responses. Small projections only. */
export const AGENT_POPULATE = { path: 'assigned_agent', select: 'full_name photo email phone' } as const;
