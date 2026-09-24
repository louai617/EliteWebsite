import { apiHandler, escapeRegex, ok, pageMeta, readBody, readQuery } from '@/lib/server/http';
import { Client } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import {
  AGENT_POPULATE,
  agentFilter,
  andFilter,
  compact,
  parseSort,
  resolveAssignee,
  type Filter,
} from '@/lib/server/services/common';
import { clientCreateSchema, clientListQuery } from '@/lib/validation/crm';

/** GET /api/clients?page=&limit=&q=&type=&assigned_agent=&sort= */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  const q = readQuery(request, clientListQuery);

  const filters: Filter = {};
  if (q.type) filters.types = q.type;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const or: Filter[] = [{ full_name: rx }, { email: rx }, { company: rx }];
    const digits = q.q.replace(/\D/g, '');
    if (digits.length >= 3) or.push({ phone_digits: { $regex: escapeRegex(digits) } });
    filters.$or = or;
  }
  const filter = andFilter(auth.readScope('clients'), agentFilter(auth, q.assigned_agent), filters);

  const [items, total] = await Promise.all([
    Client.find(filter)
      .sort(parseSort(q.sort))
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(AGENT_POPULATE)
      .lean(),
    Client.countDocuments(filter),
  ]);
  return ok(items, { meta: pageMeta(q.page, q.limit, total) });
});

export const POST = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('clients.create');
  const body = await readBody(request, clientCreateSchema);
  const assigned_agent = await resolveAssignee(auth, 'clients', body.assigned_agent);

  const client = await Client.create(compact({ ...body, assigned_agent, created_by: auth.id }));
  const created = await Client.findById(client._id).populate(AGENT_POPULATE).lean();
  return ok(created, { status: 201 });
});
