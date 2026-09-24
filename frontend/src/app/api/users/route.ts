import { apiHandler, conflict, escapeRegex, forbidden, ok, pageMeta, readBody, readQuery } from '@/lib/server/http';
import { User, USER_PUBLIC_FIELDS } from '@/lib/server/models';
import { requireStaff } from '@/lib/server/auth/session';
import { hashPassword } from '@/lib/server/auth/password';
import { compact, parseSort, type Filter } from '@/lib/server/services/common';
import { STAFF_ROLES } from '@/lib/shared/constants';
import { ROLE_RANK } from '@/lib/shared/permissions';
import { userCreateSchema, userListQuery } from '@/lib/validation/crm';

/**
 * GET /api/users — team directory.
 * With `users.read_all` you get full profiles of everyone; otherwise only the
 * names/photos of active staff (enough to show "assigned to" and pick agents).
 */
export const GET = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('users.read');
  const q = readQuery(request, userListQuery);
  const full = auth.can('users.read_all');

  const staffOnly = q.staff || !full;
  if (q.role && staffOnly && !STAFF_ROLES.includes(q.role)) {
    return ok([], { meta: pageMeta(q.page, q.limit, 0) });
  }

  const filter: Filter = {};
  if (q.role) filter.role = q.role;
  else if (staffOnly) filter.role = { $in: STAFF_ROLES };
  if (!full) filter.is_active = true;
  else if (q.is_active !== undefined) filter.is_active = q.is_active;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ full_name: rx }, { email: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select(full ? USER_PUBLIC_FIELDS : '_id full_name photo role title_en')
      .sort(parseSort(q.sort))
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return ok(items, { meta: pageMeta(q.page, q.limit, total) });
});

export const POST = apiHandler(async (request) => {
  const auth = await requireStaff(request);
  auth.require('users.create');
  const body = await readBody(request, userCreateSchema);

  if (auth.role !== 'admin' && ROLE_RANK[body.role] >= ROLE_RANK[auth.role]) {
    throw forbidden('You can only create accounts below your own role.');
  }
  if (auth.role !== 'admin' && (body.permissions?.length || body.revoked_permissions?.length)) {
    throw forbidden('Only administrators can change individual permissions.');
  }
  if (await User.exists({ email: body.email })) throw conflict('A user with this email already exists.');

  const { password, ...profile } = body;
  const user = await User.create(compact({ ...profile, password_hash: await hashPassword(password) }));
  return ok(await User.findById(user._id).select(USER_PUBLIC_FIELDS).lean(), { status: 201 });
});
