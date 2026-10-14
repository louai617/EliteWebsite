import "server-only";
import { createHmac } from "node:crypto";

/** SESSION_SECRET (required in production). Kept free of Next.js imports so scripts can use it. */
export function serverSecret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (≥ 16 chars).");
    return "dev-only-insecure-session-secret";
  }
  return value;
}

/** HMAC-SHA256 keyed with SESSION_SECRET (session tokens, e-mail codes, reset tokens). */
export function keyedHash(value: string) {
  return createHmac("sha256", serverSecret()).update(value).digest("hex");
}
