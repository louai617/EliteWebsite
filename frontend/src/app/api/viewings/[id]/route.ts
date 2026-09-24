import { apiHandler, badRequest, notFound, ok, readBody, readId } from '@/lib/server/http';
import { Client, Lead, PropertyModel, Viewing } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { andFilter, applyPatch, assertExists, resolveAssignee } from '@/lib/server/services/common';
import { viewingUpdateSchema } from '@/lib/validation/crm';
import { VIEWING_POPULATE } from '@/lib/server/services/populate';

export const GET = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  const viewing = await Viewing.findOne(andFilter({ _id: id }, auth.readScope('viewings')))
    .populate(VIEWING_POPULATE)
    .lean();
  if (!viewing) throw notFound('Viewing');
  return ok(viewing);
});

export const PATCH = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  const body = await readBody(request, viewingUpdateSchema);

  const viewing = await Viewing.findOne(andFilter({ _id: id }, auth.writeScope('viewings')));
  if (!viewing) throw notFound('Viewing');

  if (body.property === null) throw badRequest('A viewing must have a property.');
  await assertExists(PropertyModel, body.property ?? undefined, 'Property', auth.readScope('properties'));
  await assertExists(Lead, body.lead ?? undefined, 'Lead', auth.readScope('leads'));
  await assertExists(Client, body.client ?? undefined, 'Client', auth.readScope('clients'));

  const { assigned_agent, ...rest } = body;
  if (assigned_agent !== undefined) {
    viewing.assigned_agent = (await resolveAssignee(auth, 'viewings', assigned_agent, { required: true }))!;
  }
  // A new time means the reminder has not been sent for it yet.
  if (rest.scheduled_at || rest.reminder_minutes !== undefined) viewing.reminder_sent_at = undefined;
  applyPatch(viewing, rest);
  await viewing.save();

  // Completing a viewing counts as contact with the lead.
  if (rest.status === 'completed' && viewing.lead) {
    await Lead.updateOne({ _id: viewing.lead }, { $set: { last_contact_at: new Date() } });
  }

  return ok(await Viewing.findById(id).populate(VIEWING_POPULATE).lean());
});

export const DELETE = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  auth.require('viewings.delete');
  const id = await readId(context);
  const result = await Viewing.deleteOne(andFilter({ _id: id }, auth.writeScope('viewings')));
  if (result.deletedCount === 0) throw notFound('Viewing');
  return ok({ deleted: true });
});
