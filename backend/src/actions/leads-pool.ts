"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { poolAssignManySchema, poolBulkSchema, poolIdsSchema, poolImportSchema, poolLeadSchema, updatePoolLeadSchema } from "@/schemas/leads-pool";
import { addPoolLead, addPoolLeadsBulk, assignPoolLeads, deletePoolLeads, importPoolFile, takePoolLead, updatePoolLead } from "@/services/leads-pool";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const addedMessage = (r: unknown) => {
  const { added, skippedCount } = r as { added: number; skippedCount: number };
  return `${plural(added, "number")} added to the pool${skippedCount ? ` · ${skippedCount} skipped` : ""}`;
};

export const addPoolLeadAction = authedAction(poolLeadSchema, (input, user) => addPoolLead(user, input), {
  message: (r) => {
    const known = (r as { alreadyLead: { fullName: string; agent: string | null } | null }).alreadyLead;
    return known ? `Added to the pool — note: this number is already the lead ${known.fullName}${known.agent ? ` (${known.agent})` : ""}` : "Added to the leads pool";
  },
});
export const addPoolLeadsBulkAction = authedAction(poolBulkSchema, (input, user) => addPoolLeadsBulk(user, input), { message: addedMessage });
export const importPoolFileAction = authedAction(poolImportSchema, (input, user) => importPoolFile(user, input.file), { message: addedMessage });
export const updatePoolLeadAction = authedAction(updatePoolLeadSchema, (input, user) => updatePoolLead(user, input), { message: "Pool lead updated" });
export const deletePoolLeadsAction = authedAction(poolIdsSchema, (input, user) => deletePoolLeads(user, input.ids), {
  message: (r) => `${plural((r as { removed: number }).removed, "number")} removed from the pool`,
});

export const takePoolLeadAction = authedAction(idOnly, (input, user) => takePoolLead(user, input.id), { message: "The lead is yours — it's on your Leads page" });
export const assignPoolLeadsAction = authedAction(poolAssignManySchema, (input, user) => assignPoolLeads(user, input), {
  message: (r) => {
    const { given, skipped, agent } = r as { given: number; skipped: number; agent: string };
    return `${plural(given, "lead")} given to ${agent}${skipped ? ` · ${skipped} already taken` : ""}`;
  },
});
