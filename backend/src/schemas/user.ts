import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { checkbox, email, id, optionalPhone, optionalText, requiredText } from "./common";

export const passwordRule = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Keep it under 128 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");

const userFields = {
  name: requiredText(120, "Name"),
  email,
  phone: optionalPhone,
  role: z.enum(Role),
  avatarUrl: optionalText(1000),
  isActive: checkbox,
};

export const createUserSchema = z.object({ ...userFields, password: passwordRule });
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id,
  ...userFields,
  /** Optional reset; leave blank to keep the current password. */
  password: z.preprocess((v) => (v === "" ? undefined : v), passwordRule.optional()),
});
export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const profileSchema = z.object({ name: requiredText(120, "Name"), phone: optionalPhone, avatarUrl: optionalText(1000) });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Enter your e-mail").email("Enter a valid e-mail address"),
  password: z.string().min(1, "Enter your password").max(200),
});
export type LoginInput = z.input<typeof loginSchema>;

/** Client-side schema for the combined create/edit form (the server re-validates with the schemas above). */
export const userFormSchema = z
  .object({
    id: id.optional(),
    ...userFields,
    password: z.preprocess((v) => (v === "" ? undefined : v), passwordRule.optional()),
  })
  .superRefine((v, ctx) => {
    if (!v.id && !v.password) ctx.addIssue({ code: "custom", path: ["password"], message: "Set an initial password" });
  });
export type UserFormInput = z.input<typeof userFormSchema>;
