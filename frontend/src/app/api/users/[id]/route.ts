import { apiHandler, badRequest, conflict, forbidden, notFound, ok, readBody, readId } from '@/lib/server/http';
import { Client, Deal, Lead, PropertyModel, Task, User, USER_PUBLIC_FIELDS, Viewing } from '@/lib/server/models';
import { requireStaff, type Auth } from '@/lib/server/auth/session';
import { hashPassword } from '@/lib/server/auth/password';
import { applyPatch } from '@/lib/server/services/common';
import type { Role } from '@/lib/shared/constants';
import { ROLE_RANK } from '@/lib/shared/permissions';
import { userUpdateSchema } from '@/lib/validation/crm';

/** Non-admins may only manage users ranked below them (managers → brokers, staff, customers). */
function assertCanManage(auth: Auth, targetRole: Role) {
  if (auth.role === 'admin') return;
  if (ROLE_RANK[targetRole] >= ROLE_RANK[auth.role]) {
    throw forbidden('You cannot manage users at or above your own role.');
  }
}

export const GET = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  const id = await readId(context);
  if (!auth.id.equals(id)) auth.require('users.read_all');

  const user = await User.findById(id).select(USER_PUBLIC_FIELDS).lean();
  if (!user) throw notFound('User');
  return ok(user);
});

export const PATCH = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  auth.require('users.update_all');
  const id = await readId(context);
  const body = await readBody(request, userUpdateSchema);

  const user = await User.findById(id).select('+token_version');
  if (!user) throw notFound('User');
  assertCanManage(auth, user.role as Role);
  if (body.role) assertCanManage(auth, body.role);

  const isSelf = auth.id.equals(id);
  if (isSelf && (body.role && body.role !== user.role)) throw badRequest('You cannot change your own role.');
  if (isSelf && body.is_active === false) throw badRequest('You cannot deactivate your own account.');
  if ((body.permissions !== undefined || body.revoked_permissions !== undefined) && auth.role !== 'admin') {
    throw forbidden('Only administrators can change individual permissions.');
  }

  // Never leave the CRM without an active administrator.
  const losingAdmin = user.role === 'admin' && ((body.role && body.role !== 'admin') || body.is_active === false);
  if (losingAdmin && (await User.countDocuments({ role: 'admin', is_active: true })) <= 1) {
    throw conflict('This is the last active administrator.');
  }

  if (body.email && body.email !== user.email && (await User.exists({ email: body.email, _id: { $ne: id } }))) {
    throw conflict('A user with this email already exists.');
  }

  const { password, ...profile } = body;
  const securityChange =
    Boolean(password) ||
    (body.role !== undefined && body.role !== user.role) ||
    body.is_active === false ||
    body.permissions !== undefined ||
    body.revoked_permissions !== undefined;

  applyPatch(user, profile);
  if (password) {
    user.set('password_hash', await hashPassword(password));
  }
  // Role, permission, password or status changes sign the user out everywhere.
  if (securityChange && !isSelf) user.token_version = (user.token_version ?? 0) + 1;
  await user.save();

  return ok(await User.findById(id).select(USER_PUBLIC_FIELDS).lean());
});

export const DELETE = apiHandler(async (request, context) => {
  const auth = await requireStaff(request);
  auth.require('users.delete');
  const id = await readId(context);
  if (auth.id.equals(id)) throw badRequest('You cannot delete your own account.');

  const user = await User.findById(id).select('role');
  if (!user) throw notFound('User');
  assertCanManage(auth, user.role as Role);
  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin', is_active: true })) <= 1) {
    throw conflict('This is the last active administrator.');
  }

  const owned = await Promise.all(
    [Lead, Client, PropertyModel, Viewing, Deal, Task].map((model) =>
      (model as typeof Lead).exists({ assigned_agent: id })
    )
  );
  if (owned.some(Boolean)) {
    throw conflict('This user still has leads, clients, listings, viewings, deals or tasks assigned. Reassign them or deactivate the account instead.');
  }

  await user.deleteOne();
  return ok({ deleted: true });
});
