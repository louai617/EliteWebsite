import { apiHandler, conflict, ok, readBody } from '@/lib/server/http';
import { User } from '@/lib/server/models';
import { hashPassword } from '@/lib/server/auth/password';
import { clientIp, rateLimit } from '@/lib/server/auth/rateLimit';
import { serializeSessionUser, setSessionCookie } from '@/lib/server/auth/session';
import { registerSchema } from '@/lib/validation/crm';

/**
 * Public sign-up. Always creates a `user` (customer) account — staff accounts
 * are created by an admin/manager from Dashboard → Users, never self-service.
 */
export const POST = apiHandler(async (request) => {
  rateLimit(`register:ip:${clientIp(request)}`, 5, 60 * 60_000);
  const body = await readBody(request, registerSchema);

  if (await User.exists({ email: body.email })) {
    throw conflict('An account with this email already exists. Try signing in instead.');
  }

  const user = await User.create({
    full_name: body.full_name,
    email: body.email,
    phone: body.phone ?? undefined,
    role: 'user',
    password_hash: await hashPassword(body.password),
    last_login_at: new Date(),
  });

  const response = ok({ user: serializeSessionUser(user.toObject()) }, { status: 201 });
  await setSessionCookie(response, user);
  return response;
});
