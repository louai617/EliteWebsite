import { z } from "zod";
import { DocumentKind } from "@/generated/prisma/enums";
import { id, optionalDate, optionalText } from "./common";

export const DOCUMENT_TARGETS = ["lead", "client", "deal", "reservation"] as const;
export type DocumentTarget = (typeof DOCUMENT_TARGETS)[number];

export const documentMetaSchema = z.object({
  target: z.enum(DOCUMENT_TARGETS),
  targetId: id,
  kind: z.enum(DocumentKind, { error: "Choose the document type" }),
  title: optionalText(120),
  /** QID / passport number. */
  number: optionalText(60),
  expiresAt: optionalDate,
});

const fileField = z.instanceof(File, { error: "Choose a file" });

/** Multipart upload from the CRM (FormData: target, targetId, kind, title?, number?, expiresAt?, file). */
export const uploadDocumentSchema = z
  .instanceof(FormData)
  .transform((fd): Record<string, unknown> => ({
    target: fd.get("target"),
    targetId: fd.get("targetId"),
    kind: fd.get("kind"),
    title: fd.get("title") ?? undefined,
    number: fd.get("number") ?? undefined,
    expiresAt: fd.get("expiresAt") ?? undefined,
    file: fd.get("file"),
  }))
  .pipe(documentMetaSchema.extend({ file: fileField }));
