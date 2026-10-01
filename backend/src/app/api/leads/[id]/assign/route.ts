import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { optionalId } from "@/schemas/common";
import { assignLead } from "@/services/leads";

/** POST /api/leads/:id/assign — { agentId | null } (managers reassign; agents can only take a lead). */
export const POST = apiRoute({ audience: "staff", body: z.object({ agentId: optionalId }) }, ({ user, params, body }) => assignLead(user, params.id, body.agentId));
