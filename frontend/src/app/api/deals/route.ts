import { apiHandler, ok, pageMeta, readBody, readQuery } from '@/lib/server/http';
import { Client, Deal, Lead, PropertyModel } from '@/lib/server/models';
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
import { DEAL_POPULATE, syncDealSideEffects } from '@/lib/server/services/deals';
import { dealCreateSchema, dealListQuery } from '@/lib/validation/crm';

/** GET /api/deals?page=&limit=&status=&type=&assigned_agent=&property=&client=&sort= */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  const q = readQuery(request, dealListQuery);

  const filters: Filter = {};
  if (q.status) filters.status = q.status;
  if (q.type) filters.type = q.type;
  if (q.property) filters.property = toObjectId(q.property);
  if (q.client) filters.client = toObjectId(q.client);
  if (q.lead) filters.lead = toObjectId(q.lead);
  const filter = andFilter(auth.readScope('deals'), agentFilter(auth, q.assigned_agent), filters);

  const [items, total, totals] = await Promise.all([
    Deal.find(filter)
      .sort(parseSort(q.sort))
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(DEAL_POPULATE)
      .lean(),
    Deal.countDocuments(filter),
    Deal.aggregate<{ _id: null; amount: number; commission: number }>([
      { $match: filter },
      { $group: { _id: null, amount: { $sum: '$amount' }, commission: { $sum: { $ifNull: ['$commission_amount', 0] } } } },
    ]),
  ]);

  return ok(items, {
    meta: { ...pageMeta(q.page, q.limit, total), totals: { amount: totals[0]?.amount ?? 0, commission: totals[0]?.commission ?? 0 } },
  });
});

export const POST = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('deals.create');
  const body = await readBody(request, dealCreateSchema);

  await assertExists(PropertyModel, body.property, 'Property', auth.readScope('properties'));
  await assertExists(Lead, body.lead ?? undefined, 'Lead', auth.readScope('leads'));
  await assertExists(Client, body.client ?? undefined, 'Client', auth.readScope('clients'));
  const assigned_agent = await resolveAssignee(auth, 'deals', body.assigned_agent, { required: true });

  const deal = await Deal.create(
    compact({
      ...body,
      assigned_agent,
      deal_date: body.deal_date ?? new Date(),
      closed_at: body.status === 'completed' ? new Date() : undefined,
      created_by: auth.id,
    })
  );
  await syncDealSideEffects(deal);

  return ok(await Deal.findById(deal._id).populate(DEAL_POPULATE).lean(), { status: 201 });
});
