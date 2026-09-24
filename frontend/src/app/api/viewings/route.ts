import { apiHandler, ok, pageMeta, readBody, readQuery } from '@/lib/server/http';
import { Client, Lead, PropertyModel, Viewing } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import {
  agentFilter,
  andFilter,
  assertExists,
  compact,
  parseSort,
  resolveAssignee,
  toObjectId,
  type Filter,
} from '@/lib/server/services/common';
import { VIEWING_POPULATE } from '@/lib/server/services/populate';
import { viewingCreateSchema, viewingListQuery } from '@/lib/validation/crm';

/** GET /api/viewings?page=&limit=&status=&assigned_agent=&property=&from=&to=&upcoming=true */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  const q = readQuery(request, viewingListQuery);

  const filters: Filter = {};
  if (q.status) filters.status = q.status;
  if (q.property) filters.property = toObjectId(q.property);
  if (q.lead) filters.lead = toObjectId(q.lead);
  if (q.client) filters.client = toObjectId(q.client);
  if (q.upcoming) {
    filters.status = q.status ?? { $in: ['scheduled', 'confirmed'] };
    filters.scheduled_at = { $gte: new Date() };
  }
  if (q.from || q.to) {
    filters.scheduled_at = {
      ...(filters.scheduled_at ?? {}),
      ...(q.from ? { $gte: q.from } : {}),
      ...(q.to ? { $lte: q.to } : {}),
    };
  }
  const filter = andFilter(auth.readScope('viewings'), agentFilter(auth, q.assigned_agent), filters);

  const [items, total] = await Promise.all([
    Viewing.find(filter)
      .sort(parseSort(q.sort))
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(VIEWING_POPULATE)
      .lean(),
    Viewing.countDocuments(filter),
  ]);
  return ok(items, { meta: pageMeta(q.page, q.limit, total) });
});

export const POST = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('viewings.create');
  const body = await readBody(request, viewingCreateSchema);

  await assertExists(PropertyModel, body.property, 'Property', auth.readScope('properties'));
  await assertExists(Lead, body.lead ?? undefined, 'Lead', auth.readScope('leads'));
  await assertExists(Client, body.client ?? undefined, 'Client', auth.readScope('clients'));
  const assigned_agent = await resolveAssignee(auth, 'viewings', body.assigned_agent, { required: true });

  const viewing = await Viewing.create(compact({ ...body, assigned_agent, created_by: auth.id }));
  return ok(await Viewing.findById(viewing._id).populate(VIEWING_POPULATE).lean(), { status: 201 });
});
