import { z } from 'zod';
import { CLIENT_TYPES } from '@/lib/shared/constants';
import { apiHandler, conflict, notFound, ok, readBody, readId } from '@/lib/server/http';
import { Client, Lead } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { andFilter, compact, toObjectId, type Filter } from '@/lib/server/services/common';
import { loadLead } from '@/lib/server/services/leads';
import { objectId } from '@/lib/validation/common';

const convertSchema = z.object({
  /** Link to this existing client instead of creating one. */
  client_id: objectId.optional(),
  types: z.array(z.enum(CLIENT_TYPES)).min(1).max(CLIENT_TYPES.length).default(['buyer']),
});

/**
 * POST /api/leads/:id/convert — turn a lead into a client (or link it to an
 * existing one). An existing client with the same email/phone is reused
 * rather than duplicated.
 */
export const POST = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  auth.require('clients.create');
  const id = await readId(context);
  const body = await readBody(request, convertSchema);

  const lead = await Lead.findOne(andFilter({ _id: id }, auth.writeScope('leads'))).select('+phone_digits');
  if (!lead) throw notFound('Lead');
  if (lead.client) throw conflict('This lead is already linked to a client.');

  const clientScope = auth.readScope('clients');
  let clientId;

  if (body.client_id) {
    const existing = await Client.findOne(andFilter({ _id: toObjectId(body.client_id) }, clientScope)).select('_id');
    if (!existing) throw notFound('Client');
    clientId = existing._id;
  } else {
    const matchers = [
      lead.email ? { email: lead.email } : null,
      lead.phone_digits ? { phone_digits: lead.phone_digits } : null,
    ].filter(Boolean) as Filter[];
    const duplicate = matchers.length
      ? await Client.findOne(andFilter({ $or: matchers }, clientScope)).select('_id types')
      : null;

    if (duplicate) {
      clientId = duplicate._id;
      const merged = new Set([...(duplicate.types ?? []), ...body.types]);
      duplicate.types = [...merged];
      await duplicate.save();
    } else {
      const client = await Client.create(
        compact({
          full_name: lead.full_name,
          types: body.types,
          phone: lead.phone,
          email: lead.email,
          whatsapp: lead.whatsapp,
          preferred_locations: lead.preferred_location ? [lead.preferred_location] : undefined,
          requirements: compact({
            purpose: lead.purpose,
            property_types: lead.property_type ? [lead.property_type] : undefined,
            bedrooms_min: lead.bedrooms,
            bathrooms_min: lead.bathrooms,
          }),
          budget_min: lead.budget_min,
          budget_max: lead.budget_max,
          notes: lead.notes,
          tags: lead.tags?.length ? lead.tags : undefined,
          assigned_agent: lead.assigned_agent ?? auth.id,
          created_by: auth.id,
        })
      );
      clientId = client._id;
    }
  }

  lead.client = clientId;
  await lead.save();
  return ok({ lead: await loadLead(lead._id), client_id: String(clientId) });
});
