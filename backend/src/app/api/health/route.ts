import { apiRoute } from "@/lib/api/handler";
import { db } from "@/lib/db";

/** Liveness/readiness probe for the client app and deployments. */
export const GET = apiRoute({ audience: "public" }, async () => {
  await db.$queryRaw`SELECT 1`;
  return { status: "ok", time: new Date().toISOString() };
});
