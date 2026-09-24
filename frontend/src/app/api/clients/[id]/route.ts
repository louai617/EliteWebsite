import { apiHandler, conflict, notFound, ok, readBody, readId } from '@/lib/server/http';
import { Client, Deal, Lead, PropertyModel, Task, Viewing } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { AGENT_POPULATE, andFilter, applyPatch, resolveAssignee } from '@/lib/server/services/common';
import { clientUpdateSchema } from '@/lib/validation/crm';

/** Client with related leads, owned properties, viewings, deals and open tasks. */
export const GET = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);

  const client = await Client.findOne(andFilter({ _id: id }, auth.readScope('clients')))
    .populate(AGENT_POPULATE)
    .lean();
  if (!client) throw notFound('Client');

  const [leads, properties, viewings, deals, tasks] = await Promise.all([
    Lead.find({ client: id }).select('full_name status source created_at assigned_agent').sort({ created_at: -1 }).limit(50).lean(),
    PropertyModel.find({ owner: id })
      .select('title_en reference_number status purpose price currency location.area_en')
      .sort({ created_at: -1 })
      .limit(50)
      .lean(),
    Viewing.find({ client: id })
      .sort({ scheduled_at: -1 })
      .limit(50)
      .populate({ path: 'property', select: 'title_en reference_number' })
      .lean(),
    Deal.find({ client: id })
      .sort({ created_at: -1 })
      .limit(50)
      .populate({ path: 'property', select: 'title_en reference_number' })
      .lean(),
    Task.find({ client: id, completed: false }).sort({ due_at: 1 }).limit(50).lean(),
  ]);

  return ok({ ...client, leads, properties, viewings, deals, tasks });
});

export const PATCH = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  const body = await readBody(request, clientUpdateSchema);

  const client = await Client.findOne(andFilter({ _id: id }, auth.writeScope('clients')));
  if (!client) throw notFound('Client');

  const { assigned_agent, ...rest } = body;
  if (assigned_agent !== undefined) {
    client.assigned_agent = (await resolveAssignee(auth, 'clients', assigned_agent)) ?? undefined;
  }
  applyPatch(client, rest);
  await client.save();

  return ok(await Client.findById(id).populate(AGENT_POPULATE).lean());
});

export const DELETE = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  auth.require('clients.delete');
  const id = await readId(context);

  const client = await Client.findOne(andFilter({ _id: id }, auth.writeScope('clients'))).select('_id');
  if (!client) throw notFound('Client');

  const [hasDeals, ownsProperties] = await Promise.all([
    Deal.exists({ client: id }),
    PropertyModel.exists({ owner: id }),
  ]);
  if (hasDeals) throw conflict('This client has deals attached and cannot be deleted.');
  if (ownsProperties) throw conflict('This client owns listed properties. Reassign the owner first.');

  await Task.deleteMany({ client: id });
  // Viewings that only belonged to this client go with it; the rest keep their lead.
  await Viewing.deleteMany({ client: id, lead: null });
  await Viewing.updateMany({ client: id }, { $unset: { client: 1 } });
  await Lead.updateMany({ client: id }, { $unset: { client: 1 } });
  await client.deleteOne();

  return ok({ deleted: true });
});
