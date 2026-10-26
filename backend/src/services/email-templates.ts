import "server-only";
import { CLIENT_APP_URL } from "@/lib/env";

/**
 * Branded transactional e-mails. Table-based layout with inline styles so it renders the same
 * in Gmail, Outlook and Apple Mail; the logo is attached inline (cid:logo@elite) so it shows
 * without remote images. Every interpolated value is HTML-escaped.
 */

export const LOGO_CID = "logo@elite";

const GOLD = "#b98f42";
const INK = "#1a1a1a";
const MUTED = "#6b665e";
const PAPER = "#f4f1ec";

export const COMPANY = {
  name: "ELITE Real Estate",
  address: "Office 305, 3rd Floor, Block D, Al Mirqab Mall, Doha – Qatar",
  phone: "+974 3000 4996",
  website: CLIENT_APP_URL,
};

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ───────────────────────────── Building blocks ─────────────────────────────

const p = (html: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${INK}">${html}</p>`;
const h1 = (text: string) => `<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;font-weight:700;color:${INK}">${esc(text)}</h1>`;
const small = (html: string) => `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:${MUTED}">${html}</p>`;

function button(href: string, label: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0"><tr><td style="border-radius:10px;background:${INK}">
<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${esc(label)}</a>
</td></tr></table>`;
}

function codeBox(code: string) {
  const spaced = code.split("").join("&nbsp;");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0"><tr>
<td align="center" style="background:${PAPER};border:1px dashed ${GOLD};border-radius:12px;padding:22px 12px">
<div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;letter-spacing:6px;font-weight:700;color:${INK}">${spaced}</div>
</td></tr></table>`;
}

function infoTable(rows: [string, string | null | undefined][]) {
  const body = rows
    .filter(([, v]) => v != null && v !== "")
    .map(
      ([k, v]) => `<tr>
<td style="padding:10px 14px;font-size:13px;color:${MUTED};border-bottom:1px solid #eee;width:42%;vertical-align:top">${esc(k)}</td>
<td style="padding:10px 14px;font-size:14px;color:${INK};font-weight:600;border-bottom:1px solid #eee">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;border:1px solid #eee;border-radius:12px;border-collapse:separate;overflow:hidden">${body}</table>`;
}

function callout(html: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0"><tr>
<td style="background:#fbf6ec;border-left:4px solid ${GOLD};border-radius:8px;padding:14px 16px;font-size:14px;line-height:22px;color:${INK}">${html}</td></tr></table>`;
}

function layout({ title, preheader, body }: { title: string; preheader: string; body: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${PAPER}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 2px 12px rgba(26,26,26,0.06)">
<tr><td align="center" style="padding:30px 40px 24px"><img src="cid:${LOGO_CID}" width="210" height="54" alt="ELITE Real Estate" style="display:block;border:0;outline:none;width:210px;height:auto"></td></tr>
<tr><td style="height:3px;line-height:3px;font-size:0;background:${GOLD}">&nbsp;</td></tr>
<tr><td style="padding:36px 40px 32px">${body}</td></tr>
<tr><td style="background:${INK};padding:26px 40px">
<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:2px;color:${GOLD}">ELITE REAL ESTATE</p>
<p style="margin:0;font-size:12px;line-height:19px;color:#bdb6aa">${esc(COMPANY.address)}<br>${esc(COMPANY.phone)} · <a href="${esc(COMPANY.website)}" style="color:#bdb6aa;text-decoration:underline">${esc(COMPANY.website.replace(/^https?:\/\//, ""))}</a></p>
</td></tr>
</table>
<p style="margin:18px 0 0;font-size:11px;line-height:17px;color:#9a948a">This is an automated message from ELITE Real Estate. Please don't reply with passwords or codes — our team will never ask for them.</p>
</td></tr></table>
</body></html>`;
}

function textBlock(lines: (string | null | undefined | false)[]) {
  return [...lines.filter((l): l is string => typeof l === "string"), "", `— ${COMPANY.name}`, COMPANY.address, COMPANY.phone].join("\n");
}

const money = (amount: number, currency = "QAR") => `${currency} ${amount.toLocaleString("en-US")}`;

// ───────────────────────────── Templates ─────────────────────────────

export function passwordResetCode(input: { name: string; code: string; minutes: number }): RenderedEmail {
  const where = "the ELITE agent app";
  return {
    subject: `${input.code} is your ELITE password reset code`,
    html: layout({
      title: "Reset your password",
      preheader: `Your code is ${input.code}. It expires in ${input.minutes} minutes.`,
      body: [
        h1("Reset your password"),
        p(`Hi ${esc(input.name.split(" ")[0])},`),
        p(`We received a request to reset the password for ${esc(where)}. Enter this code to continue:`),
        codeBox(input.code),
        p(`The code expires in <strong>${input.minutes} minutes</strong> and can be used once.`),
        callout("Didn't ask for this? You can ignore this e-mail — your password stays the same. Never share this code with anyone, including our staff."),
      ].join(""),
    }),
    text: textBlock([`Hi ${input.name},`, "", `Your ELITE password reset code is: ${input.code}`, `It expires in ${input.minutes} minutes and can be used once.`, "", "Didn't ask for this? Ignore this e-mail — your password stays the same."]),
  };
}

export function passwordChanged(input: { name: string; when: string; loginUrl: string }): RenderedEmail {
  return {
    subject: "Your ELITE password was changed",
    html: layout({
      title: "Password changed",
      preheader: "Your password was changed and other devices were signed out.",
      body: [
        h1("Your password was changed"),
        p(`Hi ${esc(input.name.split(" ")[0])},`),
        p(`The password for your ELITE account was changed on <strong>${esc(input.when)}</strong>. For your security, every other device was signed out.`),
        button(input.loginUrl, "Sign in"),
        callout(`Wasn't you? Call us right away on <strong>${esc(COMPANY.phone)}</strong> so we can lock your account.`),
      ].join(""),
    }),
    text: textBlock([`Hi ${input.name},`, "", `Your ELITE password was changed on ${input.when}. Other devices were signed out.`, `Sign in: ${input.loginUrl}`, "", `Wasn't you? Call us on ${COMPANY.phone}.`]),
  };
}

export function viewingBooked(input: { name: string; property: string; reference: string; when: string; address: string; agent: string | null; listingUrl: string; confirmed: boolean }): RenderedEmail {
  const title = input.confirmed ? "Your viewing is confirmed" : "Viewing requested";
  return {
    subject: `${title}: ${input.property}`,
    html: layout({
      title,
      preheader: `${input.when} · ${input.property}`,
      body: [
        h1(title),
        p(`Hi ${esc(input.name.split(" ")[0])},`),
        p(input.confirmed ? "Your agent confirmed the viewing. See you there!" : "Thanks for booking. Your agent will confirm the time shortly — we'll e-mail you as soon as they do."),
        infoTable([
          ["Property", `${input.property} (${input.reference})`],
          ["When", input.when],
          ["Where", input.address],
          ["Agent", input.agent],
        ]),
        button(input.listingUrl, "View the property"),
        small("Need to change the time? Reply to this e-mail or call your agent."),
      ].join(""),
    }),
    text: textBlock([`Hi ${input.name},`, "", title, `Property: ${input.property} (${input.reference})`, `When: ${input.when}`, `Where: ${input.address}`, input.agent ? `Agent: ${input.agent}` : null, "", `Property page: ${input.listingUrl}`, "Need to change the time? Reply to this e-mail or call your agent."]),
  };
}

export interface BankDetails {
  bankName: string | null;
  accountName: string | null;
  iban: string | null;
  accountNumber: string | null;
  swift: string | null;
  fawranAlias: string | null;
  instructions: string | null;
}

export function reservationCreated(input: { name: string; reference: string; property: string; amount: number; currency: string; payBy: string; bank: BankDetails; manageUrl: string }): RenderedEmail {
  return {
    subject: `Reservation ${input.reference}: pay your booking deposit`,
    html: layout({
      title: "Complete your reservation",
      preheader: `Pay ${money(input.amount, input.currency)} by ${input.payBy} to hold ${input.property}.`,
      body: [
        h1("Complete your reservation"),
        p(`Hi ${esc(input.name.split(" ")[0])},`),
        p(`Thank you for reserving <strong>${esc(input.property)}</strong>. To hold it for you, pay the booking deposit by <strong>${esc(input.payBy)}</strong> with Fawran or a bank transfer:`),
        infoTable([
          ["Amount", money(input.amount, input.currency)],
          ["Payment reference", input.reference],
          ["Fawran (alias / mobile)", input.bank.fawranAlias],
          ["Bank", input.bank.bankName],
          ["Account name", input.bank.accountName],
          ["IBAN", input.bank.iban],
          ["Account number", input.bank.accountNumber],
          ["SWIFT", input.bank.swift],
        ]),
        callout(`Write <strong>${esc(input.reference)}</strong> as the payment reference, then upload the Fawran / transfer receipt on your private reservation page.${input.bank.instructions ? `<br><br>${esc(input.bank.instructions)}` : ""}`),
        button(input.manageUrl, "Upload my payment proof"),
        small("This link is private to you: please don't share it. Card payments are coming soon."),
      ].join(""),
    }),
    text: textBlock([
      `Hi ${input.name},`,
      "",
      `Reservation ${input.reference} for ${input.property}.`,
      `Pay ${money(input.amount, input.currency)} by ${input.payBy} (reference: ${input.reference}).`,
      input.bank.fawranAlias ? `Fawran: ${input.bank.fawranAlias}` : null,
      input.bank.bankName ? `Bank: ${input.bank.bankName}` : null,
      input.bank.accountName ? `Account name: ${input.bank.accountName}` : null,
      input.bank.iban ? `IBAN: ${input.bank.iban}` : null,
      input.bank.accountNumber ? `Account number: ${input.bank.accountNumber}` : null,
      input.bank.swift ? `SWIFT: ${input.bank.swift}` : null,
      "",
      `Upload your receipt: ${input.manageUrl}`,
    ]),
  };
}

export function reservationUpdate(input: { name: string; reference: string; property: string; status: "SUBMITTED" | "CONFIRMED" | "CANCELLED"; amount: number; currency: string; reason?: string | null; manageUrl?: string | null }): RenderedEmail {
  const copy = {
    SUBMITTED: { subject: `We received your payment proof (${input.reference})`, title: "Payment proof received", line: "Thanks! We received your payment proof. Our team is checking it with the bank and will confirm your reservation shortly." },
    CONFIRMED: { subject: `Reservation ${input.reference} confirmed`, title: "Your reservation is confirmed", line: `We received your deposit of ${money(input.amount, input.currency)}. ${input.property} is now reserved for you — your agent will contact you about the next steps and the contract.` },
    CANCELLED: { subject: `Reservation ${input.reference} cancelled`, title: "Reservation cancelled", line: `Your reservation of ${input.property} was cancelled.` },
  }[input.status];
  return {
    subject: copy.subject,
    html: layout({
      title: copy.title,
      preheader: copy.line,
      body: [
        h1(copy.title),
        p(`Hi ${esc(input.name.split(" ")[0])},`),
        p(esc(copy.line)),
        infoTable([
          ["Reservation", input.reference],
          ["Property", input.property],
          ["Deposit", money(input.amount, input.currency)],
          ["Reason", input.status === "CANCELLED" ? input.reason : null],
        ]),
        input.manageUrl ? button(input.manageUrl, "View my reservation") : "",
      ].join(""),
    }),
    text: textBlock([`Hi ${input.name},`, "", copy.line, input.reason ? `Reason: ${input.reason}` : null, "", input.manageUrl ?? null]),
  };
}

export function testEmail(input: { name: string }): RenderedEmail {
  return {
    subject: "ELITE e-mail test",
    html: layout({ title: "Test", preheader: "E-mail delivery works.", body: [h1("E-mail delivery works"), p(`Hi ${esc(input.name.split(" ")[0])}, this is a test message from the ELITE agent app.`)].join("") }),
    text: textBlock([`Hi ${input.name}, this is a test message from the ELITE agent app.`]),
  };
}
