"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { updateViewingSchema, viewingSchema, viewingStatusSchema } from "@/schemas/viewing";
import { createViewing, deleteViewing, setViewingStatus, updateViewing } from "@/services/viewings";

export const createViewingAction = authedAction(viewingSchema, (input, user) => createViewing(user, input), { message: "Viewing scheduled" });
export const updateViewingAction = authedAction(updateViewingSchema, (input, user) => updateViewing(user, input), { message: "Viewing updated" });
export const setViewingStatusAction = authedAction(viewingStatusSchema, (input, user) => setViewingStatus(user, input.id, input.status, input.notes), { message: "Viewing updated" });
export const deleteViewingAction = authedAction(idOnly, (input, user) => deleteViewing(user, input.id), { message: "Viewing deleted" });
