"use server";

import { authedAction } from "@/lib/action";
import { settingsSchema } from "@/schemas/settings";
import { createUserSchema, updateUserSchema } from "@/schemas/user";
import { updateSettings } from "@/services/settings";
import { createUser, updateUser } from "@/services/users";

export const createUserAction = authedAction(createUserSchema, (input, user) => createUser(user, input), { message: "Team member added" });
export const updateUserAction = authedAction(updateUserSchema, (input, user) => updateUser(user, input), { message: "Team member updated" });
export const updateSettingsAction = authedAction(settingsSchema, (input, user) => updateSettings(user, input), { message: "Settings saved" });
