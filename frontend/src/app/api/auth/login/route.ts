import { apiHandler, ok, readBody, unauthorized } from '@/lib/server/http';
import { User } from '@/lib/server/models';
import { DUMMY_HASH, verifyPassword } from '@/lib/server/auth/password';
import { clientIp, rateLimit } from '@/lib/server/auth/rateLimit';
import { serializeSessionUser, setSessionCookie } from '@/lib/server/auth/session';
import { loginSchema } from '@/lib/validation/crm';

export const POST = apiHandler(async (request) => {
  const { email, password } = await readBody(request, loginSchema);

  // 10 attempts per 15 minutes per IP, and per email address.
  rateLimit(`login:ip:${clientIp(request)}`, 10, 15 * 60_000);
  rateLimit(`login:email:${email}`, 10, 15 * 60_000);

  const user = await User.findOne({ email }).select('+password_hash +token_version');

  // Always run bcrypt so response time does not reveal whether the email exists.
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) throw unauthorized('Invalid email or password.');
  if (!user.is_active) throw unauthorized('This account has been deactivated. Please contact an administrator.');

  user.last_login_at = new Date();
  await user.save();

  const response = ok({ user: serializeSessionUser(user.toObject()) });
  await setSessionCookie(response, user);
  return response;
});
