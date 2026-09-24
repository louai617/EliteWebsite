import 'server-only';
import type { Auth } from '../auth/session';
import { escapeRegex } from '../http';
import { Client, Lead, PropertyModel } from '../models';
import { agentFilter, andFilter, assertExists, AGENT_POPULATE, toObjectId, type Filter } from './common';
import {
  assertLeadSource,
  assertLeadStatus,
  assertPropertyType,
  type CrmSettings,
} from './settings';
import type { z } from 'zod';
import type { leadListQuery } from '@/lib/validation/crm';

export const LEAD_POPULATE = [
  AGENT_POPULATE,
  { path: 'interested_properties', select: 'title_en reference_number location.area_en price currency purpose images' },
  { path: 'client', select: 'full_name phone email types' },
];

/** Build the Mongo filter for the leads list from validated query params. */
export function buildLeadFilter(auth: Auth, q: z.infer<typeof leadListQuery>) {
  const filters: Filter = {};
  if (q.status) filters.status = q.status;
  if (q.source) filters.source = q.source;
  if (q.priority) filters.priority = q.priority;
  if (q.property) filters.interested_properties = toObjectId(q.property);
  if (q.client) filters.client = toObjectId(q.client);
  if (q.follow_up_due) filters.next_follow_up_at = { $lte: new Date() };

  const search: Filter = {};
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const or: Filter[] = [{ full_name: rx }, { email: rx }];
    const digits = q.q.replace(/\D/g, '');
    if (digits.length >= 3) or.push({ phone_digits: { $regex: escapeRegex(digits) } });
    search.$or = or;
  }

  return andFilter(auth.readScope('leads'), agentFilter(auth, q.assigned_agent), filters, search);
}

/** Validate configurable keys and referenced documents on a lead payload. */
export async function validateLeadRefs(
  auth: Auth,
  settings: CrmSettings,
  body: {
    status?: string | null;
    source?: string | null;
    property_type?: string | null;
    interested_properties?: string[];
    client?: string | null;
  }
) {
  assertLeadStatus(settings, body.status);
  assertLeadSource(settings, body.source);
  assertPropertyType(settings, body.property_type);
  await assertExists(PropertyModel, body.interested_properties, 'One of the interested properties');
  await assertExists(Client, body.client ?? undefined, 'Client', auth.readScope('clients'));
}

export async function loadLead(id: unknown) {
  return Lead.findById(id).populate(LEAD_POPULATE).lean();
}
