"use server";

import { z } from "zod";
import { authedAction } from "@/lib/action";
import { id, idOnly } from "@/schemas/common";
import { mediaLinkSchema } from "@/schemas/media";
import { addMediaLink, deleteMedia, moveMedia } from "@/services/property-media";

export const addMediaLinkAction = authedAction(mediaLinkSchema, (input, user) => addMediaLink(user, input), { message: "Media added" });
export const deleteMediaAction = authedAction(idOnly, (input, user) => deleteMedia(user, input.id), { message: "Media removed" });
export const moveMediaAction = authedAction(z.object({ id, direction: z.enum(["up", "down"]) }), (input, user) => moveMedia(user, input.id, input.direction), { revalidate: true });
