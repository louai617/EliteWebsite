"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { contractTemplateSchema, generateContractSchema } from "@/schemas/contract";
import { deleteTemplate, generateContract, saveTemplate } from "@/services/contracts";

export const saveContractTemplateAction = authedAction(contractTemplateSchema, (input, user) => saveTemplate(user, input), { message: "Template saved" });
export const deleteContractTemplateAction = authedAction(idOnly, (input, user) => deleteTemplate(user, input.id), {
  message: (r) => ((r as { deactivated: boolean }).deactivated ? "Template turned off (contracts were generated from it)" : "Template deleted"),
});
export const generateContractAction = authedAction(generateContractSchema, (input, user) => generateContract(user, input), {
  message: (r) => `Contract ${(r as { reference: string }).reference} generated`,
});
