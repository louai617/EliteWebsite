import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { keyedHash } from "@/lib/auth/secret";
import { revokeAllSessions } from "@/lib/auth/session-store";
import { APP_URL, CLIENT_APP_URL } from "@/lib/env";
import { invalid } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { logActivity } from "./activity";
import { passwordChanged, passwordResetCode } from "./email-templates";
import { sendMail } from "./mail";

/**
 * Password reset by e-mail code (OTP):
 *   1. requestPasswordReset(email)      → a 6-digit code is e-mailed (valid 10 minutes)
 *   2. verifyResetCode(email, code)     → returns a one-time reset token (valid 15 minutes)
 *   3. resetPassword(email, token, pw)  → new password, every session signed out, e-mail sent
 *
 * Only keyed hashes of codes and tokens are stored. A code locks after 5 wrong tries, a new
 * code replaces the previous one, and requests are throttled per account (and per IP in the
 * API layer). Responses never reveal whether an e-mail has an account.
 */

export const OTP_MINUTES = 10;
const TOKEN_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_CODES_PER_HOUR = 5;

const codeHash = (userId: string, code: string) => keyedHash(`otp:${userId}:${code}`);
const tokenHash = (token: string) => keyedHash(`reset:${createHash("sha256").update(token).digest("hex")}`);

function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function activeUser(email: string) {
  return db.user.findFirst({
    where: { email: email.trim().toLowerCase(), isActive: true },
    select: { id: true, name: true, email: true, role: true, clientId: true, client: { select: { agentId: true } } },
  });
}

export async function requestPasswordReset(email: string, ip?: string | null) {
  const user = await activeUser(email);
  if (!user) return;
  const now = Date.now();
  const recent = await db.otpCode.findMany({
    where: { userId: user.id, purpose: "PASSWORD_RESET", createdAt: { gte: new Date(now - 3_600_000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) return;
  if (recent.length >= MAX_CODES_PER_HOUR) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.$transaction([
    // A new code replaces any earlier one.
    db.otpCode.updateMany({ where: { userId: user.id, purpose: "PASSWORD_RESET", consumedAt: null }, data: { consumedAt: new Date() } }),
    db.otpCode.create({
      data: { userId: user.id, purpose: "PASSWORD_RESET", codeHash: codeHash(user.id, code), expiresAt: new Date(now + OTP_MINUTES * 60_000), requestedIp: ip?.slice(0, 64) ?? null },
    }),
  ]);
  const status = await sendMail(user.email, "password-reset-code", passwordResetCode({ name: user.name, code, minutes: OTP_MINUTES, portal: user.role === "CLIENT" ? "client" : "staff" }));

  // No working e-mail (e.g. SMTP not set up in production): fall back to the team.
  if (status === "FAILED") {
    const autoKey = `password-reset:${user.id}:${new Date().toISOString().slice(0, 10)}`;
    if (!(await db.task.findUnique({ where: { autoKey }, select: { id: true } }))) {
      const isClient = user.role === "CLIENT";
      await db.task.create({
        data: {
          title: `Reset ${isClient ? "client portal" : "agent app"} password for ${user.name}`,
          description: `${user.name} (${user.email}) asked to reset their password but the code e-mail could not be sent. Verify their identity by phone, then set a new password${isClient ? " from the client's “Client portal” card" : " from Users"}.`,
          type: isClient ? "CLIENT_FOLLOW_UP" : "GENERAL",
          priority: "HIGH",
          dueDate: new Date(now + 4 * 3_600_000),
          clientId: user.clientId,
          assigneeId: isClient ? (user.client?.agentId ?? null) : null,
          autoKey,
          events: { create: { type: "CREATED", message: "Created from a “forgot password” request (e-mail delivery failed)" } },
        },
      });
    }
  }
}

const WRONG_CODE = "That code isn't right or has expired. Check the latest e-mail or request a new code.";

export async function verifyResetCode(email: string, code: string) {
  const user = await activeUser(email);
  const otp = user
    ? await db.otpCode.findFirst({
        where: { userId: user.id, purpose: "PASSWORD_RESET", consumedAt: null, verifiedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, codeHash: true, attempts: true },
      })
    : null;
  if (!user || !otp) throw invalid(WRONG_CODE, { code: ["Invalid or expired code"] });
  if (otp.attempts >= MAX_ATTEMPTS) throw invalid("Too many wrong attempts. Request a new code.", { code: ["Request a new code"] });

  if (!sameHash(otp.codeHash, codeHash(user.id, code.trim()))) {
    const attempts = otp.attempts + 1;
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts, ...(attempts >= MAX_ATTEMPTS ? { consumedAt: new Date() } : {}) } });
    const left = MAX_ATTEMPTS - attempts;
    throw invalid(left > 0 ? `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many wrong attempts. Request a new code.", { code: ["Wrong code"] });
  }

  const token = randomBytes(32).toString("base64url");
  await db.otpCode.update({
    where: { id: otp.id },
    data: { verifiedAt: new Date(), resetTokenHash: tokenHash(token), expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60_000) },
  });
  return { resetToken: token, expiresInMinutes: TOKEN_MINUTES };
}

export async function resetPassword(email: string, token: string, password: string) {
  const otp = await db.otpCode.findUnique({
    where: { resetTokenHash: tokenHash(token) },
    select: { id: true, consumedAt: true, expiresAt: true, verifiedAt: true, user: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
  });
  if (!otp || otp.consumedAt || !otp.verifiedAt || otp.expiresAt <= new Date() || !otp.user.isActive || otp.user.email !== email.trim().toLowerCase()) {
    throw invalid("This reset session has expired. Please request a new code.", { token: ["Expired"] });
  }
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: otp.user.id }, data: { passwordHash } });
    await tx.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    await logActivity(tx, {
      action: "UPDATED", entityType: "USER", entityId: otp.user.id, entityLabel: otp.user.name, userId: otp.user.id,
      description: `${otp.user.name} reset their password with an e-mail code`,
    });
  });
  await revokeAllSessions(otp.user.id);
  const loginUrl = otp.user.role === "CLIENT" ? `${CLIENT_APP_URL}/en/login` : `${APP_URL || "http://localhost:3002"}/login`;
  await sendMail(otp.user.email, "password-changed", passwordChanged({ name: otp.user.name, when: formatDateTime(new Date()), loginUrl }));
  return { reset: true, role: otp.user.role === "CLIENT" ? "client" : "staff" };
}
