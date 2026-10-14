import { z } from "zod";
import { id, requiredText } from "./common";

export const NOTE_TARGETS = ["lead", "client", "owner", "property", "deal", "viewing"] as const;
export type NoteTarget = (typeof NOTE_TARGETS)[number];

export const createNoteSchema = z.object({
  target: z.enum(NOTE_TARGETS),
  targetId: id,
  content: requiredText(5000, "Note"),
});
export const updateNoteSchema = z.object({ id, content: requiredText(5000, "Note") });
