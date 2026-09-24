import { apiHandler, conflict, notFound, ok, readBody, readId } from '@/lib/server/http';
import { Deal, Lead, Task, Viewing } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { andFilter, applyPatch, resolveAssignee } from '@/lib/server/services/common';
import { LEAD_POPULATE, loadLead, validateLeadRefs } from '@/lib/server/services/leads';
import { getSettings } from '@/lib/server/services/settings';
import { leadUpdateSchema } from '@/lib/validation/crm';

/** Lead with its related viewings, tasks and deals (looked up, not duplicated). */
export const GET = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);

  const lead = await Lead.findOne(andFilter({ _id: id }, auth.readScope('leads')))
    .populate(LEAD_POPULATE)
    .lean();
  if (!lead) throw notFound('Lead');

  const [viewings, tasks, deals] = await Promise.all([
    Viewing.find({ lead: id })
      .sort({ scheduled_at: -1 })
      .limit(50)
      .populate([{ path: 'property', select: 'title_en reference_number' }, { path: 'assigned_agent', select: 'full_name' }])
      .lean(),
    Task.find({ lead: id }).sort({ completed: 1, due_at: 1 }).limit(50).populate({ path: 'assigned_agent', select: 'full_name' }).lean(),
    Deal.find({ lead: id }).sort({ created_at: -1 }).limit(20).populate({ path: 'property', select: 'title_en reference_number' }).lean(),
  ]);

  return ok({ ...lead, viewings, tasks, deals });
});

export const PATCH = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  const body = await readBody(request, leadUpdateSchema);

  const lead = await Lead.findOne(andFilter({ _id: id }, auth.writeScope('leads')));
  if (!lead) throw notFound('Lead');

  const settings = await getSettings();
  await validateLeadRefs(auth, settings, body);

  const { assigned_agent, ...rest } = body;
  if (assigned_agent !== undefined) {
    lead.assigned_agent = (await resolveAssignee(auth, 'leads', assigned_agent)) ?? undefined;
  }
  applyPatch(lead, rest);
  await lead.save();

  return ok(await loadLead(lead._id));
});

export const DELETE = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  auth.require('leads.delete');
  const id = await readId(context);

  const lead = await Lead.findOne(andFilter({ _id: id }, auth.writeScope('leads'))).select('_id');
  if (!lead) throw notFound('Lead');

  if (await Deal.exists({ lead: id })) {
    throw conflict('This lead has deals attached. Mark it as lost instead of deleting it.');
  }

  await Task.deleteMany({ lead: id });
  // Viewings that only belonged to this lead go with it; the rest keep their client and lose the link.
  // (Sequential on purpose: the delete must run before the unset.)
  await Viewing.deleteMany({ lead: id, client: null });
  await Viewing.updateMany({ lead: id }, { $unset: { lead: 1 } });
  await lead.deleteOne();

  return ok({ deleted: true });
});
