/**
 * Tests for the leads pool: managers add numbers (one by one, pasted, or from an Excel / CSV
 * file), agents see them masked and take them straight away, managers give ticked numbers to
 * an agent — each becomes a lead on that agent's Leads page.
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { maskPhone, maskPhonesIn } from "@/lib/search";
import { poolBulkSchema, poolLeadSchema } from "@/schemas/leads-pool";
import { listLeads } from "@/services/leads";
import { addPoolLead, addPoolLeadsBulk, assignPoolLeads, deletePoolLeads, importPoolFile, listPool, parsePoolLines, poolBatches, takePoolLead, updatePoolLead } from "@/services/leads-pool";
import { readPoolSheet } from "@/services/pool-import";
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

const actorFor = async (email: string) => (await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true } })) as { id: string; role: Role };
const params = (q?: string) => ({ page: 1, pageSize: 50, q, sort: "createdAt" as const, dir: "desc" as const });
const entry = (raw: Record<string, unknown>) => poolLeadSchema.parse({ fullName: "", email: "", leadType: "", purpose: "", interestedArea: "", budgetMin: "", budgetMax: "", bedrooms: "", notes: "", ...raw });

async function main() {
  const admin = await actorFor("admin@elite.qa");
  const manager = await actorFor("fatima@elite.qa");
  const omar = await actorFor("omar@elite.qa");
  const aisha = await actorFor("aisha@elite.qa");

  // ── Masking ──
  check("Qatar number keeps the country code, one digit and the last", maskPhone("+974 5512 3457") === "+9745******7", maskPhone("+974 5512 3457"));
  check("local number shows only the first and last digit", maskPhone("5512 3457") === "5******7", maskPhone("5512 3457"));
  check("numbers inside notes are masked", maskPhonesIn("Owner, call 5512 3457 after 4 pm") === "Owner, call 5******7 after 4 pm");

  // ── Adding (only the phone is required) ──
  check("only the phone is required", poolLeadSchema.safeParse({ phone: "+974 3311 2200" }).success);
  check("a phone is required", !poolLeadSchema.safeParse({ fullName: "No number" }).success);
  await rejects("agents can't add to the pool", () => addPoolLead(omar, entry({ phone: "+974 3311 2200" })), /managers/i);
  const owner = await addPoolLead(manager, entry({ phone: "+974 3311 2200", notes: "Private owner — 2 villas in Al Waab, call 3311 2200 after 4 pm" }));
  const buyer = await addPoolLead(admin, entry({ phone: "+974 6600 1122", fullName: "Khalid Buyer", email: "khalid.buyer@example.com", leadType: "BUYER", purpose: "SALE", interestedArea: "Lusail", budgetMin: "2000000", budgetMax: "3500000", bedrooms: "3" }));
  await rejects("the same number can't be in the pool twice", () => addPoolLead(manager, entry({ phone: "+97433112200" })), /already in the pool/i);

  // Paste many
  const parsed = parsePoolLines("+974 5100 0001, Ahmed\n\n+974 5100 0002\nnot a number\n+974 5100 0001 again\n55 12 34 56 78  Sara");
  check("pasted lines: number + name", parsed.rows[0].phone === "+974 5100 0001" && parsed.rows[0].fullName === "Ahmed");
  check("a line without a name keeps the name empty", parsed.rows[1].fullName === null);
  check("lines without a number are reported", parsed.skipped.length === 1 && parsed.skipped[0].line === 4);
  const bulk = await addPoolLeadsBulk(manager, poolBulkSchema.parse({ lines: "+974 5100 0001, Ahmed\n+974 5100 0002\nnot a number\n+974 5100 0001 again\n+974 3311 2200", leadType: "LANDLORD", purpose: "RENT", notes: "October campaign" }));
  check("bulk adds the new numbers", bulk.added === 2, bulk);
  check("bulk skips duplicates (in the paste and already in the pool) and junk", bulk.skipped.length === 3, bulk.skipped);
  check("bulk applies the shared details", (await db.poolLead.count({ where: { leadType: "LANDLORD", purpose: "RENT", notes: "October campaign" } })) === 2);

  // ── What agents see ──
  const agentView = await listPool(omar, params(), {});
  const ownerRow = agentView.items.find((r) => r.id === owner.id)!;
  const buyerRow = agentView.items.find((r) => r.id === buyer.id)!;
  check("agents see the pool", agentView.total >= 4);
  check("agents see the number masked", ownerRow.phone === "+9743******0" && ownerRow.masked, ownerRow.phone);
  check("agents never receive the full number anywhere", !JSON.stringify(agentView).includes("3311 2200") && !JSON.stringify(agentView).includes("33112200"));
  check("numbers in the notes are hidden from agents", ownerRow.notes?.includes("3******0") && !ownerRow.notes?.includes("3311"), ownerRow.notes);
  check("agents see the needs", buyerRow.leadType === "BUYER" && buyerRow.interestedArea === "Lusail" && buyerRow.budgetMax === 3500000);
  check("e-mails are masked for agents", buyerRow.email === "k•••@example.com", buyerRow.email);
  check("agents can't search by number", (await listPool(omar, params("3311"), {})).total === 0);
  const managerView = await listPool(manager, params(), {});
  check("managers see the full number", managerView.items.find((r) => r.id === owner.id)?.phone === "+974 3311 2200");
  check("managers can search by number", (await listPool(manager, params("33112200"), {})).items.some((r) => r.id === owner.id));

  // ── Get this lead: straight away ──
  check("the leads page doesn't have it yet", (await listLeads(omar, params("Khalid"), {})).total === 0);
  const got = await takePoolLead(omar, buyer.id);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: got.leadId } });
  check("the lead is the agent's at once, with the full details", lead.agentId === omar.id && lead.phone === "+974 6600 1122" && lead.fullName === "Khalid Buyer" && lead.source === "LEADS_POOL" && lead.status === "NEW");
  check("needs are carried over", lead.leadType === "BUYER" && lead.purpose === "SALE" && lead.interestedArea === "Lusail" && lead.budgetMin === 2000000 && lead.bedrooms === 3 && lead.email === "khalid.buyer@example.com");
  check("it shows on the agent's Leads page", (await listLeads(omar, params("Khalid"), {})).total === 1);
  check("the usual response task is created", Boolean(await db.task.findFirst({ where: { leadId: lead.id, type: "LEAD_RESPONSE", assigneeId: omar.id } })));
  const pool = await db.poolLead.findUniqueOrThrow({ where: { id: buyer.id } });
  check("the pool entry is marked taken", pool.status === "TAKEN" && pool.takenById === omar.id && pool.leadId === lead.id);
  check("taken leads leave the agents' pool", !(await listPool(aisha, params(), {})).items.some((r) => r.id === buyer.id));
  await rejects("nobody else can take it", () => takePoolLead(aisha, buyer.id), /no longer in the pool/i);
  check("other agents can't open the lead", (await listLeads(aisha, params("Khalid"), {})).total === 0);
  const [a1, a2] = await Promise.allSettled([takePoolLead(omar, owner.id), takePoolLead(aisha, owner.id)]);
  check("two agents pressing at once: only one gets it", [a1, a2].filter((r) => r.status === "fulfilled").length === 1 && (await db.lead.count({ where: { phone: "+974 3311 2200" } })) === 1);

  // ── Excel / CSV import ──
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Owners");
  ws.addRow(["Owners list — October"]);
  ws.addRow(["Mobile", "Client name", "Type", "Rent/Sale", "Location", "Beds", "Budget", "Nationality", "Comments"]);
  ws.addRow([97455001001, "Hamad", "Landlord", "Rent", "Al Waab", "4", "15,000 - 18,000", "Qatari", "2 villas"]);
  ws.addRow(["+974 5500 1002 / 6600 9999", "Mona", "buyer", "for sale", "Lusail", "Studio", "1.2M", "", ""]);
  ws.addRow(["", "No number here", "", "", "", "", "", "", ""]);
  ws.addRow(["12", "Bad number", "", "", "", "", "", "", ""]);
  ws.addRow(["+974 5500 1001", "Duplicate of row 3", "", "", "", "", "", "", ""]);
  ws.addRow(["+974 6600 1122", "Already a lead, but not in the pool any more", "", "", "", "", "", "", ""]);
  const xlsx = new File([Buffer.from(await wb.xlsx.writeBuffer())], "owners october.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const sheet = await readPoolSheet(xlsx);
  check("the heading row is found below a title row", sheet.columns.some((c) => c.heading === "Mobile" && c.field === "phone"));
  const hamad = sheet.rows.find((r) => r.fullName === "Hamad");
  check("columns are recognised by their headings", hamad?.phone === "97455001001" && hamad.leadType === "LANDLORD" && hamad.purpose === "RENT" && hamad.interestedArea === "Al Waab" && hamad.bedrooms === 4, hamad);
  check("a budget range is split into min and max", hamad?.budgetMin === 15000 && hamad.budgetMax === 18000);
  check("other columns are kept in the notes", hamad?.notes === "2 villas · Nationality: Qatari", hamad?.notes);
  const mona = sheet.rows.find((r) => r.fullName === "Mona");
  check("a second number in the cell goes to the notes", mona?.phone === "+974 5500 1002" && mona.notes?.includes("Other number: 6600 9999"), mona);
  check("words are understood (buyer, for sale, studio, 1.2M)", mona?.leadType === "BUYER" && mona.purpose === "SALE" && mona.bedrooms === 0 && mona.budgetMax === 1200000);
  check("rows without a valid number are listed", sheet.skipped.length === 2 && sheet.skipped.every((s) => s.line === 5 || s.line === 6), sheet.skipped);

  const imported = await importPoolFile(manager, xlsx);
  check("import adds the new numbers", imported.added === 3, imported);
  check("import skips the repeated number", imported.skippedCount === 3 && imported.skipped.some((s) => s.reason === "Already in the pool"));
  check("the batch is named after the file", imported.batch.startsWith("owners october.xlsx · "));
  check("managers can filter by import", (await listPool(manager, params(), { batch: imported.batch })).total === 3);
  check("imports are listed for the filter", (await poolBatches(manager)).some((b) => b.batch === imported.batch && b.available === 3));
  check("agents don't see where numbers came from", (await listPool(omar, params(), {})).items.every((r) => r.batch === null) && (await poolBatches(omar)).length === 0);
  await rejects("agents can't import", () => importPoolFile(omar, xlsx), /managers/i);

  const csv = new File(["\uFEFFphone;name;area\r\n\"+974 5500 2001\";\"Salem; the owner\";The Pearl\r\n55002002;Noor;West Bay\r\n"], "list.csv", { type: "text/csv" });
  const csvRows = (await readPoolSheet(csv)).rows;
  check("CSV with semicolons and quotes", csvRows.length === 2 && csvRows[0].fullName === "Salem; the owner" && csvRows[1].interestedArea === "West Bay", csvRows);
  const noHeadings = (await readPoolSheet(new File(["Khalifa,+974 5500 3001\nJassim,+974 5500 3002\n"], "x.csv"))).rows;
  check("without headings the phone column is found", noHeadings.length === 2 && noHeadings[0].phone === "+974 5500 3001" && noHeadings[0].fullName === "Khalifa", noHeadings);
  await rejects("old .xls files get a clear message", () => importPoolFile(manager, new File(["x"], "old.xls")), /Save As/);
  await rejects("other files are refused", () => importPoolFile(manager, new File(["%PDF-1.4"], "doc.pdf")), /Excel|CSV/);
  await rejects("a fake .xlsx is refused", () => importPoolFile(manager, new File(["not a zip"], "fake.xlsx")), /Excel|CSV/);

  // ── Managers tick numbers and give them to an agent ──
  const batchIds = (await listPool(manager, { ...params(), sort: "createdAt", dir: "asc" }, { batch: imported.batch })).items.map((r) => r.id);
  await rejects("agents can't give leads out", () => assignPoolLeads(omar, { ids: batchIds, agentId: omar.id }), /managers/i);
  const given = await assignPoolLeads(manager, { ids: batchIds.slice(0, 2), agentId: aisha.id });
  check("the ticked numbers become the agent's leads", given.given === 2 && (await db.lead.count({ where: { id: { in: given.leadIds }, agentId: aisha.id, source: "LEADS_POOL" } })) === 2);
  check("they're on her Leads page", (await listLeads(aisha, params(), { source: "LEADS_POOL" })).total >= 2);
  const again = await assignPoolLeads(manager, { ids: batchIds, agentId: omar.id });
  check("numbers already given are skipped", again.given === 1 && again.skipped === 2);
  const self = await addPoolLead(manager, entry({ phone: "+974 5500 4001" }));
  const mine = await takePoolLead(manager, self.id);
  const noName = await db.lead.findUniqueOrThrow({ where: { id: mine.leadId } });
  check("managers can take one themselves; no name → named after the number", noName.agentId === manager.id && noName.fullName === noName.phone);

  // ── Editing and removing ──
  const editable = await addPoolLead(manager, entry({ phone: "+974 5500 6001" }));
  await updatePoolLead(manager, { ...entry({ phone: "+974 5500 6001", fullName: "Owner Saad", notes: "2 villas" }), id: editable.id });
  check("managers can edit an entry", (await db.poolLead.findUniqueOrThrow({ where: { id: editable.id } })).fullName === "Owner Saad");
  await rejects("agents can't edit", () => updatePoolLead(omar, { ...entry({ phone: "+974 5500 6001" }), id: editable.id }), /managers/i);
  await rejects("taken entries are edited on the Leads page", () => updatePoolLead(manager, { ...entry({ phone: "+974 6600 1122" }), id: buyer.id }), /Leads page/);
  await rejects("agents can't remove entries", () => deletePoolLeads(omar, [owner.id]), /managers/i);
  const spare = await addPoolLead(manager, entry({ phone: "+974 5500 5001" }));
  check("managers can remove several at once", (await deletePoolLeads(manager, [buyer.id, spare.id])).removed === 2);
  check("removing a taken entry keeps the lead", (await db.lead.count({ where: { id: lead.id } })) === 1);
  const activity = await db.activity.findMany({ where: { entityType: "POOL_LEAD" }, select: { description: true } });
  check("pool changes are in the activity log", activity.length >= 5);
  check("the activity log never shows a full pool number", activity.every((a) => !/\d{4} ?\d{4}/.test(a.description)), activity.map((a) => a.description));

  console.log(`leads pool tests: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
