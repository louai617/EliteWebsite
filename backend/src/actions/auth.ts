"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { burnPasswordCheck, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentUser, revokeAllSessions } from "@/lib/auth/session";
import { authedAction, zodFieldErrors, type ActionResult } from "@/lib/action";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { changePasswordSchema, loginSchema, profileSchema, type LoginInput } from "@/schemas/user";
import { changePassword, updateProfile } from "@/services/users";
import { toPublicError } from "@/lib/errors";

const GENERIC = "Incorrect e-mail or password.";

export async function login(raw: LoginInput, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  const { email, password } = parsed.data;

  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const key = `login:${ip}:${email}`;
    const limit = rateLimit(key, 8, 15 * 60_000);
    if (!limit.ok) {
      return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterMs / 60_000)} minutes.` };
    }

    const user = await db.user.findUnique({ where: { email }, select: { id: true, passwordHash: true, isActive: true } });
    if (!user) {
      await burnPasswordCheck(password);
      return { ok: false, error: GENERIC };
    }
    if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, error: GENERIC };
    if (!user.isActive) return { ok: false, error: "This account has been deactivated. Contact your manager." };

    resetRateLimit(key);
    await createSession(user.id);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  } catch (error) {
    return { ok: false, error: toPublicError(error).message };
  }

  // Only allow same-site relative redirects.
  const redirectTo = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return { ok: true, data: { redirectTo } };
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export const updateProfileAction = authedAction(profileSchema, (input, user) => updateProfile(user, input), {
  message: "Profile updated",
});

export const changePasswordAction = authedAction(
  changePasswordSchema,
  async (input, user) => {
    await changePassword(user, input);
    // Sign out every other device, keep this one signed in.
    await revokeAllSessions(user.id);
    await createSession(user.id);
  },
  { message: "Password changed. Other devices have been signed out." },
);

export async function currentUserAction() {
  return getCurrentUser();
}
