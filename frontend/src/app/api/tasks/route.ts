import { apiHandler, ok, pageMeta, readBody, readQuery } from '@/lib/server/http';
import { Client, Lead, PropertyModel, Task } from '@/lib/server/models';
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
import { TASK_POPULATE } from '@/lib/server/services/populate';
import { taskCreateSchema, taskListQuery } from '@/lib/validation/crm';

/** GET /api/tasks?page=&limit=&completed=false&overdue=true&type=&priority=&assigned_agent=&lead=&client= */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  const q = readQuery(request, taskListQuery);

  const filters: Filter = {};
  if (q.type) filters.type = q.type;
  if (q.priority) filters.priority = q.priority;
  if (q.completed !== undefined) filters.completed = q.completed;
  if (q.lead) filters.lead = toObjectId(q.lead);
  if (q.client) filters.client = toObjectId(q.client);
  if (q.overdue) {
    filters.completed = false;
    filters.due_at = { $lt: new Date() };
  }
  const filter = andFilter(auth.readScope('tasks'), agentFilter(auth, q.assigned_agent), filters);

  const [items, total] = await Promise.all([
    Task.find(filter)
      .sort(parseSort(q.sort))
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(TASK_POPULATE)
      .lean(),
    Task.countDocuments(filter),
  ]);
  return ok(items, { meta: pageMeta(q.page, q.limit, total) });
});

export const POST = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('tasks.create');
  const body = await readBody(request, taskCreateSchema);

  await assertExists(Lead, body.lead ?? undefined, 'Lead', auth.readScope('leads'));
  await assertExists(Client, body.client ?? undefined, 'Client', auth.readScope('clients'));
  await assertExists(PropertyModel, body.property ?? undefined, 'Property', auth.readScope('properties'));
  const assigned_agent = await resolveAssignee(auth, 'tasks', body.assigned_agent, { required: true });

  const task = await Task.create(compact({ ...body, assigned_agent, created_by: auth.id }));

  // A follow-up task with a due date sets the lead's next follow-up if it is sooner.
  if (task.lead && task.due_at && !task.completed) {
    await Lead.updateOne(
      { _id: task.lead, $or: [{ next_follow_up_at: null }, { next_follow_up_at: { $gt: task.due_at } }] },
      { $set: { next_follow_up_at: task.due_at } }
    );
  }

  return ok(await Task.findById(task._id).populate(TASK_POPULATE).lean(), { status: 201 });
});
