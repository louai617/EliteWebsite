"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { convertLeadSchema, leadAssignSchema, leadInterestSchema, leadSchema, leadStatusSchema, updateLeadSchema } from "@/schemas/lead";
import {
  addLeadInterest,
  assignLead,
  convertLeadToClient,
  createLead,
  deleteLead,
  removeLeadInterest,
  setLeadStatus,
  updateLead,
} from "@/services/leads";

export const createLeadAction = authedAction(leadSchema, (input, user) => createLead(user, input), { message: "Lead created" });
export const updateLeadAction = authedAction(updateLeadSchema, (input, user) => updateLead(user, input), { message: "Lead updated" });
export const setLeadStatusAction = authedAction(leadStatusSchema, (input, user) => setLeadStatus(user, input.id, input.status), { message: "Lead moved" });
export const assignLeadAction = authedAction(leadAssignSchema, (input, user) => assignLead(user, input.id, input.agentId), { message: "Lead assigned" });
export const deleteLeadAction = authedAction(idOnly, (input, user) => deleteLead(user, input.id), { message: "Lead deleted" });
export const convertLeadAction = authedAction(convertLeadSchema, (input, user) => convertLeadToClient(user, input.id), {
  message: (r) => ((r as { created: boolean }).created ? "Client profile created" : "Lead is already linked to a client"),
});
export const addLeadInterestAction = authedAction(leadInterestSchema, (input, user) => addLeadInterest(user, input.leadId, input.propertyId), { message: "Property added" });
export const removeLeadInterestAction = authedAction(leadInterestSchema, (input, user) => removeLeadInterest(user, input.leadId, input.propertyId), { message: "Property removed" });
