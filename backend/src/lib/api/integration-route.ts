import "server-only";
import type { ExternalSource } from "@/generated/prisma/enums";
import { importRequestSchema } from "@/schemas/imports";
import { integrationStatus, runImport } from "@/services/imports";
import { apiRoute } from "./handler";

/** GET (status) + POST (import) handlers shared by every listing source. */
export function integrationRoutes(source: ExternalSource) {
  return {
    GET: apiRoute({ audience: "staff", permission: "imports.run" }, ({ user }) => integrationStatus(user, source)),
    POST: apiRoute(
      { audience: "staff", permission: "imports.run", body: importRequestSchema, rateLimit: { limit: 20, windowMs: 60 * 60_000, key: `import:${source}` } },
      ({ user, body }) => runImport(user, source, body.records ?? null, { dryRun: body.dryRun, defaultAgentId: body.defaultAgentId ?? null, trigger: body.records ? "api" : "remote" }),
    ),
  };
}
