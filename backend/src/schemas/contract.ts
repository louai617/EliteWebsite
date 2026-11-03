import { z } from "zod";
import { DealType } from "@/generated/prisma/enums";
import { AUTO_KEYS, placeholdersIn } from "@/lib/contract-format";
import { checkbox, id, optionalText, requiredText } from "./common";

export const contractFieldSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,39}$/, "Use lowercase letters, digits and _ (e.g. handover_date)"),
  label: requiredText(80, "Label"),
  type: z.enum(["text", "textarea", "date", "number", "money"]),
  required: z.boolean(),
});

export const contractTemplateSchema = z
  .object({
    id: id.optional(),
    name: requiredText(120, "Name"),
    description: optionalText(300),
    dealType: z.preprocess((v) => (v === "" || v == null || v === "ANY" ? null : v), z.enum(DealType).nullable()),
    body: z.string({ error: "Write the contract text" }).trim().min(50, "The contract text is too short").max(60_000, "The contract text is too long"),
    fields: z.array(contractFieldSchema).max(25, "Up to 25 fields"),
    isActive: checkbox,
  })
  .superRefine((v, ctx) => {
    const keys = v.fields.map((f) => f.key);
    keys.forEach((k, i) => {
      if (keys.indexOf(k) !== i) ctx.addIssue({ code: "custom", path: ["fields", i, "key"], message: "Each field needs its own key" });
      if (AUTO_KEYS.has(k)) ctx.addIssue({ code: "custom", path: ["fields", i, "key"], message: `“${k}” is filled automatically — pick another key` });
    });
    const unknown = placeholdersIn(v.body).filter((p) => !AUTO_KEYS.has(p) && !keys.includes(p));
    if (unknown.length) ctx.addIssue({ code: "custom", path: ["body"], message: `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map((u) => `{{${u}}}`).join(", ")} — add a field for it or fix the spelling` });
  });

export const generateContractSchema = z.object({
  dealId: id,
  templateId: id,
  values: z.record(z.string().regex(/^[a-z][a-z0-9_]*$/), z.string().max(4000)).default({}),
});
