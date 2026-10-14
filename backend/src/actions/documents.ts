"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { uploadDocumentSchema } from "@/schemas/document";
import { deleteDocument, uploadDocument } from "@/services/documents";

/** Multipart upload (FormData: target, targetId, kind, title?, number?, expiresAt?, file). */
export const uploadDocumentAction = authedAction(uploadDocumentSchema, (input, user) => uploadDocument(user, input), { message: "Document uploaded" });
export const deleteDocumentAction = authedAction(idOnly, (input, user) => deleteDocument(user, input.id), { message: "Document deleted" });
