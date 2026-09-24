import { z } from 'zod';
import { apiHandler, ok, readQuery } from '@/lib/server/http';
import { Deal, Lead, PropertyModel, Task, User, Viewing } from '@/lib/server/models';
import { requireStaff, type Auth } from '@/lib/server/auth/session';
import { andFilter, type Filter } from '@/lib/server/services/common';
import { defaultLeadStatus, getSettings, statusKeysByCategory } from '@/lib/server/services/settings';
import { VIEWING_POPULATE, TASK_POPULATE } from '@/lib/server/services/populate';

const DAY = 86_400_000;
const TZ = 'Asia/Qatar';

const statsQuery = z.object({
  range: z.enum(['7d', '30d', '12m']).default('30d'),
});

/** Scope for a resource, or `null` if the user may not read it at all. */
function scopeOrNull(auth: Auth, resource: Parameters<Auth['readScope']>[0]): Filter | null {
  try {
    return auth.readScope(resource);
  } catch {
    return null;
  }
}

const pctChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : Math.round(((current - previous) / previous) * 100);

/** GET /api/dashboard/stats?range=7d|30d|12m — every number comes from the database. */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  const { range } = readQuery(request, statsQuery);
  const settings = await getSettings();
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * DAY);
  const prev30 = new Date(now.getTime() - 60 * DAY);

  const leadScope = scopeOrNull(auth, 'leads');
  const propertyScope = scopeOrNull(auth, 'properties');
  const viewingScope = scopeOrNull(auth, 'viewings');
  const dealScope = scopeOrNull(auth, 'deals');
  const taskScope = scopeOrNull(auth, 'tasks');

  const openKeys = statusKeysByCategory(settings, 'open');
  const wonKeys = statusKeysByCategory(settings, 'won');
  const lostKeys = statusKeysByCategory(settings, 'lost');

  // ----- Leads --------------------------------------------------------------
  const leadsPromise = leadScope
    ? Promise.all([
        Lead.countDocuments(leadScope),
        Lead.countDocuments(andFilter(leadScope, { status: defaultLeadStatus(settings) })),
        Lead.countDocuments(andFilter(leadScope, { status: { $in: openKeys } })),
        Lead.countDocuments(andFilter(leadScope, { status: { $in: wonKeys } })),
        Lead.countDocuments(andFilter(leadScope, { status: { $in: lostKeys } })),
        Lead.countDocuments(andFilter(leadScope, { created_at: { $gte: last30 } })),
        Lead.countDocuments(andFilter(leadScope, { created_at: { $gte: prev30, $lt: last30 } })),
        Lead.countDocuments(andFilter(leadScope, { created_at: { $gte: new Date(now.getTime() - DAY) } })),
        Lead.find(leadScope)
          .sort({ created_at: -1 })
          .limit(5)
          .select('full_name status source created_at interested_properties')
          .populate({ path: 'interested_properties', select: 'title_en' })
          .lean(),
      ]).then(([total, fresh, active, converted, lost, last30Count, prev30Count, today, recent]) => ({
        total,
        new: fresh,
        active,
        converted,
        lost,
        today,
        last_30_days: last30Count,
        change_30d: pctChange(last30Count, prev30Count),
        conversion_rate: converted + lost > 0 ? Math.round((converted / (converted + lost)) * 100) : null,
        recent,
      }))
    : Promise.resolve(null);

  // ----- Lead growth series & demand by area --------------------------------
  const seriesPromise = leadScope
    ? (() => {
        const monthly = range === '12m';
        const since = monthly
          ? new Date(now.getFullYear(), now.getMonth() - 11, 1)
          : new Date(now.getTime() - (range === '7d' ? 6 : 29) * DAY);
        since.setHours(0, 0, 0, 0);
        const format = monthly ? '%Y-%m' : '%Y-%m-%d';
        return Lead.aggregate<{ _id: string; count: number }>([
          { $match: andFilter(leadScope, { created_at: { $gte: since } }) },
          { $group: { _id: { $dateToString: { format, date: '$created_at', timezone: TZ } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]).then((rows) => {
          const counts = new Map(rows.map((r) => [r._id, r.count]));
          const points: { label: string; count: number }[] = [];
          const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
          if (monthly) {
            for (let i = 11; i >= 0; i--) {
              const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
              const key = fmt.format(d).slice(0, 7);
              points.push({ label: key, count: counts.get(key) ?? 0 });
            }
          } else {
            const days = range === '7d' ? 7 : 30;
            for (let i = days - 1; i >= 0; i--) {
              const key = fmt.format(new Date(now.getTime() - i * DAY));
              points.push({ label: key, count: counts.get(key) ?? 0 });
            }
          }
          return points;
        });
      })()
    : Promise.resolve([]);

  const areasPromise = leadScope
    ? Lead.aggregate<{ _id: string; count: number }>([
        { $match: andFilter(leadScope, { preferred_location: { $nin: [null, ''] } }) },
        { $group: { _id: '$preferred_location', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]).then((rows) => rows.map((r) => ({ area: r._id, count: r.count })))
    : Promise.resolve([]);

  // ----- Properties ---------------------------------------------------------
  const propertiesPromise = propertyScope
    ? Promise.all([
        PropertyModel.aggregate<{ _id: string; count: number }>([
          { $match: propertyScope },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        PropertyModel.countDocuments(andFilter(propertyScope, { is_active: true })),
        PropertyModel.countDocuments(andFilter(propertyScope, { created_at: { $gte: last30 } })),
        PropertyModel.countDocuments(andFilter(propertyScope, { created_at: { $gte: prev30, $lt: last30 } })),
        PropertyModel.aggregate<{ _id: string; count: number }>([
          { $match: andFilter(propertyScope, { 'location.area_en': { $nin: [null, ''] } }) },
          { $group: { _id: '$location.area_en', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ]),
      ]).then(([byStatus, active, last30Count, prev30Count, byArea]) => {
        const counts = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
        return {
          total: byStatus.reduce((sum, r) => sum + r.count, 0),
          active_listings: active,
          available: counts.available ?? 0,
          reserved: (counts.reserved ?? 0) + (counts.under_offer ?? 0),
          rented: counts.rented ?? 0,
          sold: counts.sold ?? 0,
          off_market: counts.off_market ?? 0,
          change_30d: pctChange(last30Count, prev30Count),
          by_area: byArea.map((r) => ({ area: r._id, count: r.count })),
        };
      })
    : Promise.resolve(null);

  // ----- Viewings -----------------------------------------------------------
  const viewingsPromise = viewingScope
    ? Promise.all([
        Viewing.countDocuments(andFilter(viewingScope, { status: { $in: ['scheduled', 'confirmed'] }, scheduled_at: { $gte: now } })),
        Viewing.countDocuments(andFilter(viewingScope, { status: 'completed', scheduled_at: { $gte: last30 } })),
        Viewing.find(andFilter(viewingScope, { status: { $in: ['scheduled', 'confirmed'] }, scheduled_at: { $gte: now } }))
          .sort({ scheduled_at: 1 })
          .limit(5)
          .populate(VIEWING_POPULATE)
          .lean(),
      ]).then(([upcoming, completed30, next]) => ({ upcoming, completed_30d: completed30, next }))
    : Promise.resolve(null);

  // ----- Tasks / follow-ups ---------------------------------------------------
  const tasksPromise = taskScope
    ? Promise.all([
        Task.countDocuments(andFilter(taskScope, { completed: false })),
        Task.countDocuments(andFilter(taskScope, { completed: false, due_at: { $lt: now } })),
        leadScope ? Lead.countDocuments(andFilter(leadScope, { next_follow_up_at: { $lte: now }, status: { $in: openKeys } })) : 0,
        Task.find(andFilter(taskScope, { completed: false }))
          .sort({ due_at: 1 })
          .limit(5)
          .populate(TASK_POPULATE)
          .lean(),
      ]).then(([pending, overdue, followUpsDue, next]) => ({ pending, overdue, lead_follow_ups_due: followUpsDue, next }))
    : Promise.resolve(null);

  // ----- Deals & revenue ----------------------------------------------------
  const dealsPromise = dealScope
    ? Deal.aggregate<{ _id: string; count: number; amount: number; commission: number }>([
        { $match: dealScope },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            amount: { $sum: '$amount' },
            commission: { $sum: { $ifNull: ['$commission_amount', 0] } },
          },
        },
      ]).then(async (rows) => {
        const by = Object.fromEntries(rows.map((r) => [r._id, r]));
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [thisMonth] = await Deal.aggregate<{ amount: number; commission: number; count: number }>([
          { $match: andFilter(dealScope, { status: 'completed', closed_at: { $gte: monthStart } }) },
          { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' }, commission: { $sum: { $ifNull: ['$commission_amount', 0] } } } },
        ]);
        const pipeline = ['negotiation', 'reserved', 'contracted'].map((s) => by[s]).filter(Boolean);
        return {
          total: rows.reduce((sum, r) => sum + r.count, 0),
          by_status: Object.fromEntries(rows.map((r) => [r._id, r.count])),
          open: pipeline.reduce((sum, r) => sum + r.count, 0),
          pipeline_value: pipeline.reduce((sum, r) => sum + r.amount, 0),
          completed: by.completed?.count ?? 0,
          revenue: by.completed?.amount ?? 0,
          commission: by.completed?.commission ?? 0,
          this_month: {
            count: thisMonth?.count ?? 0,
            revenue: thisMonth?.amount ?? 0,
            commission: thisMonth?.commission ?? 0,
          },
        };
      })
    : Promise.resolve(null);

  // ----- Agent performance (managers/admins) --------------------------------
  const agentsPromise = auth.can('reports.read_all')
    ? Promise.all([
        Lead.aggregate<{ _id: unknown; leads: number; won: number }>([
          { $match: { assigned_agent: { $ne: null } } },
          { $group: { _id: '$assigned_agent', leads: { $sum: 1 }, won: { $sum: { $cond: [{ $in: ['$status', wonKeys] }, 1, 0] } } } },
        ]),
        Deal.aggregate<{ _id: unknown; deals: number; revenue: number; commission: number }>([
          { $match: { status: 'completed' } },
          { $group: { _id: '$assigned_agent', deals: { $sum: 1 }, revenue: { $sum: '$amount' }, commission: { $sum: { $ifNull: ['$commission_amount', 0] } } } },
        ]),
        Viewing.aggregate<{ _id: unknown; viewings: number }>([
          { $match: { status: 'completed' } },
          { $group: { _id: '$assigned_agent', viewings: { $sum: 1 } } },
        ]),
        PropertyModel.aggregate<{ _id: unknown; listings: number }>([
          { $match: { assigned_agent: { $ne: null } } },
          { $group: { _id: '$assigned_agent', listings: { $sum: 1 } } },
        ]),
        User.find({ role: { $in: ['admin', 'manager', 'broker'] }, is_active: true }).select('full_name photo role').lean(),
      ]).then(([leads, deals, viewings, listings, users]) => {
        const map = <T extends { _id: unknown }>(rows: T[]) => new Map(rows.map((r) => [String(r._id), r]));
        const L = map(leads), D = map(deals), V = map(viewings), P = map(listings);
        return users
          .map((u) => {
            const id = String(u._id);
            const leadCount = L.get(id)?.leads ?? 0;
            const won = L.get(id)?.won ?? 0;
            return {
              _id: id,
              full_name: u.full_name,
              photo: u.photo ?? null,
              role: u.role,
              listings: P.get(id)?.listings ?? 0,
              leads: leadCount,
              won_leads: won,
              conversion_rate: leadCount ? Math.round((won / leadCount) * 100) : null,
              viewings_completed: V.get(id)?.viewings ?? 0,
              deals_completed: D.get(id)?.deals ?? 0,
              revenue: D.get(id)?.revenue ?? 0,
              commission: D.get(id)?.commission ?? 0,
            };
          })
          .filter((a) => a.listings || a.leads || a.deals_completed || a.viewings_completed || a.role === 'broker')
          .sort((a, b) => b.commission - a.commission || b.won_leads - a.won_leads || b.leads - a.leads);
      })
    : Promise.resolve(null);

  const [leads, lead_growth, demand_by_area, properties, viewings, tasks, deals, agents] = await Promise.all([
    leadsPromise,
    seriesPromise,
    areasPromise,
    propertiesPromise,
    viewingsPromise,
    tasksPromise,
    dealsPromise,
    agentsPromise,
  ]);

  return ok({
    scope: leadScope && Object.keys(leadScope).length > 0 ? 'mine' : 'all',
    range,
    leads,
    lead_growth,
    demand_by_area,
    properties,
    viewings,
    tasks,
    deals,
    agents,
    currency: 'QAR',
  });
});
