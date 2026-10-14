/**
 * Tests for the sales workflow and account features:
 *  - password reset by e-mail code (OTP)
 *  - lead rules: viewing form / pass, Lost needs a reason, Won needs booking form + payment
 *    proof and opens a "Pending contract" deal, the 24-hour rule, bulk reassignment
 *  - deals: Pending contract → Closed (lead becomes a client) / Cancelled
 *  - contract templates and generation
 *  - documents (access rules) and website reservations paid by Fawran
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { verifyPassword } from "@/lib/auth/password";
import { leadSchema, markLostSchema } from "@/schemas/lead";
import { propertySchema } from "@/schemas/property";
import { contractTemplateSchema } from "@/schemas/contract";
import { paymentSettingsSchema } from "@/schemas/settings";
import { registerClientSchema } from "@/schemas/portal";
import { createProperty } from "@/services/properties";
import { bulkReassignLeads, createLead, decideViewingPass, markLeadLost, markLeadWon, reassignStaleLeads, requestViewingPass, setLeadStatus } from "@/services/leads";
import { setDealStatus } from "@/services/deals";
import { generateContract, listTemplates } from "@/services/contracts";
import { deleteDocument, openDocument, portalDocuments, portalUploadDocument, uploadDocument } from "@/services/documents";
import { registerClientAccount } from "@/services/client-accounts";
import { requestPasswordReset, resetPassword, verifyResetCode } from "@/services/password-reset";
import { cancelReservation, confirmReservation, createReservation, expireUnpaidReservations, listClientReservations, reservationQuote } from "@/services/reservations";
import { testMailbox } from "@/services/mail";
import { passwordResetCode } from "@/services/email-templates";
import { deleteDocumentFile } from "@/services/storage";
import type { Role } from "@/generated/prisma/enums";

let pass = 0;
let fail = 0;
function check(name: string, ok: unknown, extra?: unknown) {
  if (ok) pass++;
  else {
    fail++;
    console.log(`FAIL  ${name}`, extra ?? "");
  }
}
async function rejects(name: string, fn: () => Promise<unknown>, match?: RegExp) {
  try {
    await fn();
    check(`${name} (expected rejection)`, false);
  } catch (e) {
    const msg = toPublicError(e).message;
    check(name, !match || match.test(msg), msg);
  }
}

const ORIGIN = "http://api.test";
const actorFor = async (email: string) => {
  const u = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true, clientId: true } });
  return u as { id: string; role: Role; clientId: string | null };
};
const pdf = (name = "form.pdf") => new File([Buffer.from("%PDF-1.4\n% test document\n%%EOF\n")], name, { type: "application/pdf" });
const created: string[] = [];
const lastMail = (to: string) => [...testMailbox()].reverse().find((m) => m.to === to);

async function main() {
  const admin = await actorFor("admin@elite.qa");
  const manager = await actorFor("fatima@elite.qa");
  const omar = await actorFor("omar@elite.qa");
  const aisha = await actorFor("aisha@elite.qa");

  // ── Password reset by e-mail code ──
  const reg = await registerClientAccount(registerClientSchema.parse({ name: "Otp Client", email: "otp.client@example.com", phone: "+974 5000 7777", password: "OtpClient2026" }));
  check("welcome e-mail on registration", lastMail("otp.client@example.com")?.template === "welcome");
  await requestPasswordReset("otp.client@example.com");
  const mail = lastMail("otp.client@example.com");
  const code = mail?.email.subject.match(/^(\d{6})\b/)?.[1] ?? "";
  check("reset e-mail carries a 6-digit code", mail?.template === "password-reset-code" && /^\d{6}$/.test(code), mail?.email.subject);
  check("the code is in the branded HTML with the logo", Boolean(mail?.email.html.includes(code.split("").join("&nbsp;")) && mail?.email.html.includes("cid:logo@elite")));
  const stored = await db.otpCode.findFirstOrThrow({ where: { userId: reg.id } });
  check("only a hash of the code is stored", stored.codeHash !== code && !stored.codeHash.includes(code));
  await requestPasswordReset("otp.client@example.com");
  check("a second request within a minute sends nothing", (await db.otpCode.count({ where: { userId: reg.id } })) === 1);
  await requestPasswordReset("nobody.here@example.com");
  check("unknown e-mail: no code, same response", (await db.otpCode.count({ where: { user: { email: "nobody.here@example.com" } } })) === 0);
  const wrong = code === "000000" ? "111111" : "000000";
  await rejects("wrong code is rejected with attempts left", () => verifyResetCode("otp.client@example.com", wrong), /4 attempts left/);
  await rejects("code for another e-mail is rejected", () => verifyResetCode("omar@elite.qa", code), /isn't right/);
  const { resetToken } = await verifyResetCode("otp.client@example.com", code);
  check("correct code returns a reset token", resetToken.length > 30);
  await rejects("a verified code can't be reused", () => verifyResetCode("otp.client@example.com", code), /isn't right|expired/);
  await db.session.create({ data: { userId: reg.id, tokenHash: "test-session-hash", expiresAt: new Date(Date.now() + 3_600_000) } });
  await rejects("token is bound to the e-mail", () => resetPassword("someone.else@example.com", resetToken, "NewSecret2026"), /expired/);
  await resetPassword("otp.client@example.com", resetToken, "NewSecret2026");
  const after = await db.user.findUniqueOrThrow({ where: { id: reg.id } });
  check("new password works", await verifyPassword("NewSecret2026", after.passwordHash));
  check("all sessions are signed out", (await db.session.count({ where: { userId: reg.id } })) === 0);
  check("password-changed e-mail sent", lastMail("otp.client@example.com")?.template === "password-changed");
  await rejects("reset token is single-use", () => resetPassword("otp.client@example.com", resetToken, "Another2026x"), /expired/);
  // Lockout after 5 wrong codes
  await db.otpCode.updateMany({ where: { userId: reg.id }, data: { createdAt: new Date(Date.now() - 120_000) } });
  await requestPasswordReset("otp.client@example.com");
  for (let i = 0; i < 5; i++) await verifyResetCode("otp.client@example.com", "999999").catch(() => undefined);
  const fresh = lastMail("otp.client@example.com")?.email.subject.match(/^(\d{6})/)?.[1] ?? "";
  await rejects("5 wrong tries lock the code", () => verifyResetCode("otp.client@example.com", fresh === "999999" ? "999998" : fresh), /isn't right|expired|request a new code/i);
  check("e-mail templates escape user input", !passwordResetCode({ name: "<script>x</script>", code: "123456", minutes: 10, portal: "client" }).html.includes("<script>x"));

  // ── Lead rules ──
  const owner = await db.owner.findFirstOrThrow({ select: { id: true } });
  const home = await createProperty(
    omar,
    propertySchema.parse({ title: "Workflow test apartment", type: "APARTMENT", purpose: "RENT", status: "AVAILABLE", price: "12000", currency: "QAR", country: "Qatar", city: "Doha", area: "Lusail", bedrooms: "2", ownerId: owner.id, agentId: null }),
  );
  const leadInput = (name: string, extra: Record<string, unknown> = {}) =>
    leadSchema.parse({ fullName: name, phone: "+974 5512 0000", source: "WEBSITE", status: "NEW", priority: "MEDIUM", interestedPropertyId: home.id, ...extra });
  await rejects("new leads can't start at Won", () => createLead(omar, leadInput("Too Fast", { status: "WON" })), /New leads start/);
  const lead = await createLead(omar, leadInput("Workflow Lead"));
  check("assignment clock starts on create", Boolean((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).assignedAt));
  await setLeadStatus(omar, lead.id, "VIEWING_SCHEDULED");
  await rejects("can't pass the viewing stage without a form or pass", () => setLeadStatus(omar, lead.id, "NEGOTIATION"), /viewing form/i);
  await rejects("Won only through “Mark as won”", () => setLeadStatus(omar, lead.id, "WON"), /Mark as won/);
  await rejects("Lost only through “Mark as lost”", () => setLeadStatus(omar, lead.id, "LOST"), /Mark as lost/);
  check("Lost needs a reason", !markLostSchema.safeParse({ id: lead.id, reason: "  " }).success);

  // Pass request → manager decision
  const asked = await requestViewingPass(omar, { leadId: lead.id, reason: "The client viewed the unit with the owner directly." });
  check("agent pass request waits for a manager", asked.status === "PENDING");
  const passTask = await db.task.findFirst({ where: { leadId: lead.id, autoKey: { startsWith: "viewing-pass:" } } });
  check("the admin gets an approval task", passTask?.assigneeId === admin.id);
  await rejects("still blocked while the pass is pending", () => setLeadStatus(omar, lead.id, "NEGOTIATION"), /viewing form/i);
  const request = await db.leadPassRequest.findFirstOrThrow({ where: { leadId: lead.id } });
  await rejects("agents can't approve passes", () => decideViewingPass(omar, { requestId: request.id, approve: true, note: null }), /managers/i);
  await decideViewingPass(manager, { requestId: request.id, approve: true, note: "OK this time" });
  await setLeadStatus(omar, lead.id, "NEGOTIATION");
  check("approved pass lets the lead move on", (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status === "NEGOTIATION");
  check("approval task completed", (await db.task.findUniqueOrThrow({ where: { id: passTask!.id } })).status === "COMPLETED");

  // Viewing form route on a second lead
  const lead2 = await createLead(omar, leadInput("Form Lead"));
  await setLeadStatus(omar, lead2.id, "VIEWING_SCHEDULED");
  await rejects("only PDF / images are accepted", () => uploadDocument(omar, { target: "lead", targetId: lead2.id, kind: "VIEWING_FORM", title: null, number: null, expiresAt: null, file: new File(["hello"], "x.txt", { type: "text/plain" }) }), /PDF or a photo/);
  await rejects("agents can't attach to others' leads", () => uploadDocument(aisha, { target: "lead", targetId: lead2.id, kind: "VIEWING_FORM", title: null, number: null, expiresAt: null, file: pdf() }), /not found/i);
  const form = await uploadDocument(omar, { target: "lead", targetId: lead2.id, kind: "VIEWING_FORM", title: null, number: null, expiresAt: null, file: pdf("viewing.pdf") });
  created.push(form.id);
  await setLeadStatus(omar, lead2.id, "NEGOTIATION");
  check("a viewing form lets the lead move on", (await db.lead.findUniqueOrThrow({ where: { id: lead2.id } })).status === "NEGOTIATION");
  check("other agents can't open the document", (await openDocument({ ...aisha, clientId: null }, form.id)) === null);
  check("the lead's agent can open it", Boolean(await openDocument({ ...omar, clientId: null }, form.id)));
  await rejects("only managers delete documents", () => deleteDocument(omar, form.id), /managers/i);

  // Lost with a reason
  await markLeadLost(omar, { id: lead2.id, reason: "Bought elsewhere — cheaper unit in Al Waab" });
  const lostLead = await db.lead.findUniqueOrThrow({ where: { id: lead2.id } });
  check("Lost keeps the reason", lostLead.status === "LOST" && lostLead.lostReason?.includes("Al Waab"));

  // Won → deal Pending contract
  await rejects("Won needs the booking form and payment proof", () => markLeadWon(omar, { id: lead.id, propertyId: home.id, amount: 144000, notes: null }), /booking form and the proof of payment/i);
  for (const kind of ["BOOKING_FORM", "PROOF_OF_PAYMENT"] as const) created.push((await uploadDocument(omar, { target: "lead", targetId: lead.id, kind, title: null, number: null, expiresAt: null, file: pdf(`${kind}.pdf`) })).id);
  created.push((await uploadDocument(omar, { target: "lead", targetId: lead.id, kind: "QID", title: null, number: "28463400099", expiresAt: null, file: pdf("qid.pdf") })).id);
  const won = await markLeadWon(omar, { id: lead.id, propertyId: home.id, amount: 144000, notes: null });
  const deal = await db.deal.findUniqueOrThrow({ where: { id: won.dealId } });
  check("Won opens a deal as Pending contract", deal.status === "PENDING_CONTRACT" && deal.leadId === lead.id && deal.clientId === null && deal.type === "RENTAL");
  check("lead is Won", (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status === "WON");
  check("property is reserved", (await db.property.findUniqueOrThrow({ where: { id: home.id } })).status === "RESERVED");
  check("booking paperwork travels with the deal", (await db.document.count({ where: { dealId: deal.id, kind: { in: ["BOOKING_FORM", "PROOF_OF_PAYMENT"] } } })) === 2);
  check("agent gets a 'prepare the contract' task", Boolean(await db.task.findFirst({ where: { autoKey: `prepare-contract:${deal.id}`, assigneeId: omar.id } })));
  await rejects("a won lead with a deal can't be moved back", () => setLeadStatus(omar, lead.id, "CONTACTED"), /Cancel the deal/);
  await rejects("a won lead with a deal can't be marked lost", () => markLeadLost(omar, { id: lead.id, reason: "Changed their mind" }), /cancel the deal/i);

  // ── Contracts ──
  const templates = await listTemplates();
  check("default sale and tenancy drafts exist", templates.some((t) => t.dealType === "SALE") && templates.some((t) => t.dealType === "RENTAL"));
  const tenancy = templates.find((t) => t.dealType === "RENTAL")!;
  check("template placeholders must be known", !contractTemplateSchema.safeParse({ name: "Bad", description: null, dealType: null, body: "Hello {{not_a_field}} ".repeat(5), fields: [], isActive: true }).success);
  await rejects("agents can't edit templates", async () => (await import("@/services/contracts")).saveTemplate(omar, contractTemplateSchema.parse({ name: "x", description: null, dealType: null, body: "Contract text for testing purposes only. ".repeat(3), fields: [], isActive: true })), /admins/i);
  await rejects("required fields must be filled", () => generateContract(omar, { dealId: deal.id, templateId: tenancy.id, values: {} }), /required fields/i);
  const contract = await generateContract(omar, {
    dealId: deal.id,
    templateId: tenancy.id,
    values: { lease_start: "2026-11-01", lease_end: "2027-10-31", monthly_rent: "12000", security_deposit: "12000", cheques: "12", special_conditions: "" },
  });
  const contractRow = await db.contract.findUniqueOrThrow({ where: { id: contract.id } });
  check("contract reference CT-####", /^CT-\d{4}$/.test(contract.reference));
  check("contract is filled from the deal", contractRow.body.includes("Workflow Lead") && /QAR\s144,000/u.test(contractRow.body) && contractRow.body.includes("One hundred forty-four thousand"));
  check("QID number comes from the lead's document", contractRow.body.includes("28463400099"));
  check("agent fields are filled in", contractRow.body.includes("QAR 12,000") && contractRow.body.includes("From 1 Nov 2026 to 31 Oct 2027"));
  check("empty optional fields print a blank line", contractRow.body.includes("________________"));
  check("generating completes the contract task", (await db.task.findFirstOrThrow({ where: { autoKey: `prepare-contract:${deal.id}` } })).status === "COMPLETED");
  await rejects("other agents can't generate for this deal", () => generateContract(aisha, { dealId: deal.id, templateId: tenancy.id, values: {} }), /not found/i);

  // ── Closing ──
  await rejects("agents can't close deals", () => setDealStatus(omar, deal.id, "CLOSED"), /managers/i);
  await setDealStatus(manager, deal.id, "CLOSED");
  const closed = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
  const leadAfter = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
  check("closing turns the lead into a client", Boolean(closed.clientId) && leadAfter.clientId === closed.clientId && closed.status === "CLOSED");
  check("the lead's documents move to the client's file", (await db.document.count({ where: { leadId: lead.id, clientId: closed.clientId } })) === 3);
  check("rental property becomes Rented", (await db.property.findUniqueOrThrow({ where: { id: home.id } })).status === "RENTED");
  check("office gets a task to add the client's documents", Boolean(await db.task.findFirst({ where: { autoKey: `client-documents:${closed.clientId}` } })));

  // ── Cancelling ──
  const home2 = await createProperty(omar, propertySchema.parse({ title: "Workflow villa", type: "VILLA", purpose: "SALE", status: "AVAILABLE", price: "3000000", currency: "QAR", country: "Qatar", city: "Doha", area: "West Bay", bedrooms: "4", ownerId: owner.id, agentId: null }));
  const lead3 = await createLead(omar, leadInput("Cancel Lead", { interestedPropertyId: home2.id }));
  await requestViewingPass(manager, { leadId: lead3.id, reason: "Manager approved: repeat buyer, viewed last week." });
  for (const kind of ["BOOKING_FORM", "PROOF_OF_PAYMENT"] as const) created.push((await uploadDocument(omar, { target: "lead", targetId: lead3.id, kind, title: null, number: null, expiresAt: null, file: pdf() })).id);
  const won3 = await markLeadWon(omar, { id: lead3.id, propertyId: home2.id, amount: 2900000, notes: null });
  await rejects("a booked property can't be booked again", () => markLeadWon(manager, { id: lead.id, propertyId: home2.id, amount: 1, notes: null }), /already won|already booked/i);
  await rejects("cancelling needs a reason", () => setDealStatus(manager, won3.dealId, "CANCELLED", null), /why/i);
  await setDealStatus(manager, won3.dealId, "CANCELLED", "Financing was refused");
  check("cancelled deal keeps its reason", (await db.deal.findUniqueOrThrow({ where: { id: won3.dealId } })).cancelReason === "Financing was refused");
  check("listing is released", (await db.property.findUniqueOrThrow({ where: { id: home2.id } })).status === "AVAILABLE");
  const lead3After = await db.lead.findUniqueOrThrow({ where: { id: lead3.id } });
  check("lead becomes Lost with the deal's reason", lead3After.status === "LOST" && lead3After.lostReason?.includes("Financing was refused"));

  // ── 24-hour rule & bulk reassignment ──
  const stale = await createLead(omar, leadInput("Stale Lead"));
  const progressed = await createLead(omar, leadInput("Busy Lead"));
  await setLeadStatus(omar, progressed.id, "CONTACTED");
  const managersLead = await createLead(manager, leadInput("Manager Lead", { agentId: manager.id }));
  const old = new Date(Date.now() - 25 * 3_600_000);
  await db.lead.updateMany({ where: { id: { in: [stale.id, progressed.id, managersLead.id] } }, data: { assignedAt: old } });
  const moved = await reassignStaleLeads();
  const staleAfter = await db.lead.findUniqueOrThrow({ where: { id: stale.id } });
  check("a New lead untouched for 24 h moves to the admin", staleAfter.agentId === admin.id && Boolean(staleAfter.autoReassignedAt) && moved.moved >= 1);
  check("a lead the agent progressed stays", (await db.lead.findUniqueOrThrow({ where: { id: progressed.id } })).agentId === omar.id);
  check("managers' own leads are left alone", (await db.lead.findUniqueOrThrow({ where: { id: managersLead.id } })).agentId === manager.id);
  check("the move is logged", Boolean(await db.activity.findFirst({ where: { leadId: stale.id, action: "ASSIGNED", description: { contains: "automatically" } } })));
  check("the admin gets the response task", Boolean(await db.task.findFirst({ where: { leadId: stale.id, type: "LEAD_RESPONSE", assigneeId: admin.id, status: "TODO" } })));
  check("running again moves nothing new", (await reassignStaleLeads()).moved === 0);

  await rejects("agents can't bulk reassign", () => bulkReassignLeads(omar, { fromAgentId: omar.id, toAgentId: aisha.id, onlyNew: false }), /managers/i);
  const fresh1 = await createLead(omar, leadInput("Bulk One"));
  const bulk = await bulkReassignLeads(admin, { fromAgentId: omar.id, toAgentId: aisha.id, onlyNew: true });
  check("bulk reassign moves the agent's New leads", bulk.moved >= 1 && (await db.lead.findUniqueOrThrow({ where: { id: fresh1.id } })).agentId === aisha.id);
  check("bulk reassign leaves progressed leads when 'only New'", (await db.lead.findUniqueOrThrow({ where: { id: progressed.id } })).agentId === omar.id);

  // ── Reservations (Fawran) ──
  const client = await actorFor("client@elite.qa");
  const live = await createProperty(omar, propertySchema.parse({ title: "Reservation test flat", type: "APARTMENT", purpose: "SALE", status: "AVAILABLE", price: "1500000", currency: "QAR", country: "Qatar", city: "Doha", area: "The Pearl", bedrooms: "2", ownerId: owner.id, agentId: null, websitePublished: true }));
  check("payment settings need an IBAN or Fawran alias", !paymentSettingsSchema.safeParse({ fawranEnabled: true, saleDepositPercent: 5, rentDepositMonths: 1, reservationHoldHours: 48 }).success);
  const quote = await reservationQuote(client, live.reference);
  check("deposit is 5% of the price", quote.amount === 75000, quote.amount);
  check("card gateway is shown as coming soon", quote.methods.some((m) => m.method === "CARD" && !m.enabled && m.comingSoon));
  await rejects("card payments are not available yet", () => createReservation(client, { property: live.reference, method: "CARD", note: null }, ORIGIN), /coming soon/i);
  const r = await createReservation(client, { property: live.reference, method: "FAWRAN", note: "Will pay today" }, ORIGIN);
  check("reservation awaits payment", r.status === "AWAITING_PAYMENT" && /^RS-\d{4}$/.test(r.reference));
  const resMail = lastMail("client@elite.qa");
  check("reservation e-mail has the bank details and reference", resMail?.template === "reservation-created" && resMail.email.html.includes("QA00DEMO") && resMail.email.html.includes(r.reference));
  await rejects("one active reservation per home", () => createReservation(client, { property: live.reference, method: "FAWRAN", note: null }, ORIGIN), /already have/i);
  const other = await registerClientAccount(registerClientSchema.parse({ name: "Other Buyer", email: "other.buyer@example.com", phone: "+974 5000 8888", password: "OtherBuyer2026" }));
  await rejects("other clients can't attach proofs to it", () => portalUploadDocument(other, { kind: "PROOF_OF_PAYMENT", title: null, number: null, expiresAt: null, reservationId: r.id, file: pdf() }), /not found/i);
  const proof = await portalUploadDocument(client, { kind: "PROOF_OF_PAYMENT", title: null, number: null, expiresAt: null, reservationId: r.id, file: pdf("fawran.pdf") });
  created.push(proof.id);
  check("uploading the receipt submits the payment", (await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).status === "PAYMENT_SUBMITTED");
  check("agent gets an urgent 'verify payment' task", Boolean(await db.task.findFirst({ where: { autoKey: `verify-payment:${r.id}`, priority: "URGENT" } })));
  check("client sees the receipt on their file", (await portalDocuments(client)).some((d) => d.id === proof.id));
  check("client can open their own receipt", Boolean(await openDocument(client, proof.id)));
  check("other clients can't open it", (await openDocument(other, proof.id)) === null);
  await rejects("other agents can't confirm it", () => confirmReservation(aisha, r.id), /not found/i);
  await confirmReservation(omar, r.id);
  check("confirming reserves the home", (await db.property.findUniqueOrThrow({ where: { id: live.id } })).status === "RESERVED" && (await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).status === "CONFIRMED");
  check("client is e-mailed the confirmation", lastMail("client@elite.qa")?.template === "reservation-confirmed");
  await rejects("a reserved home can't be reserved by someone else", () => createReservation(other, { property: live.reference, method: "FAWRAN", note: null }, ORIGIN), /already reserved/i);
  await rejects("agents can't cancel a confirmed reservation", () => cancelReservation(omar, r.id, "Changed plans"), /managers/i);
  await cancelReservation(manager, r.id, "Client asked for a refund");
  check("cancelling releases the home", (await db.property.findUniqueOrThrow({ where: { id: live.id } })).status === "AVAILABLE");
  const listed = await listClientReservations(client, ORIGIN);
  check("client sees the cancelled reservation with the reason", listed.items.some((x) => x.id === r.id && x.status === "CANCELLED" && x.cancelReason?.includes("refund")));
  // Unpaid reservations expire
  const r2 = await createReservation(other, { property: live.reference, method: "FAWRAN", note: null }, ORIGIN);
  await db.reservation.update({ where: { id: r2.id }, data: { payBy: new Date(Date.now() - 60_000) } });
  check("unpaid reservations are released after the hold time", (await expireUnpaidReservations()) >= 1 && (await db.reservation.findUniqueOrThrow({ where: { id: r2.id } })).status === "CANCELLED");

  // Clean up the files this test wrote (rows go with the throwaway database).
  for (const id of created) {
    const doc = await db.document.findUnique({ where: { id }, select: { storageKey: true } });
    if (doc) await deleteDocumentFile(doc.storageKey);
  }

  console.log(`workflow tests: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
