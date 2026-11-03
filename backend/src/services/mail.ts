import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";
import { MAIL, mailConfigured } from "@/lib/env";
import { LOGO_CID, type RenderedEmail } from "./email-templates";

/**
 * Sends a rendered e-mail.
 *  - SMTP configured (SMTP_HOST…): sent through it.
 *  - No SMTP in development: written to storage/outbox/*.html so you can open it in a browser.
 *  - Tests: kept in memory (see `testMailbox`).
 * Every attempt is logged in EmailLog (recipient, subject, status — never the body).
 * Never throws: callers decide what a failure means.
 */

export type MailStatus = "SENT" | "OUTBOX" | "FAILED";

const g = globalThis as unknown as { __eliteMailer?: Transporter; __eliteMailbox?: { to: string; template: string; email: RenderedEmail }[] };

function transporter() {
  g.__eliteMailer ??= nodemailer.createTransport({
    host: MAIL.host,
    port: MAIL.port,
    secure: MAIL.secure,
    auth: MAIL.user ? { user: MAIL.user, pass: MAIL.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return g.__eliteMailer;
}

let logo: Promise<Buffer | null> | null = null;
function logoFile() {
  logo ??= readFile(/*turbopackIgnore: true*/ path.join(process.cwd(), "public", "email-logo.png")).catch(() => null);
  return logo;
}

/** Messages "sent" while NODE_ENV=test (newest last). */
export function testMailbox() {
  return (g.__eliteMailbox ??= []);
}

async function writeOutbox(to: string, template: string, email: RenderedEmail) {
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "outbox");
  await mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
  const buf = await logoFile();
  // Inline the logo so the saved file previews correctly.
  const html = buf ? email.html.replace(`cid:${LOGO_CID}`, `data:image/png;base64,${buf.toString("base64")}`) : email.html;
  const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${template}-${to.replace(/[^a-zA-Z0-9]/g, "_")}.html`;
  await writeFile(/*turbopackIgnore: true*/ path.join(dir, name), html);
  return name;
}

export async function sendMail(to: string, template: string, email: RenderedEmail): Promise<MailStatus> {
  let status: MailStatus = "FAILED";
  let error: string | null = null;
  try {
    if (process.env.NODE_ENV === "test") {
      testMailbox().push({ to, template, email });
      status = "OUTBOX";
    } else if (mailConfigured()) {
      const buf = await logoFile();
      await transporter().sendMail({
        from: MAIL.from,
        to,
        replyTo: MAIL.replyTo || undefined,
        subject: email.subject,
        html: email.html,
        text: email.text,
        attachments: buf ? [{ filename: "elite-logo.png", content: buf, cid: LOGO_CID, contentType: "image/png" }] : [],
      });
      status = "SENT";
    } else if (process.env.NODE_ENV !== "production") {
      const file = await writeOutbox(to, template, email);
      console.info(`[mail] SMTP not configured — "${email.subject}" for ${to} saved to storage/outbox/${file}`);
      status = "OUTBOX";
    } else {
      error = "SMTP is not configured (SMTP_HOST)";
      console.error(`[mail] cannot send "${template}" to ${to}: ${error}`);
    }
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 300) : "Unknown error";
    console.error(`[mail] sending "${template}" to ${to} failed:`, error);
  }
  await db.emailLog.create({ data: { to, subject: email.subject, template, status, error } }).catch(() => undefined);
  return status;
}

/** Fire-and-forget variant for notifications that must not block the request. */
export function queueMail(to: string | null | undefined, template: string, email: RenderedEmail) {
  if (!to) return;
  void sendMail(to, template, email);
}

export async function recentEmails(take = 20) {
  return db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take, select: { id: true, to: true, subject: true, template: true, status: true, error: true, createdAt: true } });
}
