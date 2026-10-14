"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { clientInterestSchema, clientSchema, updateClientSchema } from "@/schemas/client";
import { addClientInterest, createClient, deleteClient, removeClientInterest, updateClient } from "@/services/clients";

export const createClientAction = authedAction(clientSchema, (input, user) => createClient(user, input), { message: "Client added" });
export const updateClientAction = authedAction(updateClientSchema, (input, user) => updateClient(user, input), { message: "Client updated" });
export const deleteClientAction = authedAction(idOnly, (input, user) => deleteClient(user, input.id), { message: "Client deleted" });
export const addClientInterestAction = authedAction(clientInterestSchema, (input, user) => addClientInterest(user, input.clientId, input.propertyId), { message: "Property added" });
export const removeClientInterestAction = authedAction(clientInterestSchema, (input, user) => removeClientInterest(user, input.clientId, input.propertyId), { message: "Property removed" });
