/**
 * Tests for the CRM operations features: property hierarchy, imports, task tracker,
 * daily tasks/reports and the 24h rollover, scoring, permissions and client isolation.
 * Runs against the throwaway ./test.db (see tests/run.mjs), after services.test.ts.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { hasPermission, isStaff, scope } from "@/lib/permissions";
import { businessDate, dayRange, resolveRange, shiftDate } from "@/lib/business-day";
import { computeScore, EMPTY_METRICS, DEFAULT_SCORING_RULES, sumBreakdowns } from "@/lib/scoring";
import { propertySchema } from "@/schemas/property";
import { taskSchema } from "@/schemas/task";
import { dailyTemplateSchema } from "@/schemas/daily";
import { workActivitySchema } from "@/schemas/work-activity";
import { registerClientSchema, publicLeadSchema } from "@/schemas/portal";
import { createProperty, listProperties } from "@/services/properties";
import { addTaskNote, createTask, getTask, listTasks, reassignTask, setTaskStatus, teamWorkload } from "@/services/tasks";
import { logWorkActivity } from "@/services/work-activities";
import { createDailyTemplate, finalizeDay, getDailyReport, reportRows, runDailyRollover, submitDailyReport } from "@/services/daily";
import { getScoringRules, resetScoringRules, updateScoringRules } from "@/services/scoring";
import { agentPerformance, performanceBoard } from "@/services/performance";
import { runImport } from "@/services/imports";
import { registerClientAccount, requestPasswordReset } from "@/services/client-accounts";
import { createPublicLead, portalLeads, portalOverview, portalProperties, portalTasks } from "@/services/portal";
import { assignLead } from "@/services/leads";
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
  const u = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true, clientId: true } });
  return u as { id: string; role: Role; clientId: string | null };
};
const sample = (file: string) => {
  const json = JSON.parse(readFileSync(`samples/${file}`, "utf8"));
  return Array.isArray(json) ? json : json.listings;
};

async function main() {
  const admin = await actorFor("admin@elite.qa");
  const manager = await actorFor("fatima@elite.qa");
  const omar = await actorFor("omar@elite.qa");
  const aisha = await actorFor("aisha@elite.qa");
  const client = await actorFor("client@elite.qa");
  const today = businessDate();
  const page = { page: 1, pageSize: 200, sort: "createdAt" as const, dir: "desc" as const };

  // ── Business day / time zone ──
  check("business date uses Asia/Qatar (UTC+3)", businessDate(new Date("2026-09-30T21:30:00Z")) === "2026-10-01");
  check("business day starts at Doha midnight", dayRange("2026-10-01").start.toISOString() === "2026-09-30T21:00:00.000Z");
  check("custom range never goes past today", resolveRange("custom", { from: "2020-01-01", to: "2999-01-01" }).to === today);

  // ── Permission matrix ──
  check("ADMIN configures scoring", hasPermission(admin, "performance.configure"));
  check("MANAGER can't configure scoring", !hasPermission(manager, "performance.configure"));
  check("AGENT can't view team", !hasPermission(omar, "tasks.viewTeam") && !hasPermission(omar, "reports.viewTeam"));
  check("CLIENT is not staff", !isStaff(client) && hasPermission(client, "portal.access") && !hasPermission(client, "crm.access"));
  check("CLIENT scope returns nothing", JSON.stringify(scope.leads(client)) === JSON.stringify({ id: { in: [] } }));

  // ── Property hierarchy ──
  const office = await createProperty(manager, propertySchema.parse({ title: "Ops test office", type: "OFFICE", category: "COMMERCIAL", subcategory: "COMPANY", purpose: "RENT", status: "AVAILABLE", price: "25000", currency: "QAR", country: "Qatar", city: "Doha", area: "West Bay" }));
  check("commercial/company property stored", (await db.property.findUniqueOrThrow({ where: { id: office.id } })).category === "COMMERCIAL");
  check("residential type rejected under commercial", !propertySchema.safeParse({ title: "Bad", type: "APARTMENT", category: "COMMERCIAL", purpose: "RENT", status: "AVAILABLE", price: "1", currency: "QAR", country: "Qatar", city: "Doha", area: "Lusail" }).success);
  const villa = await createProperty(omar, propertySchema.parse({ title: "Ops test villa", type: "VILLA", purpose: "SALE", status: "AVAILABLE", price: "3000000", currency: "QAR", country: "Qatar", city: "Doha", area: "Al Waab" }));
  const villaRow = await db.property.findUniqueOrThrow({ where: { id: villa.id } });
  check("category defaults from type, subcategory to Private", villaRow.category === "RESIDENTIAL" && villaRow.subcategory === "PRIVATE");
  const commercialCompany = await listProperties(admin, { ...page, sort: "createdAt" }, { category: "COMMERCIAL", subcategory: "COMPANY" });
  check("hierarchy filter returns only that branch", commercialCompany.items.length > 0 && commercialCompany.items.every((p) => p.category === "COMMERCIAL" && p.subcategory === "COMPANY") && commercialCompany.items.some((p) => p.id === office.id));
  check("creating a listing records a NEW_LISTING activity", Boolean(await db.agentActivity.findUnique({ where: { dedupeKey: `new-listing:${villa.id}` } })));

  // ── Imports ──
  await rejects("agent can't import", () => runImport(omar, "PROPERTY_FINDER", sample("property-finder.sample.json"), { trigger: "api" }), /managers/i);
  const before = await db.property.count();
  const dry = await runImport(manager, "PROPERTY_FINDER", sample("property-finder.sample.json"), { trigger: "api", dryRun: true });
  check("dry run writes nothing", (await db.property.count()) === before && dry.created === 2 && dry.failed === 1, dry);
  const real = await runImport(manager, "PROPERTY_FINDER", sample("property-finder.sample.json"), { trigger: "api" });
  check("import creates valid records, logs failures", real.created === 2 && real.failed === 1 && real.status === "COMPLETED_WITH_ERRORS" && real.records.some((r) => r.status === "FAILED" && /Castle/.test(r.message ?? "")));
  const again = await runImport(manager, "PROPERTY_FINDER", sample("property-finder.sample.json"), { trigger: "api" });
  check("re-import de-duplicates (unchanged)", again.created === 0 && again.unchanged === 2);
  const ql = await runImport(manager, "QATAR_LIVING", sample("qatar-living.sample.json"), { trigger: "api" });
  check("duplicate in batch skipped, missing price fails", ql.created === 2 && ql.skipped === 1 && ql.failed === 1);
  const imported = await db.property.findFirstOrThrow({ where: { externalUrl: "https://www.qatarliving.com/properties/sample-5002" } });
  check("import maps commercial / company / monthly rent", imported.category === "COMMERCIAL" && imported.subcategory === "COMPANY" && imported.price === 20000);
  const bad = await runImport(manager, "PROPERTY_FINDER", [null, 42, { reference_number: "X" }], { trigger: "api" });
  check("a batch of bad records never crashes", bad.status === "FAILED" && bad.failed === 3);

  // ── Task tracker ──
  const lead = await db.lead.findFirstOrThrow({ where: { agentId: omar.id } });
  const task = await createTask(manager, taskSchema.parse({ title: "Ops call task", type: "CALL", priority: "URGENT", status: "TODO", assigneeId: omar.id, leadId: lead.id, dueDate: "" }));
  const created = await db.task.findUniqueOrThrow({ where: { id: task.id } });
  check("task records creator and assigner", created.createdById === manager.id && created.assignedById === manager.id);
  await rejects("agent can't assign tasks to others", () => createTask(omar, taskSchema.parse({ title: "x", priority: "LOW", status: "TODO", assigneeId: aisha.id })), /managers|yourself/i);
  await rejects("agent can't reassign", () => reassignTask(omar, { id: task.id, assigneeId: aisha.id }), /managers/i);
  check("other agent can't see the task", (await getTask(aisha, task.id)) === null);
  await setTaskStatus(omar, task.id, "IN_PROGRESS");
  check("start sets startedAt", Boolean((await db.task.findUniqueOrThrow({ where: { id: task.id } })).startedAt));
  await addTaskNote(omar, task.id, "Called, no answer");
  await setTaskStatus(omar, task.id, "COMPLETED");
  check("completing a CALL task records a CALL activity", Boolean(await db.agentActivity.findUnique({ where: { dedupeKey: `task:${task.id}` } })));
  await setTaskStatus(omar, task.id, "TODO");
  check("reopening the same day withdraws the activity", !(await db.agentActivity.findUnique({ where: { dedupeKey: `task:${task.id}` } })));
  await reassignTask(manager, { id: task.id, assigneeId: aisha.id, note: "Omar is on leave" });
  const detail = await getTask(manager, task.id);
  const eventTypes = detail?.events.map((e) => e.type) ?? [];
  check("task history keeps every change", ["CREATED", "ASSIGNED", "STATUS_CHANGED", "NOTE", "REASSIGNED"].every((t) => eventTypes.includes(t as never)), eventTypes);
  await rejects("agents can't see team workload", () => teamWorkload(omar));
  check("manager sees workload", (await teamWorkload(manager)).rows.some((r) => r.user.id === omar.id));
  const agentList = await listTasks(omar, page as never, {});
  check("agent task list only shows own tasks", agentList.items.every((t) => t.assigneeId === omar.id || t.createdById === omar.id));

  // ── Lead assignment automation ──
  const newLead = await db.lead.create({ data: { fullName: "Ops Auto Lead", phone: "+974 5000 1111", source: "WEBSITE" } });
  await assignLead(manager, newLead.id, aisha.id);
  check("assigning a lead creates a response task", Boolean(await db.task.findUnique({ where: { autoKey: `lead-response:${newLead.id}:${aisha.id}` } })));
  await logWorkActivity(aisha, workActivitySchema.parse({ type: "LEAD_RESPONSE", leadId: newLead.id }));
  check("first response completes the task and moves the lead", (await db.task.findUniqueOrThrow({ where: { autoKey: `lead-response:${newLead.id}:${aisha.id}` } })).status === "COMPLETED" && (await db.lead.findUniqueOrThrow({ where: { id: newLead.id } })).status === "CONTACTED");
  await rejects("a lead's first response is counted once", () => logWorkActivity(aisha, workActivitySchema.parse({ type: "LEAD_RESPONSE", leadId: newLead.id })), /already/i);
  await rejects("agents can't log for others", () => logWorkActivity(omar, workActivitySchema.parse({ type: "CALL", agentId: aisha.id })), /own/i);

  // ── Daily tasks & reports ──
  await rejects("agents can't manage daily tasks", () => createDailyTemplate(omar, dailyTemplateSchema.parse({ title: "x", taskType: "CALL", activityType: "CALL", targetCount: "3", priority: "LOW", dueHour: "18", isActive: true })));
  const tpl = await createDailyTemplate(manager, dailyTemplateSchema.parse({ title: "Ops 3 calls", taskType: "CALL", activityType: "CALL", targetCount: "3", priority: "LOW", dueHour: "23", isActive: true, assigneeId: omar.id }));
  const dailyKey = `daily:${tpl.id}:${omar.id}:${today}`;
  check("template generates today's task immediately", Boolean(await db.task.findUnique({ where: { autoKey: dailyKey } })));
  const reportBefore = await getDailyReport(omar, omar.id, today);
  for (let i = 0; i < 3; i++) await logWorkActivity(omar, workActivitySchema.parse({ type: "CALL", outcome: "test" }));
  check("counter daily task completes at target", (await db.task.findUniqueOrThrow({ where: { autoKey: dailyKey } })).status === "COMPLETED");
  const reportAfter = await getDailyReport(omar, omar.id, today);
  check("live report counts the calls", reportAfter.callsMade >= reportBefore.callsMade + 3, { before: reportBefore.callsMade, after: reportAfter.callsMade });
  await submitDailyReport(omar, { summary: "Ops test day", blockers: null });
  check("submitted report keeps summary", (await getDailyReport(omar, omar.id, today)).summary === "Ops test day");
  await rejects("agents can't read others' reports", () => getDailyReport(omar, aisha.id, today), /own/i);
  check("agent report rows are own only", (await reportRows(omar, resolveRange("week"))).every((r) => r.agentId === omar.id));

  // ── 24h transition: finalize, freeze, never delete ──
  const yesterday = shiftDate(today, -1);
  const yActivities = await db.agentActivity.count({ where: { businessDate: yesterday } });
  const yReport = await db.dailyReport.findUniqueOrThrow({ where: { agentId_date: { agentId: aisha.id, date: yesterday } } });
  await db.dailyReport.update({ where: { id: yReport.id }, data: { status: "OPEN", callsMade: 0 } });
  await db.systemJob.deleteMany({ where: { key: `daily-rollover:${today}` } });
  const rollover = await runDailyRollover();
  const refrozen = await db.dailyReport.findUniqueOrThrow({ where: { id: yReport.id } });
  check("rollover finalizes the open past day", !rollover.skipped && refrozen.status === "FINALIZED" && refrozen.callsMade === yReport.callsMade, { rollover, before: yReport.callsMade, after: refrozen.callsMade });
  check("rollover keeps history (no deletes)", (await db.agentActivity.count({ where: { businessDate: yesterday } })) === yActivities);
  check("rollover is idempotent", (await runDailyRollover()).skipped === true);
  await db.dailyReport.update({ where: { id: yReport.id }, data: { callsMade: 999 } });
  await finalizeDay(yesterday);
  check("finalized reports are never recomputed", (await db.dailyReport.findUniqueOrThrow({ where: { id: yReport.id } })).callsMade === 999);
  await db.dailyReport.update({ where: { id: yReport.id }, data: { callsMade: refrozen.callsMade } });
  check("past daily tasks are closed, not deleted", (await db.task.count({ where: { dailyDate: yesterday, status: { in: ["TODO", "IN_PROGRESS"] } } })) === 0 && (await db.task.count({ where: { dailyDate: yesterday } })) > 0);
  await rejects("today can't be finalized", () => finalizeDay(today), /past days/i);

  // ── Scoring ──
  const score = computeScore({ ...EMPTY_METRICS, callsMade: 10, tasksOverdue: 2, leadsReceived: 2, leadsAnswered: 1, reportSubmitted: true }, DEFAULT_SCORING_RULES);
  check("score = transparent sum of weighted metrics", score.total === 10 * 1 - 2 * 3 + 1 * 3 + 10 * 0.5 + 5, score.total);
  check("each point is explained", score.items.every((i) => typeof i.explanation === "string" && i.explanation.length > 0));
  check("period breakdown is the sum of days", sumBreakdowns([score, score]).total === score.total * 2);
  await rejects("managers can't change weights", () => updateScoringRules(manager, { rules: [{ metric: "callsMade", points: 5, isEnabled: true }] }), /admins/i);
  await updateScoringRules(admin, { rules: [{ metric: "callsMade", points: 5, isEnabled: true }] });
  check("weights are configurable", (await getScoringRules()).callsMade.points === 5);
  await resetScoringRules(admin);
  check("weights reset to defaults", (await getScoringRules()).callsMade.points === 1);
  const board = await performanceBoard(manager, resolveRange("week"));
  check("leaderboard sorted by score", board.agents.every((a, i, all) => i === 0 || all[i - 1].score >= a.score));
  await rejects("agents can't see others' performance", () => agentPerformance(omar, aisha.id, resolveRange("week")), /own/i);
  const own = await agentPerformance(omar, omar.id, resolveRange("month"));
  check("agent performance has 30-day trend", own.trend.length === 30);

  // ── Client accounts & isolation ──
  const reg = await registerClientAccount(registerClientSchema.parse({ name: "Ops Portal A", email: "ops.a@example.com", phone: "+974 5000 2222", password: "OpsPortal2026" }));
  check("self-registration always creates a CLIENT linked to a client record", reg.role === "CLIENT" && Boolean(reg.clientId));
  const regB = await registerClientAccount(registerClientSchema.parse({ name: "Ops Portal B", email: "ops.b@example.com", phone: "+974 5000 3333", password: "OpsPortal2026" }));
  await rejects("e-mail must be unique", () => registerClientAccount(registerClientSchema.parse({ name: "Dup", email: "ops.a@example.com", phone: "+974 5000 2222", password: "OpsPortal2026" })), /already/i);
  const someProperty = await db.property.findFirstOrThrow({ where: { status: "AVAILABLE" } });
  await db.propertyInterest.create({ data: { propertyId: someProperty.id, clientId: regB.clientId! } });
  const aProps = await portalProperties(reg, "http://test");
  check("client A doesn't see client B's shortlist", !aProps.some((p) => p.id === someProperty.id));
  check("client B sees their shortlist", (await portalProperties(regB, "http://test")).some((p) => p.id === someProperty.id));
  await rejects("staff can't use portal services", () => portalOverview(omar, "http://test"), /client accounts/i);
  check("client sees no CRM tasks", (await listTasks(client, page as never, {})).total === 0);
  await rejects("client can't create CRM tasks", () => createTask(client, taskSchema.parse({ title: "x", priority: "LOW", status: "TODO" })));
  const seededPortal = await portalTasks(client);
  check("client sees only tasks shared with them", seededPortal.length > 0 && (await db.task.count({ where: { id: { in: seededPortal.map((t) => t.id) }, OR: [{ clientVisible: false }, { clientId: { not: client.clientId } }] } })) === 0);
  const ownProps = await portalProperties(client, "http://test");
  check("portal properties hide owner data", ownProps.length > 0 && ownProps.every((p) => !("ownerId" in p) && !("owner" in p)));
  check("portal enquiries are client-safe", (await portalLeads(client)).every((l) => !("notes" in l) && !("priority" in l)));

  // ── Public website lead & password reset ──
  const pub = await createPublicLead(publicLeadSchema.parse({ fullName: "Ops Visitor", phone: "+974 5000 4444", message: "Hi" }));
  check("public lead lands in the CRM with a response task", Boolean(await db.task.findFirst({ where: { leadId: pub.id, type: "LEAD_RESPONSE" } })));
  await requestPasswordReset("ops.a@example.com");
  await requestPasswordReset("ops.a@example.com");
  await requestPasswordReset("nobody@example.com");
  check("password reset request creates one task, unknown e-mail none", (await db.task.count({ where: { autoKey: { startsWith: `password-reset:${reg.id}` } } })) === 1);

  console.log(`\noperations tests: ${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
