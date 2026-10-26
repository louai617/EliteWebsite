"use server";

import { authedAction } from "@/lib/action";
import { idOnly } from "@/schemas/common";
import { createNoteSchema, updateNoteSchema } from "@/schemas/note";
import { addNote, deleteNote, updateNote } from "@/services/notes";

export const addNoteAction = authedAction(createNoteSchema, (input, user) => addNote(user, input.target, input.targetId, input.content), { message: "Note added" });
export const updateNoteAction = authedAction(updateNoteSchema, (input, user) => updateNote(user, input.id, input.content), { message: "Note updated" });
export const deleteNoteAction = authedAction(idOnly, (input, user) => deleteNote(user, input.id), { message: "Note deleted" });
