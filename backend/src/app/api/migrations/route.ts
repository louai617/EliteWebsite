import { apiRoute } from "@/lib/api/handler";
import { importRunsQuery } from "@/schemas/imports";
import { listImportRuns } from "@/services/imports";

/** GET /api/migrations?source=&page=&pageSize= — import/migration runs, newest first. */
export const GET = apiRoute({ audience: "staff", permission: "imports.run", query: importRunsQuery }, ({ user, query }) => listImportRuns(user, query));
