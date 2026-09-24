import { apiHandler, escapeRegex, ok, pageMeta, readBody, readQuery } from '@/lib/server/http';
import { PropertyModel } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import {
  agentFilter,
  andFilter,
  compact,
  parseSort,
  resolveAssignee,
  toObjectId,
  type Filter,
} from '@/lib/server/services/common';
import {
  generateReferenceNumber,
  inquiryCounts,
  preparePropertyInput,
  PROPERTY_POPULATE,
  redactProperty,
} from '@/lib/server/services/properties';
import { getSettings } from '@/lib/server/services/settings';
import { propertyCreateSchema, propertyListQuery } from '@/lib/validation/crm';

/** Lightweight projection for tables and pickers — no descriptions, market data or galleries. */
const LIST_FIELDS =
  'reference_number title_en title_ar type purpose status is_active is_featured price currency price_frequency bedrooms bathrooms area_sqm furnishing location.area_key location.area_en location.community_en location.city_en images assigned_agent owner views created_at updated_at';

/**
 * GET /api/properties?page=&limit=&q=&location=&type=&purpose=&status=&furnishing=
 *   &price_min=&price_max=&bedrooms=&bathrooms=&assigned_agent=&is_active=&sort=
 */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  const q = readQuery(request, propertyListQuery);

  const filters: Filter = {};
  if (q.type) filters.type = q.type;
  if (q.purpose) filters.purpose = q.purpose;
  if (q.status) filters.status = q.status;
  if (q.furnishing) filters.furnishing = q.furnishing;
  if (q.is_active !== undefined) filters.is_active = q.is_active;
  if (q.is_featured !== undefined) filters.is_featured = q.is_featured;
  if (q.owner) filters.owner = toObjectId(q.owner);
  if (q.bedrooms !== undefined) filters.bedrooms = q.bedrooms >= 5 ? { $gte: 5 } : q.bedrooms;
  if (q.bathrooms !== undefined) filters.bathrooms = q.bathrooms >= 5 ? { $gte: 5 } : q.bathrooms;
  if (q.price_min !== undefined || q.price_max !== undefined) {
    filters.price = {
      ...(q.price_min !== undefined ? { $gte: q.price_min } : {}),
      ...(q.price_max !== undefined ? { $lte: q.price_max } : {}),
    };
  }

  const location: Filter = q.location
    ? {
        $or: [
          { 'location.area_key': q.location },
          { 'location.area_en': q.location },
          { 'location.community_en': q.location },
        ],
      }
    : {};

  const search: Filter = {};
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    search.$or = [
      // Anchored + case-sensitive on the upper-cased field, so the unique index is used.
      { reference_number: new RegExp(`^${escapeRegex(q.q.toUpperCase())}`) },
      { title_en: rx },
      { 'location.community_en': rx },
      { 'location.area_en': rx },
    ];
  }

  const filter = andFilter(auth.readScope('properties'), agentFilter(auth, q.assigned_agent), filters, location, search);

  const [items, total] = await Promise.all([
    PropertyModel.find(filter)
      .select(LIST_FIELDS)
      .sort(parseSort(q.sort))
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate(PROPERTY_POPULATE)
      .lean(),
    PropertyModel.countDocuments(filter),
  ]);

  const counts = await inquiryCounts(items.map((p) => p._id));
  const data = items.map((p) => ({
    ...redactProperty(auth, p as unknown as Record<string, unknown> & { _id: unknown }),
    images: (p.images ?? []).slice(0, 1),
    inquiries: counts.get(String(p._id)) ?? 0,
  }));

  return ok(data, { meta: pageMeta(q.page, q.limit, total) });
});

export const POST = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('properties.create');
  const body = await readBody(request, propertyCreateSchema);
  const settings = await getSettings();

  await preparePropertyInput(auth, settings, body);
  const assigned_agent = await resolveAssignee(auth, 'properties', body.assigned_agent, { defaultToSelf: auth.role === 'broker' });
  const reference_number = body.reference_number ?? (await generateReferenceNumber());

  const property = await PropertyModel.create(
    compact({
      ...body,
      reference_number,
      assigned_agent,
      listed_at: body.is_active ? new Date() : undefined,
      created_by: auth.id,
    })
  );

  const created = await PropertyModel.findById(property._id).populate(PROPERTY_POPULATE).lean();
  return ok(created, { status: 201 });
});
