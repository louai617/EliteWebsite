"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { ownerSchema, updateOwnerSchema } from "@/schemas/owner";
import { createOwner, deleteOwner, updateOwner } from "@/services/owners";

export const createOwnerAction = authedAction(ownerSchema, (input, user) => createOwner(user, input), { message: "Owner added" });
export const updateOwnerAction = authedAction(updateOwnerSchema, (input, user) => updateOwner(user, input), { message: "Owner updated" });
export const deleteOwnerAction = authedAction(idOnly, (input, user) => deleteOwner(user, input.id), { message: "Owner deleted" });
