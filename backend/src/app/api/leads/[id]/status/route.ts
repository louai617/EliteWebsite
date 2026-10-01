import { z } from "zod";
import { LeadStatus } from "@/generated/prisma/enums";
import { apiRoute } from "@/lib/api/handler";
import { setLeadStatus } from "@/services/leads";

/** POST /api/leads/:id/status — { status }; contacted/qualified/won are recorded as agent activity. */
export const POST = apiRoute({ audience: "staff", body: z.object({ status: z.enum(LeadStatus) }) }, ({ user, params, body }) => setLeadStatus(user, params.id, body.status));
