import { apiHandler, badRequest, ok, readBody, unauthorized } from '@/lib/server/http';
import { User } from '@/lib/server/models';
import { hashPassword, verifyPassword } from '@/lib/server/auth/password';
import {
  clearSessionCookie,
  getAuth,
  requireAuth,
  serializeSessionUser,
  setSessionCookie,
} from '@/lib/server/auth/session';
import { profileUpdateSchema } from '@/lib/validation/crm';
import { applyPatch } from '@/lib/server/services/common';

/** Who is signed in. Returns `user: null` (not 401) so the UI can check quietly. */
export const GET = apiHandler(async (request) => {
  const auth = await getAuth(request);
  const response = ok({ user: auth ? serializeSessionUser(auth.user) : null });
  // A cookie that no longer maps to an active user is cleared.
  if (!auth && request.cookies.has('elite_session')) clearSessionCookie(response);
  return response;
});

/** Update your own profile or password. Role/permissions are not editable here. */
export const PATCH = apiHandler(async (request) => {
  const auth = await requireAuth(request);
  const body = await readBody(request, profileUpdateSchema);
  const user = await User.findById(auth.id).select('+password_hash +token_version');
  if (!user) throw unauthorized();

  const { current_password, new_password, ...profile } = body;
  applyPatch(user, profile);

  let passwordChanged = false;
  if (new_password) {
    if (!current_password || !(await verifyPassword(current_password, user.password_hash))) {
      throw badRequest('Your current password is incorrect.');
    }
    user.password_hash = await hashPassword(new_password);
    // Sign out every other session.
    user.token_version = (user.token_version ?? 0) + 1;
    passwordChanged = true;
  }

  await user.save();
  const response = ok({ user: serializeSessionUser(user.toObject()) });
  if (passwordChanged) await setSessionCookie(response, user);
  return response;
});
