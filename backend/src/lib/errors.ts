import "server-only";
import { Prisma } from "@/generated/prisma/client";

export type AppErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "RATE_LIMITED";

/** Errors whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: AppErrorCode,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = () => new AppError("Your session has expired. Please sign in again.", "UNAUTHORIZED");
export const forbidden = (message = "You don't have permission to do that.") => new AppError(message, "FORBIDDEN");
export const notFound = (entity = "Record") => new AppError(`${entity} not found or no longer available.`, "NOT_FOUND");
export const conflict = (message: string, fieldErrors?: Record<string, string[]>) => new AppError(message, "CONFLICT", fieldErrors);
export const invalid = (message: string, fieldErrors?: Record<string, string[]>) => new AppError(message, "VALIDATION", fieldErrors);

export interface PublicError {
  message: string;
  code: AppErrorCode | "INTERNAL";
  fieldErrors?: Record<string, string[]>;
}

/**
 * Converts any thrown value into a message that is safe to show. Database and runtime
 * errors are logged server-side and replaced with a generic message.
 */
export function toPublicError(error: unknown): PublicError {
  if (error instanceof AppError) {
    return { message: error.message, code: error.code, fieldErrors: error.fieldErrors };
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = (error.meta?.target as string[] | string | undefined) ?? [];
        const fields = Array.isArray(target) ? target : [target];
        return {
          message: "A record with the same details already exists.",
          code: "CONFLICT",
          fieldErrors: Object.fromEntries(fields.map((f) => [f, ["Already in use"]])),
        };
      }
      case "P2025":
        return { message: "Record not found or no longer available.", code: "NOT_FOUND" };
      case "P2003":
      case "P2014":
        return { message: "This record is linked to other records and can't be changed that way.", code: "CONFLICT" };
    }
  }
  console.error("[crm] unexpected error", error);
  return { message: "Something went wrong on our side. Please try again.", code: "INTERNAL" };
}
