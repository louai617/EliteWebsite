import { apiHandler, badRequest, notFound, ok, readBody, readId } from '@/lib/server/http';
import { Client, Deal, Lead, PropertyModel } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { andFilter, applyPatch, assertExists, resolveAssignee } from '@/lib/server/services/common';
import { DEAL_POPULATE, syncDealSideEffects } from '@/lib/server/services/deals';
import { dealUpdateSchema } from '@/lib/validation/crm';

export const GET = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  const deal = await Deal.findOne(andFilter({ _id: id }, auth.readScope('deals'))).populate(DEAL_POPULATE).lean();
  if (!deal) throw notFound('Deal');
  return ok(deal);
});

export const PATCH = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  const body = await readBody(request, dealUpdateSchema);

  const deal = await Deal.findOne(andFilter({ _id: id }, auth.writeScope('deals')));
  if (!deal) throw notFound('Deal');

  if (body.property === null) throw badRequest('A deal must have a property.');
  await assertExists(PropertyModel, body.property ?? undefined, 'Property', auth.readScope('properties'));
  await assertExists(Lead, body.lead ?? undefined, 'Lead', auth.readScope('leads'));
  await assertExists(Client, body.client ?? undefined, 'Client', auth.readScope('clients'));

  const previousStatus = deal.status;
  const { assigned_agent, ...rest } = body;
  if (assigned_agent !== undefined) {
    deal.assigned_agent = (await resolveAssignee(auth, 'deals', assigned_agent, { required: true }))!;
  }
  // Recompute the commission from the percentage unless an explicit amount was sent.
  if ((rest.amount !== undefined || rest.commission_percentage !== undefined) && rest.commission_amount === undefined) {
    deal.commission_amount = undefined;
  }
  applyPatch(deal, rest);
  if (deal.status === 'completed' && previousStatus !== 'completed') deal.closed_at = new Date();
  if (deal.status !== 'completed') deal.closed_at = undefined;
  await deal.save();

  if (deal.status !== previousStatus) await syncDealSideEffects(deal);
  return ok(await Deal.findById(id).populate(DEAL_POPULATE).lean());
});

export const DELETE = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  auth.require('deals.delete');
  const id = await readId(context);
  const result = await Deal.deleteOne(andFilter({ _id: id }, auth.writeScope('deals')));
  if (result.deletedCount === 0) throw notFound('Deal');
  return ok({ deleted: true });
});
