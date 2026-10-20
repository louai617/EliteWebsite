"use server";

import { authedAction } from "@/lib/action";
import { z } from "zod";
import { forbidden } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { paymentSettingsSchema, settingsSchema, watermarkSettingsSchema } from "@/schemas/settings";
import { createUserSchema, updateUserSchema } from "@/schemas/user";
import { updatePaymentSettings, updateWatermarkSettings, updateSettings } from "@/services/settings";
import { testEmail } from "@/services/email-templates";
import { sendMail } from "@/services/mail";
import { createUser, updateUser } from "@/services/users";

export const createUserAction = authedAction(createUserSchema, (input, user) => createUser(user, input), { message: "Team member added" });
export const updateUserAction = authedAction(updateUserSchema, (input, user) => updateUser(user, input), { message: "Team member updated" });
export const updateSettingsAction = authedAction(settingsSchema, (input, user) => updateSettings(user, input), { message: "Settings saved" });
export const updatePaymentSettingsAction = authedAction(paymentSettingsSchema, (input, user) => updatePaymentSettings(user, input), { message: "Payment settings saved" });
export const updateWatermarkSettingsAction = authedAction(watermarkSettingsSchema, (input, user) => updateWatermarkSettings(user, input), {
  message: (r) => ((r as { changed: boolean }).changed ? "Watermark saved — updating the photos in the background" : "Watermark saved"),
});

/** Sends the branded test e-mail to the signed-in admin. */
export const sendTestEmailAction = authedAction(
  z.object({}),
  async (_input, user) => {
    if (!can.editSettings(user)) throw forbidden("Only admins can send test e-mails.");
    return { status: await sendMail(user.email, "test", testEmail({ name: user.name })) };
  },
  {
    message: (r) =>
      ({ SENT: "Test e-mail sent — check your inbox", OUTBOX: "SMTP isn't set up: the e-mail was saved to storage/outbox", FAILED: "Sending failed — check the SMTP settings and the server log" })[(r as { status: string }).status] ?? "Done",
  },
);
