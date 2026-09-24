import { apiHandler, ok } from '@/lib/server/http';
import { Lead, PropertyModel, User, Viewing } from '@/lib/server/models';
import { requireAuth } from '@/lib/server/auth/session';
import { defaultLeadStatus, getSettings } from '@/lib/server/services/settings';

/**
 * GET /api/account/overview — what a website customer can see about themselves:
 * their enquiries (with a simplified status, never internal notes), upcoming
 * viewings and saved listings.
 */
export const GET = apiHandler(async (request) => {
  const auth = await requireAuth(request);
  const settings = await getSettings();
  const user = await User.findById(auth.id).select('saved_properties').lean();

  // Only enquiries made while signed in. Matching by email would expose another
  // person's enquiries to anyone who registers with their (unverified) address.
  const leads = await Lead.find({ submitted_by: auth.id })
    .select('status interested_properties created_at')
    .sort({ created_at: -1 })
    .limit(50)
    .populate({ path: 'interested_properties', select: 'title_en title_ar reference_number', match: { is_active: true } })
    .lean();

  const initial = defaultLeadStatus(settings);
  const categoryOf = (status: string) => settings.lead_statuses.find((s) => s.key === status)?.category ?? 'open';
  const publicStatus = (status: string) => {
    if (status === initial) return 'received';
    const category = categoryOf(status);
    return category === 'won' ? 'completed' : category === 'lost' ? 'closed' : 'in_progress';
  };

  const leadIds = leads.map((l) => l._id);
  const [viewings, saved] = await Promise.all([
    leadIds.length
      ? Viewing.find({ lead: { $in: leadIds }, status: { $in: ['scheduled', 'confirmed'] }, scheduled_at: { $gte: new Date() } })
          .select('scheduled_at status property')
          .sort({ scheduled_at: 1 })
          .populate({ path: 'property', select: 'title_en title_ar reference_number location.area_en' })
          .lean()
      : [],
    PropertyModel.find({ _id: { $in: user?.saved_properties ?? [] }, is_active: true })
      .select('title_en title_ar reference_number price currency price_frequency purpose images location.area_en')
      .lean(),
  ]);

  return ok({
    enquiries: leads.map((l) => ({
      _id: l._id,
      created_at: l.created_at,
      status: publicStatus(l.status),
      properties: l.interested_properties,
    })),
    viewings,
    saved: saved.map((p) => ({ ...p, images: (p.images ?? []).slice(0, 1) })),
  });
});
