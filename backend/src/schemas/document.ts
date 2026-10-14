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

/** What clients can upload themselves from the website. */
export const CLIENT_UPLOAD_KINDS = ["QID", "PASSPORT", "VISA", "TRADE_LICENSE", "PROOF_OF_PAYMENT", "OTHER"] as const;

export const portalDocumentSchema = z.object({
  kind: z.enum(CLIENT_UPLOAD_KINDS, { error: "Choose the document type" }),
  title: optionalText(120),
  number: optionalText(60),
  expiresAt: optionalDate,
  /** Attach to one of the client's reservations (proof of payment). */
  reservationId: z.preprocess((v) => (v === "" || v == null ? null : v), id.nullable()).optional(),
  file: fileField,
});
