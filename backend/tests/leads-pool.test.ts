/**
 * Tests for the leads pool: managers add numbers (one by one or pasted), agents see them
 * masked and ask for them, a manager approves and the lead lands on the agent's Leads page.
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { maskPhone, maskPhonesIn } from "@/lib/search";
import { poolBulkSchema, poolLeadSchema } from "@/schemas/leads-pool";
import { listLeads } from "@/services/leads";
import {
  addPoolLead,
  addPoolLeadsBulk,
  assignPoolLead,
  cancelPoolRequest,
  decidePoolRequest,
  deletePoolLead,
  listMyPoolRequests,
  listPendingPoolRequests,
  listPool,
  MAX_PENDING_REQUESTS,
  parsePoolLines,
  requestPoolLead,
  updatePoolLead,
} from "@/services/leads-pool";
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

  // ── Get this lead → approval ──
  const asked = await requestPoolLead(omar, buyer.id);
  check("an agent's request waits for the management", asked.status === "PENDING" && asked.leadId === null);
  await rejects("asking twice is refused", () => requestPoolLead(omar, buyer.id), /already asked/i);
  const aishaAsked = await requestPoolLead(aisha, buyer.id);
  check("several agents can ask for the same lead", aishaAsked.status === "PENDING");
  const approvalTask = await db.task.findFirst({ where: { autoKey: { startsWith: `pool-request:${buyer.id}:` }, assigneeId: admin.id } });
  check("the admin gets an approval task", Boolean(approvalTask));
  check("the task doesn't show the full number", approvalTask && !approvalTask.description?.includes("6600 1122") && !approvalTask.title.includes("6600"));
  check("the request is listed for managers with the full number", (await listPendingPoolRequests(manager)).some((r) => r.poolLead.id === buyer.id && r.poolLead.phone === "+974 6600 1122"));
  check("agents get no pending list", (await listPendingPoolRequests(omar)).length === 0);
  check("the agent sees their request as requested", (await listPool(omar, params(), {})).items.find((r) => r.id === buyer.id)?.myRequest?.status === "PENDING");
  check("the leads page doesn't have it yet", (await listLeads(omar, params("Khalid"), {})).total === 0);

  const omarRequest = await db.poolLeadRequest.findFirstOrThrow({ where: { poolLeadId: buyer.id, requestedById: omar.id } });
  await rejects("agents can't approve", () => decidePoolRequest(omar, { requestId: omarRequest.id, approve: true, note: null }), /managers/i);
  const approved = await decidePoolRequest(manager, { requestId: omarRequest.id, approve: true, note: "Call him today" });
  check("approval creates the lead", approved.status === "APPROVED" && Boolean(approved.leadId));
  const lead = await db.lead.findUniqueOrThrow({ where: { id: approved.leadId! } });
  check("the lead is the agent's, with the full details", lead.agentId === omar.id && lead.phone === "+974 6600 1122" && lead.fullName === "Khalid Buyer" && lead.source === "LEADS_POOL" && lead.status === "NEW");
  check("needs are carried over", lead.leadType === "BUYER" && lead.purpose === "SALE" && lead.interestedArea === "Lusail" && lead.budgetMin === 2000000 && lead.bedrooms === 3 && lead.email === "khalid.buyer@example.com");
  check("it shows on the agent's Leads page", (await listLeads(omar, params("Khalid"), {})).total === 1);
  check("the usual response task is created", Boolean(await db.task.findFirst({ where: { leadId: lead.id, type: "LEAD_RESPONSE", assigneeId: omar.id } })));
  const pool = await db.poolLead.findUniqueOrThrow({ where: { id: buyer.id } });
  check("the pool entry is marked taken", pool.status === "TAKEN" && pool.takenById === omar.id && pool.leadId === lead.id);
  check("the other agent's request is declined", (await db.poolLeadRequest.findFirstOrThrow({ where: { poolLeadId: buyer.id, requestedById: aisha.id } })).status === "REJECTED");
  check("approval tasks are closed", (await db.task.count({ where: { autoKey: { startsWith: `pool-request:${buyer.id}:` }, status: { in: ["TODO", "IN_PROGRESS"] } } })) === 0);
  check("taken leads leave the agents' pool", !(await listPool(aisha, params(), {})).items.some((r) => r.id === buyer.id));
  const omarRequests = await listMyPoolRequests(omar);
  check("the approved agent sees the number and the lead", omarRequests.some((r) => r.status === "APPROVED" && r.leadId === lead.id && r.phone === "+974 6600 1122"));
  const aishaRequests = await listMyPoolRequests(aisha);
  check("the declined agent still sees it masked", aishaRequests.some((r) => r.status === "REJECTED" && r.leadId === null && r.phone === maskPhone("+974 6600 1122")));
  await rejects("a taken lead can't be requested again", () => requestPoolLead(aisha, buyer.id), /not found/i);
  await rejects("a decided request can't be decided again", () => decidePoolRequest(manager, { requestId: omarRequest.id, approve: true, note: null }), /already decided/i);

  // Decline + ask again, cancel
  await requestPoolLead(aisha, owner.id);
  const aishaOwner = await db.poolLeadRequest.findFirstOrThrow({ where: { poolLeadId: owner.id, requestedById: aisha.id, status: "PENDING" } });
  await decidePoolRequest(admin, { requestId: aishaOwner.id, approve: false, note: "Already handled by the office" });
  check("a declined lead stays in the pool", (await db.poolLead.findUniqueOrThrow({ where: { id: owner.id } })).status === "AVAILABLE");
  check("the agent sees the reason", (await listMyPoolRequests(aisha)).some((r) => r.id === aishaOwner.id && r.decisionNote === "Already handled by the office"));
  const again = await requestPoolLead(aisha, owner.id);
  check("after a decline the agent may ask again", again.status === "PENDING");
  const againRow = await db.poolLeadRequest.findFirstOrThrow({ where: { poolLeadId: owner.id, requestedById: aisha.id, status: "PENDING" } });
  await rejects("agents can't cancel others' requests", () => cancelPoolRequest(omar, againRow.id), /not found/i);
  await cancelPoolRequest(aisha, againRow.id);
  check("cancelling removes the request and its task", (await db.poolLeadRequest.count({ where: { id: againRow.id } })) === 0 && (await db.task.count({ where: { autoKey: `pool-request:${owner.id}:${againRow.id}`, status: "TODO" } })) === 0);

  // Limit on waiting requests
  const many = await addPoolLeadsBulk(manager, poolBulkSchema.parse({ lines: Array.from({ length: MAX_PENDING_REQUESTS + 1 }, (_, i) => `+974 7700 ${String(1000 + i)}`).join("\n") }));
  const ids = (await db.poolLead.findMany({ where: { phone: { startsWith: "+974 7700" } }, select: { id: true }, orderBy: { phone: "asc" } })).map((r) => r.id);
  check("bulk added the batch", many.added === MAX_PENDING_REQUESTS + 1);
  for (const id of ids.slice(0, MAX_PENDING_REQUESTS)) await requestPoolLead(aisha, id);
  await rejects(`at most ${MAX_PENDING_REQUESTS} requests waiting at once`, () => requestPoolLead(aisha, ids[MAX_PENDING_REQUESTS]), /requests waiting/i);

  // ── Managers give or take directly ──
  const direct = await assignPoolLead(manager, { id: ids[0], agentId: omar.id });
  check("a manager can give a pool lead straight to an agent", (await db.lead.findUniqueOrThrow({ where: { id: direct.leadId } })).agentId === omar.id);
  check("giving it declines the other waiting requests", (await db.poolLeadRequest.findFirstOrThrow({ where: { poolLeadId: ids[0], requestedById: aisha.id } })).status === "REJECTED");
  const taken = await requestPoolLead(manager, ids[1]);
  check("a manager's “Get this lead” takes it straight away", taken.status === "APPROVED" && (await db.lead.findUniqueOrThrow({ where: { id: taken.leadId! } })).agentId === manager.id);
  const noName = await db.lead.findUniqueOrThrow({ where: { id: taken.leadId! } });
  check("a lead without a name is named after its number", noName.fullName === noName.phone);
  await rejects("a taken lead can't be given twice", () => assignPoolLead(manager, { id: ids[0], agentId: aisha.id }), /already given/i);

  // ── Editing and removing ──
  await updatePoolLead(manager, { ...entry({ phone: "+974 3311 2200", fullName: "Owner Saad", notes: "2 villas" }), id: owner.id });
  check("managers can edit an entry", (await db.poolLead.findUniqueOrThrow({ where: { id: owner.id } })).fullName === "Owner Saad");
  await rejects("agents can't edit", () => updatePoolLead(omar, { ...entry({ phone: "+974 3311 2200" }), id: owner.id }), /managers/i);
  await rejects("taken entries are edited on the Leads page", () => updatePoolLead(manager, { ...entry({ phone: "+974 6600 1122" }), id: buyer.id }), /Leads page/);
  await rejects("agents can't remove entries", () => deletePoolLead(omar, owner.id), /managers/i);
  await deletePoolLead(manager, buyer.id);
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
