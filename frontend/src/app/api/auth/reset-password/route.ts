import crypto from 'node:crypto';
import { apiHandler, badRequest, ok, readBody } from '@/lib/server/http';
import { User } from '@/lib/server/models';
import { hashPassword } from '@/lib/server/auth/password';
import { clientIp, rateLimit } from '@/lib/server/auth/rateLimit';
import { resetPasswordSchema } from '@/lib/validation/crm';

export const POST = apiHandler(async (request) => {
  rateLimit(`reset:ip:${clientIp(request)}`, 10, 15 * 60_000);
  const { token, password } = await readBody(request, resetPasswordSchema);

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    password_reset_hash: hash,
    password_reset_expires: { $gt: new Date() },
    is_active: true,
  }).select('+password_reset_hash +password_reset_expires +token_version');
  if (!user) throw badRequest('This reset link is invalid or has expired.');

  user.password_hash = await hashPassword(password);
  user.password_reset_hash = undefined;
  user.password_reset_expires = undefined;
  // Invalidate every existing session for this account.
  user.token_version = (user.token_version ?? 0) + 1;
  await user.save();

  return ok({ message: 'Your password has been updated. You can now sign in.' });
});
