import { apiHandler, notFound, ok, readBody, readId } from '@/lib/server/http';
import { Client, Lead, PropertyModel, Task } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { andFilter, applyPatch, assertExists, resolveAssignee } from '@/lib/server/services/common';
import { taskUpdateSchema } from '@/lib/validation/crm';
import { TASK_POPULATE } from '@/lib/server/services/populate';

const CONTACT_TYPES = new Set(['call', 'whatsapp', 'email', 'meeting', 'viewing', 'follow_up']);

export const GET = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  const task = await Task.findOne(andFilter({ _id: id }, auth.readScope('tasks'))).populate(TASK_POPULATE).lean();
  if (!task) throw notFound('Task');
  return ok(task);
});

export const PATCH = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  const body = await readBody(request, taskUpdateSchema);

  const task = await Task.findOne(andFilter({ _id: id }, auth.writeScope('tasks')));
  if (!task) throw notFound('Task');

  await assertExists(Lead, body.lead ?? undefined, 'Lead', auth.readScope('leads'));
  await assertExists(Client, body.client ?? undefined, 'Client', auth.readScope('clients'));
  await assertExists(PropertyModel, body.property ?? undefined, 'Property', auth.readScope('properties'));

  const wasCompleted = task.completed;
  const { assigned_agent, ...rest } = body;
  if (assigned_agent !== undefined) {
    task.assigned_agent = (await resolveAssignee(auth, 'tasks', assigned_agent, { required: true }))!;
  }
  applyPatch(task, rest);
  await task.save();

  // Completing a contact-type task records the contact on the lead.
  if (task.completed && !wasCompleted && task.lead && CONTACT_TYPES.has(task.type ?? '')) {
    await Lead.updateOne({ _id: task.lead }, { $set: { last_contact_at: new Date() } });
  }

  return ok(await Task.findById(id).populate(TASK_POPULATE).lean());
});

export const DELETE = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  auth.require('tasks.delete');
  const id = await readId(context);
  const result = await Task.deleteOne(andFilter({ _id: id }, auth.writeScope('tasks')));
  if (result.deletedCount === 0) throw notFound('Task');
  return ok({ deleted: true });
});
