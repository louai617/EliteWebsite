import { apiHandler, readQuery } from '@/lib/server/http';
import { Lead } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { parseSort } from '@/lib/server/services/common';
import { buildLeadFilter } from '@/lib/server/services/leads';
import { leadListQuery } from '@/lib/validation/crm';

const MAX_ROWS = 5000;

/** Quote a CSV cell and neutralise spreadsheet formula injection (=, +, -, @). */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** GET /api/leads/export — same filters as the list, as CSV (max 5,000 rows). */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  const q = readQuery(request, leadListQuery);
  const filter = buildLeadFilter(auth, q);

  const leads = await Lead.find(filter)
    .sort(parseSort(q.sort))
    .limit(MAX_ROWS)
    .populate([
      { path: 'assigned_agent', select: 'full_name' },
      { path: 'interested_properties', select: 'reference_number' },
    ])
    .lean();

  const header = [
    'Name', 'Phone', 'Email', 'WhatsApp', 'Source', 'Status', 'Priority', 'Assigned Agent',
    'Properties', 'Property Type', 'Location', 'Budget Min', 'Budget Max', 'Bedrooms',
    'Next Follow-up', 'Created',
  ];
  const rows = leads.map((lead) => {
    const agent = lead.assigned_agent as unknown as { full_name?: string } | undefined;
    const props = (lead.interested_properties as unknown as { reference_number?: string }[] | undefined) ?? [];
    return [
      lead.full_name, lead.phone, lead.email, lead.whatsapp, lead.source, lead.status, lead.priority,
      agent?.full_name, props.map((p) => p.reference_number).join(' '), lead.property_type,
      lead.preferred_location, lead.budget_min, lead.budget_max, lead.bedrooms,
      lead.next_follow_up_at, lead.created_at,
    ].map(csvCell).join(',');
  });

  const csv = '﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
