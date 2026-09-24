import { apiHandler, ok } from '@/lib/server/http';
import { Lead } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { getSettings } from '@/lib/server/services/settings';

/** GET /api/leads/summary — lead counts per status, within the caller's scope. */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  const scope = auth.readScope('leads');
  const [settings, rows] = await Promise.all([
    getSettings(),
    Lead.aggregate<{ _id: string; count: number }>([
      { $match: scope },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  return ok({
    total: rows.reduce((sum, r) => sum + r.count, 0),
    by_status: settings.lead_statuses.map((s) => ({ ...s, count: counts[s.key] ?? 0 })),
  });
});
