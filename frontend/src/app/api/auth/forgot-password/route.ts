import crypto from 'node:crypto';
import { apiHandler, ok, readBody } from '@/lib/server/http';
import { User } from '@/lib/server/models';
import { clientIp, rateLimit } from '@/lib/server/auth/rateLimit';
import { forgotPasswordSchema } from '@/lib/validation/crm';

const RESET_TTL_MS = 60 * 60_000; // 1 hour

/**
 * Starts a password reset. The response is identical whether or not the email
 * exists, so it cannot be used to discover accounts.
 *
 * No email provider is configured yet: outside production the reset link is
 * printed to the server console. Wire `sendResetEmail` to a provider (Resend,
 * SES, SendGrid…) before relying on this in production.
 */
export const POST = apiHandler(async (request) => {
  rateLimit(`forgot:ip:${clientIp(request)}`, 5, 15 * 60_000);
  const { email } = await readBody(request, forgotPasswordSchema);

  const user = await User.findOne({ email, is_active: true });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.password_reset_hash = crypto.createHash('sha256').update(token).digest('hex');
    user.password_reset_expires = new Date(Date.now() + RESET_TTL_MS);
    await user.save();

    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    await sendResetEmail(user.email, `${origin}/en/reset-password?token=${token}`);
  }

  return ok({ message: 'If an account exists for that email, a reset link has been sent.' });
});

async function sendResetEmail(to: string, link: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[auth] Password reset link for ${to}: ${link}`);
  }
  // TODO: send via an email provider in production.
}
