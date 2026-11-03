import "server-only";
import { db } from "@/lib/db";

/** Signs a user out everywhere (password reset, deactivation, role change). */
export async function revokeAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
