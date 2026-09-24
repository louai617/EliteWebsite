import mongoose from 'mongoose';
import { apiHandler, ok, readBody } from '@/lib/server/http';
import { Lead, PropertyModel } from '@/lib/server/models';
import { getAuth } from '@/lib/server/auth/session';
import { clientIp, rateLimit } from '@/lib/server/auth/rateLimit';
import { compact } from '@/lib/server/services/common';
import { defaultLeadStatus, getSettings, statusKeysByCategory } from '@/lib/server/services/settings';
import { publicLeadSchema } from '@/lib/validation/crm';

/**
 * POST /api/public/leads — the website enquiry form (contact page and property pages).
 *
 * - Rate-limited per IP, with a hidden honeypot field against bots.
 * - Enquiries about a listing are routed to that listing's agent automatically.
 * - A repeat enquiry from someone who already has an open lead is merged into
 *   it (property added, message appended) instead of creating a duplicate.
 * - The response never reveals CRM data.
 */
export const POST = apiHandler(async (request) => {
  rateLimit(`public-lead:ip:${clientIp(request)}`, 5, 10 * 60_000);
  const body = await readBody(request, publicLeadSchema);

  // Bots fill every field; pretend success so they learn nothing.
  if (body.website) return ok({ received: true }, { status: 201 });

  const [settings, auth] = await Promise.all([getSettings(), getAuth(request)]);

  const property = body.propertyId
    ? await PropertyModel.findOne({ _id: new mongoose.Types.ObjectId(body.propertyId), is_active: true })
        .select('_id title_en purpose type location.area_en assigned_agent')
        .lean()
    : null;

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const messageLine = `[${stamp}] ${property ? `(${property.title_en}) ` : ''}${body.message}`;

  const existing = await Lead.findOne({
    email: body.email,
    status: { $in: statusKeysByCategory(settings, 'open') },
  }).sort({ created_at: -1 });

  if (existing) {
    if (property && !existing.interested_properties.some((id) => id.equals(property._id))) {
      existing.interested_properties.push(property._id);
    }
    existing.notes = [existing.notes, `Website enquiry ${messageLine}`].filter(Boolean).join('\n\n').slice(-10_000);
    if (!existing.phone && body.phone) existing.phone = body.phone;
    if (!existing.assigned_agent && property?.assigned_agent) existing.assigned_agent = property.assigned_agent;
    // Only link the account when it is the same person (prevents attaching yourself to someone else's lead).
    if (!existing.submitted_by && auth && auth.user.email === body.email) existing.submitted_by = auth.id;
    await existing.save();
    return ok({ received: true }, { status: 201 });
  }

  await Lead.create(
    compact({
      full_name: body.full_name,
      email: body.email,
      phone: body.phone ?? undefined,
      message: body.message,
      source: 'website_form',
      status: defaultLeadStatus(settings),
      priority: 'medium',
      interested_properties: property ? [property._id] : [],
      purpose: property?.purpose,
      property_type: property?.type,
      preferred_location: property?.location?.area_en,
      assigned_agent: property?.assigned_agent,
      submitted_by: auth?.id,
    })
  );

  return ok({ received: true }, { status: 201 });
});
