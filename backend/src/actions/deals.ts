"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { dealSchema, dealStatusSchema, updateDealSchema } from "@/schemas/deal";
import { createDeal, deleteDeal, setDealStatus, updateDeal } from "@/services/deals";

export const createDealAction = authedAction(dealSchema, (input, user) => createDeal(user, input), {
  message: (d) => `Deal ${(d as { reference: string }).reference} created`,
});
export const updateDealAction = authedAction(updateDealSchema, (input, user) => updateDeal(user, input), { message: "Deal updated" });
export const setDealStatusAction = authedAction(dealStatusSchema, (input, user) => setDealStatus(user, input.id, input.status), { message: "Deal status updated" });
export const deleteDealAction = authedAction(idOnly, (input, user) => deleteDeal(user, input.id), { message: "Deal deleted" });
