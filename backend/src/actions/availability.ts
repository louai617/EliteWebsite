"use server";

import { authedAction } from "@/lib/action";
import { availabilitySchema, removeAvailabilitySchema } from "@/schemas/availability";
import { addAvailability, removeAvailability } from "@/services/availability";

export const addAvailabilityAction = authedAction(availabilitySchema, (input, user) => addAvailability(user, input), {
  message: (r) => {
    const { added, skipped } = r as { added: number; skipped: number };
    return `Free for viewings${added > 1 ? ` on ${added} days` : ""}${skipped ? ` · ${skipped} skipped (already free)` : ""}`;
  },
});
export const removeAvailabilityAction = authedAction(removeAvailabilitySchema, (input, user) => removeAvailability(user, input.id), { message: "Free time removed" });
