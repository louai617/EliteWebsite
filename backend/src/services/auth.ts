import "server-only";
import { db } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/errors";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

const GENERIC = "Incorrect e-mail or password.";

/**
 * Shared credential check for the CRM login form and the REST API. Rate-limited per
 * IP + e-mail, constant-time for unknown e-mails, rejects deactivated accounts.
 * Only staff accounts can sign in (the website has no visitor accounts).
 */
export async function authenticate(email: string, password: string, ip: string) {
  const key = `login:${ip}:${email}`;
  const limit = rateLimit(key, 8, 15 * 60_000);
  if (!limit.ok) throw new AppError(`Too many attempts. Try again in ${Math.ceil(limit.retryAfterMs / 60_000)} minutes.`, "RATE_LIMITED");

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, clientId: true, passwordHash: true, isActive: true },
  });
  if (!user) {
    await burnPasswordCheck(password);
    throw new AppError(GENERIC, "UNAUTHORIZED");
  }
  if (!(await verifyPassword(password, user.passwordHash))) throw new AppError(GENERIC, "UNAUTHORIZED");
  if (!user.isActive) throw new AppError("This account has been deactivated. Contact the agency.", "FORBIDDEN");
  // Client portal accounts were retired: only staff can sign in (the records are kept).
  if (user.role === "CLIENT") throw new AppError(GENERIC, "UNAUTHORIZED");

  resetRateLimit(key);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const { passwordHash: _hash, isActive: _active, ...safe } = user;
  return safe;
}
