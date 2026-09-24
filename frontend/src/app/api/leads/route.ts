import { apiHandler, ok, pageMeta, readBody, readQuery } from '@/lib/server/http';
import { Lead } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { compact, parseSort, resolveAssignee } from '@/lib/server/services/common';
import { buildLeadFilter, LEAD_POPULATE, loadLead, validateLeadRefs } from '@/lib/server/services/leads';
import { defaultLeadStatus, getSettings } from '@/lib/server/services/settings';
import { leadCreateSchema, leadListQuery } from '@/lib/validation/crm';

/** GET /api/leads?page=1&limit=20&q=&status=&source=&assigned_agent=&priority=&sort=-created_at */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  const q = readQuery(request, leadListQuery);
  const filter = buildLeadFilter(auth, q);

  const [items, total] = await Promise.all([
    Lead.find(filter)
      .sort(parseSort(q.sort))
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(LEAD_POPULATE)
      .lean(),
    Lead.countDocuments(filter),
  ]);

  return ok(items, { meta: pageMeta(q.page, q.limit, total) });
});

export const POST = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('leads.create');
  const body = await readBody(request, leadCreateSchema);
  const settings = await getSettings();

  await validateLeadRefs(auth, settings, body);
  const assigned_agent = await resolveAssignee(auth, 'leads', body.assigned_agent);

  const lead = await Lead.create(
    compact({
      ...body,
      source: body.source ?? 'walk_in',
      status: body.status ?? defaultLeadStatus(settings),
      assigned_agent,
      created_by: auth.id,
    })
  );

  return ok(await loadLead(lead._id), { status: 201 });
});
