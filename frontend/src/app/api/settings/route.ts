import { apiHandler, conflict, ok, readBody } from '@/lib/server/http';
import { Lead, PropertyModel, Setting } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { getSettings, invalidateSettingsCache } from '@/lib/server/services/settings';
import { settingsUpdateSchema } from '@/lib/validation/crm';

/** GET /api/settings — configurable lists (statuses, sources, locations, types) + AI config. */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('settings.read');
  return ok(await getSettings());
});

/** PUT /api/settings — admins only. Only the sections sent are replaced. */
export const PUT = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('settings.update');
  const body = await readBody(request, settingsUpdateSchema);
  const current = await getSettings();

  // Refuse to delete a status / type that records still use — they would become orphaned.
  if (body.lead_statuses) {
    const kept = new Set(body.lead_statuses.map((s) => s.key));
    const removed = current.lead_statuses.map((s) => s.key).filter((k) => !kept.has(k));
    const inUse = removed.length ? await Lead.distinct('status', { status: { $in: removed } }) : [];
    if (inUse.length) {
      throw conflict(`These lead statuses are still used by leads: ${inUse.join(', ')}. Move those leads first.`);
    }
  }
  if (body.property_types) {
    const kept = new Set(body.property_types.map((t) => t.key));
    const removed = current.property_types.map((t) => t.key).filter((k) => !kept.has(k));
    const inUse = removed.length ? await PropertyModel.distinct('type', { type: { $in: removed } }) : [];
    if (inUse.length) {
      throw conflict(`These property types are still used by listings: ${inUse.join(', ')}.`);
    }
  }

  const update = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
  await Setting.updateOne({ key: 'crm' }, { $set: update }, { upsert: true, runValidators: true });
  invalidateSettingsCache();

  return ok(await getSettings());
});
