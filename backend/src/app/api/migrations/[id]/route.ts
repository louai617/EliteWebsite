import { apiRoute } from "@/lib/api/handler";
import { importRunQuery } from "@/schemas/imports";
import { getImportRun } from "@/services/imports";

/** GET /api/migrations/:id?status=FAILED — one run with its per-record log. */
export const GET = apiRoute({ audience: "staff", permission: "imports.run", query: importRunQuery }, ({ user, params, query }) => getImportRun(user, params.id, query.status));
