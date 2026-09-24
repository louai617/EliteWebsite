import 'server-only';
import type { Auth } from '../auth/session';
import { conflict } from '../http';
import { Client, Lead, PropertyModel } from '../models';
import { nextSequence } from '../models/Counter';
import { AGENT_POPULATE, assertExists } from './common';
import { assertPropertyType, findLocation, type CrmSettings } from './settings';

export const PROPERTY_POPULATE = [AGENT_POPULATE, { path: 'owner', select: 'full_name phone email types' }];

/** Fields only the listing's own broker (or managers) may see. */
const PRIVATE_FIELDS = ['owner', 'owner_contact', 'internal_notes'] as const;

type PropertyLike = Record<string, unknown> & { _id: unknown; assigned_agent?: unknown };

/** Strip owner contact details from listings the caller cannot edit. */
export function redactProperty<T extends PropertyLike>(auth: Auth, property: T): T {
  if (auth.can('properties.update_all')) return property;
  const agent = property.assigned_agent as { _id?: unknown } | undefined | null;
  const agentId = agent && typeof agent === 'object' && '_id' in agent ? agent._id : agent;
  if (agentId && String(agentId) === String(auth.id)) return property;
  const copy = { ...property };
  for (const field of PRIVATE_FIELDS) delete copy[field];
  return copy;
}

/** Leads-per-property for a page of listings — one aggregation, not one query per row. */
export async function inquiryCounts(ids: unknown[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await Lead.aggregate<{ _id: unknown; count: number }>([
    { $match: { interested_properties: { $in: ids } } },
    { $unwind: '$interested_properties' },
    { $match: { interested_properties: { $in: ids } } },
    { $group: { _id: '$interested_properties', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

/** ELT-00001, ELT-00002… skipping any number already taken (e.g. imported listings). */
export async function generateReferenceNumber(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const ref = `ELT-${String(await nextSequence('property_ref')).padStart(5, '0')}`;
    if (!(await PropertyModel.exists({ reference_number: ref }))) return ref;
  }
  throw conflict('Could not generate a unique reference number. Enter one manually.');
}

/** Validate settings keys and references, and expand the location key into names. */
export async function preparePropertyInput<
  T extends {
    type?: string;
    owner?: string | null;
    location?: Record<string, unknown> & { area_key?: string | null };
  },
>(auth: Auth, settings: CrmSettings, body: T) {
  assertPropertyType(settings, body.type);
  await assertExists(Client, body.owner ?? undefined, 'Owner', auth.readScope('clients'));

  if (body.location && body.location.area_key !== undefined) {
    const location = findLocation(settings, body.location.area_key);
    body.location = {
      ...body.location,
      area_en: location?.name_en ?? null,
      area_ar: location?.name_ar ?? null,
      city_en: location?.city_en ?? null,
      city_ar: location?.city_ar ?? null,
    };
  }
  return body;
}
