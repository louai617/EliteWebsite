import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { forbidden, toPublicError, unauthorized } from "@/lib/errors";
import { isStaff } from "@/lib/permissions";

import type { ActionResult, FieldErrors } from "@/types/action";

export type { ActionResult, FieldErrors };

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

interface Options {
  /** Success toast text. */
  message?: string | ((data: unknown) => string);
  /** Set to false for read-only actions. Defaults to re-rendering the whole app shell. */
  revalidate?: boolean;
}

/**
 * Wraps a Server Action with the cross-cutting concerns every mutation needs:
 *  1. authentication (Server Actions are public POST endpoints)
 *  2. server-side validation with the same Zod schema the form uses
 *  3. safe error mapping — never leaks database or stack details
 *  4. cache revalidation so the UI reflects the change in the same round trip
 */
export function authedAction<S extends z.ZodType, R>(
  schema: S,
  handler: (input: z.output<S>, user: SessionUser) => Promise<R>,
  options: Options = {},
) {
  return async (raw: z.input<S> | z.output<S>): Promise<ActionResult<R>> => {
    try {
      const user = await getCurrentUser();
      if (!user) throw unauthorized();
      // Server Actions belong to the staff CRM; client-portal accounts use the portal API.
      if (!isStaff(user)) throw forbidden();

      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) };
      }

      const data = await handler(parsed.data, user);
      if (options.revalidate !== false) revalidatePath("/", "layout");
      const message = typeof options.message === "function" ? options.message(data) : options.message;
      return { ok: true, data, message };
    } catch (error) {
      // redirect()/notFound() work by throwing — let Next.js handle them.
      if (isNextControlFlow(error)) throw error;
      const { message, fieldErrors } = toPublicError(error);
      return { ok: false, error: message, fieldErrors };
    }
  };
}

function isNextControlFlow(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND");
}
