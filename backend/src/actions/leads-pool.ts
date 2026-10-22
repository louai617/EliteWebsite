"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { poolAssignSchema, poolBulkSchema, poolDecisionSchema, poolLeadSchema, poolRequestIdSchema, updatePoolLeadSchema } from "@/schemas/leads-pool";
import { addPoolLead, addPoolLeadsBulk, assignPoolLead, cancelPoolRequest, decidePoolRequest, deletePoolLead, requestPoolLead, updatePoolLead } from "@/services/leads-pool";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const addPoolLeadAction = authedAction(poolLeadSchema, (input, user) => addPoolLead(user, input), {
  message: (r) => {
    const known = (r as { alreadyLead: { fullName: string; agent: string | null } | null }).alreadyLead;
    return known ? `Added to the pool — note: this number is already the lead ${known.fullName}${known.agent ? ` (${known.agent})` : ""}` : "Added to the leads pool";
  },
});
export const addPoolLeadsBulkAction = authedAction(poolBulkSchema, (input, user) => addPoolLeadsBulk(user, input), {
  message: (r) => {
    const { added, skipped } = r as { added: number; skipped: unknown[] };
    return `${plural(added, "number")} added to the pool${skipped.length ? ` · ${skipped.length} skipped` : ""}`;
  },
});
export const updatePoolLeadAction = authedAction(updatePoolLeadSchema, (input, user) => updatePoolLead(user, input), { message: "Pool lead updated" });
export const deletePoolLeadAction = authedAction(idOnly, (input, user) => deletePoolLead(user, input.id), { message: "Removed from the pool" });

export const requestPoolLeadAction = authedAction(idOnly, (input, user) => requestPoolLead(user, input.id), {
  message: (r) => ((r as { status: string }).status === "APPROVED" ? "The lead is yours — it's on your Leads page" : "Request sent — the management will review it"),
});
export const cancelPoolRequestAction = authedAction(poolRequestIdSchema, (input, user) => cancelPoolRequest(user, input.requestId), { message: "Request cancelled" });
export const decidePoolRequestAction = authedAction(poolDecisionSchema, (input, user) => decidePoolRequest(user, input), {
  message: (r) => ((r as { status: string }).status === "APPROVED" ? "Approved — the lead is now on the agent's Leads page" : "Request declined"),
});
export const assignPoolLeadAction = authedAction(poolAssignSchema, (input, user) => assignPoolLead(user, input), { message: "Lead given — it's now on the agent's Leads page" });
