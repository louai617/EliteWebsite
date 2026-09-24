import { apiHandler, conflict, notFound, ok, readBody, readId } from '@/lib/server/http';
import { Deal, Lead, PropertyModel, Task, Viewing } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { andFilter, applyPatch, resolveAssignee } from '@/lib/server/services/common';
import {
  inquiryCounts,
  preparePropertyInput,
  PROPERTY_POPULATE,
  redactProperty,
} from '@/lib/server/services/properties';
import { getSettings } from '@/lib/server/services/settings';
import { propertyUpdateSchema } from '@/lib/validation/crm';

/** Full listing plus its related leads, viewings and deals. */
export const GET = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);

  const property = await PropertyModel.findOne(andFilter({ _id: id }, auth.readScope('properties')))
    .populate(PROPERTY_POPULATE)
    .lean();
  if (!property) throw notFound('Property');

  const canSeeLeads = auth.can('leads.read') || auth.can('leads.read_all');
  const [leads, viewings, deals, counts] = await Promise.all([
    canSeeLeads
      ? Lead.find(andFilter({ interested_properties: id }, auth.readScope('leads')))
          .select('full_name status phone email created_at')
          .sort({ created_at: -1 })
          .limit(50)
          .lean()
      : [],
    Viewing.find(andFilter({ property: id }, auth.readScope('viewings')))
      .sort({ scheduled_at: -1 })
      .limit(50)
      .populate([{ path: 'assigned_agent', select: 'full_name' }, { path: 'lead', select: 'full_name' }, { path: 'client', select: 'full_name' }])
      .lean(),
    auth.can('deals.read') || auth.can('deals.read_all')
      ? Deal.find(andFilter({ property: id }, auth.readScope('deals'))).sort({ created_at: -1 }).limit(20).lean()
      : [],
    inquiryCounts([id]),
  ]);

  return ok({
    ...redactProperty(auth, property as unknown as Record<string, unknown> & { _id: unknown }),
    inquiries: counts.get(String(id)) ?? 0,
    leads,
    viewings,
    deals,
  });
});

export const PATCH = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  const body = await readBody(request, propertyUpdateSchema);

  const property = await PropertyModel.findOne(andFilter({ _id: id }, auth.writeScope('properties')));
  if (!property) throw notFound('Property');

  const settings = await getSettings();
  await preparePropertyInput(auth, settings, body);

  const { assigned_agent, ...rest } = body;
  if (assigned_agent !== undefined) {
    property.assigned_agent = (await resolveAssignee(auth, 'properties', assigned_agent)) ?? undefined;
  }
  if (rest.purpose === 'sale') rest.price_frequency = null;
  applyPatch(property, rest);
  if (property.purpose === 'rent' && !property.price_frequency) property.price_frequency = 'year';
  if (property.is_active && !property.listed_at) property.listed_at = new Date();
  await property.save();

  return ok(await PropertyModel.findById(id).populate(PROPERTY_POPULATE).lean());
});

export const DELETE = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  auth.require('properties.delete');
  const id = await readId(context);

  const property = await PropertyModel.findOne(andFilter({ _id: id }, auth.writeScope('properties'))).select('_id');
  if (!property) throw notFound('Property');

  const [hasDeals, hasViewings] = await Promise.all([Deal.exists({ property: id }), Viewing.exists({ property: id })]);
  if (hasDeals || hasViewings) {
    throw conflict('This property has viewings or deals on record. Unpublish it or mark it off-market instead.');
  }

  await Lead.updateMany({ interested_properties: id }, { $pull: { interested_properties: id } });
  await Task.updateMany({ property: id }, { $unset: { property: 1 } });
  await property.deleteOne();

  return ok({ deleted: true });
});
