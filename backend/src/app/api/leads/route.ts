import { z } from "zod";
import { LeadSource, LeadStatus, ListingPurpose, Priority } from "@/generated/prisma/enums";
import { apiRoute, listQuery } from "@/lib/api/handler";
import { leadSchema } from "@/schemas/lead";
import { LEAD_SORTS, createLead, listLeads } from "@/services/leads";

const query = listQuery.extend({
  sort: z.enum(LEAD_SORTS).default("createdAt"),
  status: z.enum(LeadStatus).optional(),
  source: z.enum(LeadSource).optional(),
  priority: z.enum(Priority).optional(),
  purpose: z.enum(ListingPurpose).optional(),
  agentId: z.string().max(40).optional(),
});

/** GET /api/leads — agents see their own leads, managers the team's. */
export const GET = apiRoute({ audience: "staff", query }, async ({ user, query: q }) => {
  const { page, pageSize, q: search, sort, dir, ...filters } = q;
  return listLeads(user, { page, pageSize, q: search, sort, dir }, filters);
});

/** POST /api/leads — create a lead (assigning it creates the agent's response task). */
export const POST = apiRoute({ audience: "staff", body: leadSchema, status: 201 }, ({ user, body }) => createLead(user, body));
