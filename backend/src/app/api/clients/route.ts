import { z } from "zod";
import { CustomerType } from "@/generated/prisma/enums";
import { apiRoute, listQuery } from "@/lib/api/handler";
import { clientSchema } from "@/schemas/client";
import { CLIENT_SORTS, createClient, listClients } from "@/services/clients";

const query = listQuery.extend({
  sort: z.enum(CLIENT_SORTS).default("createdAt"),
  clientType: z.enum(CustomerType).optional(),
  agentId: z.string().max(40).optional(),
});

/** GET /api/clients — agents see their own clients, managers the team's. */
export const GET = apiRoute({ audience: "staff", query }, async ({ user, query: q }) => {
  const { page, pageSize, q: search, sort, dir, ...filters } = q;
  return listClients(user, { page, pageSize, q: search, sort, dir }, filters);
});

/** POST /api/clients */
export const POST = apiRoute({ audience: "staff", body: clientSchema, status: 201 }, ({ user, body }) => createClient(user, body));
