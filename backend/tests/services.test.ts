/**
 * Service-level tests: RBAC, validation and business rules, run against the real
 * SQLite database through the same service functions the Server Actions call.
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { calculateCommission } from "@/lib/commission";
import { propertySchema } from "@/schemas/property";
import { leadSchema } from "@/schemas/lead";
import { viewingSchema } from "@/schemas/viewing";
import { dealSchema } from "@/schemas/deal";
import { createUserSchema } from "@/schemas/user";
import { createProperty, deleteProperty, getProperty, listProperties, updateProperty, setPropertyStatus } from "@/services/properties";
import { createOwner, deleteOwner } from "@/services/owners";
import { assignLead, convertLeadToClient, createLead, getLead, listLeads, setLeadStatus, updateLead } from "@/services/leads";
import { createViewing, setViewingStatus } from "@/services/viewings";
import { createDeal, setDealStatus } from "@/services/deals";
import { createTask, deleteTask, listTasks, setTaskStatus } from "@/services/tasks";
import { addNote, deleteNote } from "@/services/notes";
import { createUser, updateUser } from "@/services/users";
import { globalSearch } from "@/services/search";
import { dashboardStats } from "@/services/dashboard";
import { updateSettings } from "@/services/settings";
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

const actorFor = async (email: string) => {
  const u = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true } });
  return u as { id: string; role: Role };
};

async function main() {
  const admin = await actorFor("admin@elite.qa");
  const manager = await actorFor("fatima@elite.qa");
  const omar = await actorFor("omar@elite.qa");
  const aisha = await actorFor("aisha@elite.qa");
  const page = { page: 1, pageSize: 100, sort: "createdAt" as const, dir: "desc" as const };

  // ── Validation (shared zod schemas) ──
  check("property schema rejects empty title", !propertySchema.safeParse({ title: "", type: "APARTMENT", purpose: "RENT", status: "AVAILABLE", price: "1", currency: "QAR", country: "Qatar", city: "Doha", area: "Lusail" }).success);
  check("property schema rejects negative price", !propertySchema.safeParse({ title: "x", type: "APARTMENT", purpose: "RENT", status: "AVAILABLE", price: "-5", currency: "QAR", country: "Qatar", city: "Doha", area: "Lusail" }).success);
  check("lead schema rejects bad phone", !leadSchema.safeParse({ fullName: "A", phone: "abc", source: "WEBSITE", status: "NEW", priority: "LOW" }).success);
  check("lead schema rejects min > max budget", !leadSchema.safeParse({ fullName: "A", phone: "+974 5512 3456", source: "WEBSITE", status: "NEW", priority: "LOW", budgetMin: "9000", budgetMax: "100" }).success);
  check("lead schema accepts formatted numbers", leadSchema.safeParse({ fullName: "A", phone: "+974 5512 3456", source: "WEBSITE", status: "NEW", priority: "LOW", budgetMin: "1,000", budgetMax: "2,000" }).success);
  const prop0 = await db.property.findFirstOrThrow({ select: { id: true } });
  check("viewing schema rejects end before start", !viewingSchema.safeParse({ propertyId: prop0.id, leadId: null, clientId: null, agentId: null, startsAt: "2026-10-01T10:00", endsAt: "2026-10-01T09:00", status: "SCHEDULED" }).success);
  check("viewing schema requires lead or client", !viewingSchema.safeParse({ propertyId: prop0.id, startsAt: "2026-10-01T10:00", endsAt: "2026-10-01T11:00", status: "SCHEDULED" }).success);
  const parsedV = viewingSchema.safeParse({ propertyId: prop0.id, leadId: (await db.lead.findFirstOrThrow()).id, startsAt: "2026-10-01T10:00", endsAt: "2026-10-01T11:00", status: "SCHEDULED" });
  check("datetime-local input is interpreted as Doha time", parsedV.success && parsedV.data.startsAt.toISOString() === "2026-10-01T07:00:00.000Z", parsedV.success && parsedV.data.startsAt.toISOString());
  check("deal schema rejects commission > 100%", !dealSchema.safeParse({ propertyId: prop0.id, clientId: prop0.id, type: "SALE", status: "NEGOTIATION", amount: "100", commissionPercent: "150", agentSharePercent: "40" }).success);
  check("password policy enforced", !createUserSchema.safeParse({ name: "x", email: "x@y.qa", role: "AGENT", isActive: true, password: "short" }).success);

  // ── Commission maths ──
  const c = calculateCommission({ amount: 1_500_000, commissionPercent: 2, agentSharePercent: 40 });
  check("commission = amount × %", c.commissionAmount === 30_000 && c.agentCommission === 12_000 && c.companyCommission === 18_000, c);
  const c2 = calculateCommission({ amount: 144_000, commissionPercent: 8.33, agentSharePercent: 35 });
  check("commission rounds to whole QAR and splits add up", c2.commissionAmount === 11_995 && c2.agentCommission + c2.companyCommission === c2.commissionAmount, c2);

  // ── Properties ──
  const owner = await createOwner(omar, { fullName: "Test Owner Svc", phone: "+974 5000 1111", secondaryPhone: null, email: "owner.svc@test.qa", nationality: "Qatari", notes: null });
  const base = propertySchema.parse({
    title: "Svc test apartment", type: "APARTMENT", purpose: "RENT", status: "AVAILABLE", price: "9000", currency: "QAR",
    country: "Qatar", city: "Doha", area: "Lusail", bedrooms: "2", ownerId: owner.id, agentId: null,
  });
  const created = await createProperty(omar, base);
  check("agent-created property is assigned to the agent", created.agentId === omar.id);
  check("property gets ELT reference", /^ELT-\d{4}$/.test(created.reference), created.reference);
  const act = await db.activity.findFirst({ where: { propertyId: created.id, action: "CREATED" } });
  check("property creation is logged", Boolean(act));
  await rejects("agent can't assign listing to someone else", () => createProperty(omar, { ...base, agentId: aisha.id }), /yourself/);
  await rejects("agent can't edit another agent's listing", () => updateProperty(aisha, { ...base, id: created.id, agentId: omar.id }), /assigned to you/);
  await rejects("agent can't delete properties", () => deleteProperty(omar, created.id), /managers/);
  const aishaView = await getProperty(aisha, created.id);
  check("owner contact hidden from other agents", aishaView && aishaView.owner === null && aishaView.ownerHidden === true);
  const omarView = await getProperty(omar, created.id);
  check("owner contact visible to listing agent", omarView?.owner?.fullName === "Test Owner Svc");
  await setPropertyStatus(omar, created.id, "RESERVED");
  const statusLog = await db.activity.findFirst({ where: { propertyId: created.id, action: "STATUS_CHANGED" } });
  check("status change logged with from/to", statusLog?.meta?.includes("RESERVED"));
  const rentedList = await listProperties(admin, { page: 1, pageSize: 50, sort: "price", dir: "asc" }, { status: "RENTED" });
  check("property status filter", rentedList.items.every((p) => p.status === "RENTED") && rentedList.total === (await db.property.count({ where: { status: "RENTED" } })));
  check("price sort ascending", rentedList.items.every((p, i, a) => i === 0 || a[i - 1].price <= p.price));
  const priceRange = await listProperties(admin, { page: 1, pageSize: 50, sort: "price", dir: "asc" }, { purpose: "RENT", priceMin: 10000, priceMax: 20000 });
  check("price range filter", priceRange.items.length > 0 && priceRange.items.every((p) => p.price >= 10000 && p.price <= 20000 && p.purpose === "RENT"));
  const beds = await listProperties(admin, { page: 1, pageSize: 50, sort: "price", dir: "asc" }, { beds: 3 });
  check("bedrooms 3+ filter", beds.items.every((p) => (p.bedrooms ?? 0) >= 3));
  const paged = await listProperties(admin, { page: 2, pageSize: 20, sort: "createdAt", dir: "desc" }, {});
  check("pagination page 2", paged.page === 2 && paged.items.length === paged.total - 20 && paged.pageCount === 2, [paged.items.length, paged.total]);

  await rejects("owner with properties can't be deleted", () => deleteOwner(manager, owner.id), /still owns/);
  await rejects("agent can't delete owners", () => deleteOwner(omar, owner.id), /managers/);

  // ── Leads ──
  const lead = await createLead(omar, leadSchema.parse({
    fullName: "Svc Lead Ahmed", phone: "+974 5123 4567", email: "ahmed.svc@test.qa", source: "WHATSAPP", status: "NEW", priority: "HIGH",
    interestedPropertyId: created.id, purpose: "RENT", agentId: null,
  }));
  check("agent lead auto-assigned", lead.agentId === omar.id);
  check("interest created", Boolean(await db.propertyInterest.findFirst({ where: { leadId: lead.id, propertyId: created.id } })));
  const aishaLeads = await listLeads(aisha, { ...page, sort: "createdAt" }, {});
  check("agent only sees own leads", aishaLeads.items.every((l) => l.agentId === aisha.id) && aishaLeads.total === (await db.lead.count({ where: { agentId: aisha.id } })));
  check("agent can't open another agent's lead", (await getLead(aisha, lead.id)) === null);
  await rejects("agent can't move another agent's lead", () => setLeadStatus(aisha, lead.id, "WON"), /not found/i);
  await rejects("agent can't reassign lead", () => assignLead(omar, lead.id, aisha.id), /managers/);
  await setLeadStatus(omar, lead.id, "CONTACTED");
  const moved = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
  check("lead status updated + statusChangedAt", moved.status === "CONTACTED" && moved.statusChangedAt.getTime() > moved.createdAt.getTime() - 1);
  await assignLead(manager, lead.id, aisha.id);
  check("manager reassigns lead", (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).agentId === aisha.id);
  check("assignment logged", Boolean(await db.activity.findFirst({ where: { leadId: lead.id, action: "ASSIGNED" } })));
  await assignLead(manager, lead.id, omar.id);
  await rejects("assigning to a deactivated/unknown user fails", () => assignLead(manager, lead.id, "cxxxxxxxxxxxxxxxxxxxxxxxx"), /not found/i);
  await rejects("agent can't edit/reassign via update", () => updateLead(omar, { ...leadSchema.parse({ fullName: "X", phone: "+974 5123 4567", source: "WEBSITE", status: "NEW", priority: "LOW", agentId: aisha.id }), id: lead.id } as never), /managers/);

  // ── Viewings ──
  const start = new Date(Date.now() + 3 * 86_400_000);
  start.setUTCHours(8, 0, 0, 0);
  const v = await createViewing(omar, { propertyId: created.id, leadId: lead.id, clientId: null, agentId: null, startsAt: start, endsAt: new Date(start.getTime() + 45 * 60_000), status: "SCHEDULED", notes: null });
  check("viewing created for agent", (await db.viewing.findUniqueOrThrow({ where: { id: v.id } })).agentId === omar.id);
  check("scheduling a viewing advances the lead", (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status === "VIEWING_SCHEDULED");
  await rejects("overlapping viewing for same agent blocked", () => createViewing(omar, { propertyId: created.id, leadId: lead.id, clientId: null, agentId: omar.id, startsAt: new Date(start.getTime() + 15 * 60_000), endsAt: new Date(start.getTime() + 60 * 60_000), status: "SCHEDULED", notes: null }), /already has a viewing/);
  await setViewingStatus(omar, v.id, "COMPLETED");
  check("viewing completion logged", Boolean(await db.activity.findFirst({ where: { viewingId: v.id, action: "COMPLETED" } })));

  // ── Convert + deals ──
  const conv = await convertLeadToClient(omar, lead.id);
  const client = await db.client.findUniqueOrThrow({ where: { id: conv.clientId }, include: { interests: true } });
  check("lead converted to client with interests", conv.created && client.fullName === "Svc Lead Ahmed" && client.interests.length === 1 && client.clientType === "TENANT");
  check("convert is idempotent", (await convertLeadToClient(omar, lead.id)).created === false);

  await rejects("deal type must match listing purpose", () => createDeal(omar, dealSchema.parse({ propertyId: created.id, clientId: client.id, type: "SALE", status: "NEGOTIATION", amount: "100000", commissionPercent: "2", agentSharePercent: "40" })), /listed for rent/);
  await rejects("agent can't create deal on a client they don't own", async () => {
    const other = await db.client.findFirstOrThrow({ where: { agentId: aisha.id } });
    return createDeal(omar, dealSchema.parse({ propertyId: created.id, clientId: other.id, type: "RENTAL", status: "NEGOTIATION", amount: "100000", commissionPercent: "8.33", agentSharePercent: "40" }));
  }, /not found/i);
  const deal = await createDeal(omar, dealSchema.parse({ propertyId: created.id, clientId: client.id, leadId: lead.id, type: "RENTAL", status: "CONTRACT_PENDING", amount: "108000", commissionPercent: "8.33", agentSharePercent: "40" }));
  const dealRow = await db.deal.findUniqueOrThrow({ where: { id: deal.id } });
  check("deal reference DL-####", /^DL-\d{4}$/.test(dealRow.reference));
  check("deal commission computed server-side", dealRow.commissionAmount === 8996 && dealRow.agentCommission === 3598 && dealRow.companyCommission === 5398, dealRow);
  check("deal snapshots the property owner", dealRow.ownerId === owner.id);
  await setDealStatus(omar, deal.id, "CLOSED_WON");
  const afterWin = await db.property.findUniqueOrThrow({ where: { id: created.id } });
  check("closing won marks rental property Rented", afterWin.status === "RENTED");
  check("closing won moves lead to Won", (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status === "WON");
  check("closedAt set on close", Boolean((await db.deal.findUniqueOrThrow({ where: { id: deal.id } })).closedAt));
  await rejects("property with deals can't be deleted", () => deleteProperty(manager, created.id), /deal/);

  // ── Tasks & notes ──
  const task = await createTask(omar, { title: "Svc task", description: null, type: "GENERAL", viewingId: null, clientVisible: false, status: "TODO", priority: "HIGH", dueDate: new Date(Date.now() - 3600_000), assigneeId: null, leadId: lead.id, clientId: null, propertyId: null, dealId: null });
  const overdue = await listTasks(omar, { page: 1, pageSize: 50, sort: "dueDate", dir: "asc" }, { due: "overdue" });
  check("overdue filter includes past-due open task", overdue.items.some((t) => t.id === task.id));
  await rejects("agent can't assign task to others", () => createTask(omar, { title: "x", description: null, type: "GENERAL", viewingId: null, clientVisible: false, status: "TODO", priority: "LOW", dueDate: null, assigneeId: aisha.id, leadId: null, clientId: null, propertyId: null, dealId: null }), /yourself/);
  await setTaskStatus(omar, task.id, "COMPLETED");
  const done = await db.task.findUniqueOrThrow({ where: { id: task.id } });
  check("completing task sets completedAt + logs", Boolean(done.completedAt) && Boolean(await db.activity.findFirst({ where: { taskId: task.id, action: "COMPLETED" } })));
  await rejects("other agent can't delete my task", () => deleteTask(aisha, task.id), /not found/i);
  const note = await addNote(omar, "lead", lead.id, "Svc note");
  check("note attached to lead", (await db.note.findUniqueOrThrow({ where: { id: note.id } })).leadId === lead.id);
  await rejects("agent can't delete someone else's note", () => deleteNote(aisha, note.id), /own notes/);
  await rejects("agent can't note another agent's lead", () => addNote(aisha, "lead", lead.id, "x"), /not found/i);

  // ── Search ──
  const hits = await globalSearch(admin, "Svc Lead Ahmed");
  check("global search finds lead & client", hits.some((g) => g.kind === "lead") && hits.some((g) => g.kind === "client"));
  const byOwner = await globalSearch(admin, "Test Owner Svc");
  check("search by owner finds owner, property and deal", ["owner", "property", "deal"].every((k) => byOwner.some((g) => g.kind === k)), byOwner.map((g) => g.kind));
  const phoneHit = await globalSearch(admin, "4567");
  check("search by last phone digits", phoneHit.some((g) => g.kind === "lead" && g.items.some((i) => i.title === "Svc Lead Ahmed")));
  const aishaSearch = await globalSearch(aisha, "Svc Lead Ahmed");
  check("search respects agent scope", !aishaSearch.some((g) => g.kind === "lead"));

  // ── Users & settings ──
  await rejects("manager can't create admins", () => createUser(manager, createUserSchema.parse({ name: "X", email: "x.admin@elite.qa", role: "ADMIN", isActive: true, password: "Abcdefgh12" })), /role/);
  await rejects("agent can't manage users", () => createUser(omar, createUserSchema.parse({ name: "X", email: "x.agent@elite.qa", role: "AGENT", isActive: true, password: "Abcdefgh12" })), /role/);
  await rejects("duplicate e-mail rejected", () => createUser(admin, createUserSchema.parse({ name: "X", email: "omar@elite.qa", role: "AGENT", isActive: true, password: "Abcdefgh12" })), /already used/);
  const me = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
  await rejects("admin can't deactivate themself", () => updateUser(admin, { id: admin.id, name: me.name, email: me.email, phone: null, role: "ADMIN", avatarUrl: null, isActive: false }), /yourself/);
  await rejects("only admins edit settings", () => updateSettings(manager, { companyName: "X", defaultCurrency: "QAR", saleCommissionPercent: 2, rentalCommissionPercent: 8, agentSharePercent: 40, leadResponseSlaMinutes: 60, autoLeadResponseTasks: true }), /admins/);

  // ── Dashboard numbers vs direct counts ──
  const stats = await dashboardStats(admin);
  const [pTotal, pAvail, lTotal, lNew, openAgg, wonCount] = await Promise.all([
    db.property.count(),
    db.property.count({ where: { status: "AVAILABLE" } }),
    db.lead.count(),
    db.lead.count({ where: { status: "NEW" } }),
    db.deal.aggregate({ where: { status: { in: ["NEGOTIATION", "CONTRACT_PENDING", "CONTRACT_SIGNED"] } }, _sum: { amount: true }, _count: { _all: true } }),
    db.deal.count({ where: { status: "CLOSED_WON" } }),
  ]);
  check("dashboard property counts", stats.properties.total === pTotal && stats.properties.available === pAvail);
  check("dashboard lead counts", stats.leads.total === lTotal && stats.leads.new === lNew);
  check("dashboard deal figures", stats.deals.active === openAgg._count._all && stats.deals.pipelineValue === (openAgg._sum.amount ?? 0) && stats.deals.closedWon === wonCount);
  check("conversion rate = won/total", Math.abs(stats.leads.conversionRate - (stats.leads.won / stats.leads.total) * 100) < 1e-9);
  const agentStats = await dashboardStats(omar);
  check("agent dashboard scoped to own leads", agentStats.leads.total === (await db.lead.count({ where: { agentId: omar.id } })));

  console.log(`\nservice tests: ${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
