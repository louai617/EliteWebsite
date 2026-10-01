"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession, getCurrentUser, revokeAllSessions } from "@/lib/auth/session";
import { authedAction, zodFieldErrors, type ActionResult } from "@/lib/action";
import { changePasswordSchema, loginSchema, profileSchema, type LoginInput } from "@/schemas/user";
import { changePassword, updateProfile } from "@/services/users";
import { authenticate } from "@/services/auth";
import { toPublicError } from "@/lib/errors";
import { isStaff } from "@/lib/permissions";
import { CLIENT_APP_URL } from "@/lib/env";

export async function login(raw: LoginInput, next?: string): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
  const { email, password } = parsed.data;

  try {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const user = await authenticate(email, password, ip);
    if (!isStaff(user)) {
      return { ok: false, error: `This is a client account. Please sign in on the client portal: ${CLIENT_APP_URL}` };
    }
    await createSession(user.id);
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
