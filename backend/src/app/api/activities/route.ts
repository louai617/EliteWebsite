import { z } from "zod";
import { WorkActivityType } from "@/generated/prisma/enums";
import { apiRoute } from "@/lib/api/handler";
import { workActivitySchema } from "@/schemas/work-activity";
import { listWorkActivities, logWorkActivity } from "@/services/work-activities";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  agentId: z.string().max(40).optional(),
  type: z.enum(WorkActivityType).optional(),
  from: date.optional(),
  to: date.optional(),
  leadId: z.string().max(40).optional(),
  propertyId: z.string().max(40).optional(),
});

/** GET /api/activities — agent work activities (agents: own; managers: team). */
export const GET = apiRoute({ audience: "staff", query }, async ({ user, query: { page, pageSize, ...filters } }) => listWorkActivities(user, filters, page, pageSize));

/** POST /api/activities — log work (call, follow-up, posting…). Feeds daily reports and scores. */
export const POST = apiRoute({ audience: "staff", body: workActivitySchema, status: 201 }, async ({ user, body }) => logWorkActivity(user, body));
