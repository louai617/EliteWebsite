import "server-only";
import { db } from "@/lib/db";
import { formatZoned, zonedDayStart, zonedMonthStart } from "@/lib/format";
import { isManager, scope, type Actor } from "@/lib/permissions";
import { LEAD_PIPELINE, LEAD_SOURCE_META, OPEN_DEAL_STATUSES } from "@/lib/constants";
import type { LeadSource, LeadStatus, PropertyStatus } from "@/generated/prisma/enums";

const MONTHS = 6;

/** The last six Doha-time months, oldest first. */
function monthWindow() {
  const starts = Array.from({ length: MONTHS }, (_, i) => zonedMonthStart(i - (MONTHS - 1)));
  return { first: starts[0], months: starts.map((d) => ({ key: formatZoned(d, "yyyy-MM"), label: formatZoned(d, "MMM") })) };
}

/**
 * Every dashboard figure, computed from the database with grouped/aggregate queries
 * (no per-row loops against the DB). Figures respect the actor's scope: agents see
 * their own pipeline, managers see the team.
 */
export async function dashboardStats(actor: Actor) {
  const now = new Date();
  const monthStart = zonedMonthStart();
  const lastMonthStart = zonedMonthStart(-1);
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
  const { first, months } = monthWindow();

  const leadScope = scope.leads(actor);
  const dealScope = scope.deals(actor);
  // Inventory is shared; for agents the headline counts show their own listings.
  const propertyScope = isManager(actor) ? {} : { agentId: actor.id };

  const [
    propertyGroups,
    leadStatusGroups,
    leadSourceGroups,
    leadsThisMonth,
    leadsLastMonth,
    openDeals,
    wonDeals,
    closedLostCount,
    upcomingViewings,
    overdueTasks,
    dueTodayTasks,
    recentLeads,
    closedInWindow,
  ] = await Promise.all([
    db.property.groupBy({ by: ["status"], where: propertyScope, _count: { _all: true } }),
    db.lead.groupBy({ by: ["status"], where: leadScope, _count: { _all: true } }),
    db.lead.groupBy({ by: ["source"], where: leadScope, _count: { _all: true } }),
    db.lead.count({ where: { AND: [leadScope, { createdAt: { gte: monthStart } }] } }),
    db.lead.count({ where: { AND: [leadScope, { createdAt: { gte: lastMonthStart, lt: monthStart } }] } }),
    db.deal.aggregate({ where: { AND: [dealScope, { status: { in: OPEN_DEAL_STATUSES } }] }, _count: { _all: true }, _sum: { amount: true, commissionAmount: true } }),
    db.deal.aggregate({ where: { AND: [dealScope, { status: "CLOSED_WON" }] }, _count: { _all: true }, _sum: { amount: true, commissionAmount: true, agentCommission: true } }),
    db.deal.count({ where: { AND: [dealScope, { status: "CLOSED_LOST" }] } }),
    db.viewing.count({ where: { AND: [scope.viewings(actor), { startsAt: { gte: now, lt: weekAhead }, status: { in: ["SCHEDULED", "CONFIRMED"] } }] } }),
    db.task.count({
      where: { AND: [scope.tasks(actor), { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: now } }] },
    }),
    db.task.count({
      where: {
        AND: [
          scope.tasks(actor),
          { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { gte: zonedDayStart(), lt: zonedDayStart(1) } },
        ],
      },
    }),
    db.lead.findMany({ where: { AND: [leadScope, { createdAt: { gte: first } }] }, select: { createdAt: true } }),
    db.deal.findMany({
      where: { AND: [dealScope, { status: "CLOSED_WON", closedAt: { gte: first } }] },
      select: { closedAt: true, amount: true, commissionAmount: true },
    }),
  ]);

  const byStatus = Object.fromEntries(propertyGroups.map((g) => [g.status, g._count._all])) as Partial<Record<PropertyStatus, number>>;
  const leadByStatus = Object.fromEntries(leadStatusGroups.map((g) => [g.status, g._count._all])) as Partial<Record<LeadStatus, number>>;
  const totalLeads = leadStatusGroups.reduce((n, g) => n + g._count._all, 0);
  const won = leadByStatus.WON ?? 0;

  const leadsPerMonth = months.map((m) => ({ ...m, value: 0 }));
  for (const lead of recentLeads) {
    const row = leadsPerMonth.find((m) => m.key === formatZoned(lead.createdAt, "yyyy-MM"));
    if (row) row.value += 1;
  }

  const commissionPerMonth = months.map((m) => ({ ...m, value: 0, dealValue: 0, deals: 0 }));
  for (const deal of closedInWindow) {
    if (!deal.closedAt) continue;
    const row = commissionPerMonth.find((m) => m.key === formatZoned(deal.closedAt!, "yyyy-MM"));
    if (row) {
      row.value += deal.commissionAmount;
      row.dealValue += deal.amount;
      row.deals += 1;
    }
  }

  return {
    properties: {
      total: propertyGroups.reduce((n, g) => n + g._count._all, 0),
      available: byStatus.AVAILABLE ?? 0,
      reserved: byStatus.RESERVED ?? 0,
      rented: byStatus.RENTED ?? 0,
      sold: byStatus.SOLD ?? 0,
      offMarket: byStatus.OFF_MARKET ?? 0,
    },
    leads: {
      total: totalLeads,
      new: leadByStatus.NEW ?? 0,
      thisMonth: leadsThisMonth,
      lastMonth: leadsLastMonth,
      won,
      lost: leadByStatus.LOST ?? 0,
      /** Share of all leads that reached "Won". */
      conversionRate: totalLeads ? (won / totalLeads) * 100 : 0,
      pipeline: LEAD_PIPELINE.map((status) => ({ status, value: leadByStatus[status] ?? 0 })),
      sources: leadSourceGroups
        .map((g) => ({ source: g.source as LeadSource, label: LEAD_SOURCE_META[g.source].label, value: g._count._all }))
        .sort((a, b) => b.value - a.value),
      perMonth: leadsPerMonth,
    },
    deals: {
      active: openDeals._count._all,
      pipelineValue: openDeals._sum.amount ?? 0,
      pipelineCommission: openDeals._sum.commissionAmount ?? 0,
      closedWon: wonDeals._count._all,
      closedLost: closedLostCount,
      wonValue: wonDeals._sum.amount ?? 0,
      wonCommission: wonDeals._sum.commissionAmount ?? 0,
      agentCommission: wonDeals._sum.agentCommission ?? 0,
      commissionPerMonth,
    },
    viewings: { next7Days: upcomingViewings },
    tasks: { overdue: overdueTasks, dueToday: dueTodayTasks },
  };
}

export type DashboardStats = Awaited<ReturnType<typeof dashboardStats>>;

/** Per-agent performance for managers (closed commission, open pipeline, active leads). */
export async function teamPerformance(actor: Actor) {
  if (!isManager(actor)) return [];
  const [agents, won, open, leads, viewings] = await Promise.all([
    db.user.findMany({ where: { isActive: true, role: { in: ["AGENT", "MANAGER"] } }, select: { id: true, name: true, avatarUrl: true, role: true }, orderBy: { name: "asc" } }),
    db.deal.groupBy({ by: ["agentId"], where: { status: "CLOSED_WON" }, _sum: { commissionAmount: true, amount: true }, _count: { _all: true } }),
    db.deal.groupBy({ by: ["agentId"], where: { status: { in: OPEN_DEAL_STATUSES } }, _sum: { amount: true }, _count: { _all: true } }),
    db.lead.groupBy({ by: ["agentId"], where: { status: { notIn: ["WON", "LOST"] } }, _count: { _all: true } }),
    db.viewing.groupBy({ by: ["agentId"], where: { status: "COMPLETED" }, _count: { _all: true } }),
  ]);
  const get = <T extends { agentId: string | null }>(rows: T[], id: string) => rows.find((r) => r.agentId === id);
  return agents
    .map((a) => ({
      ...a,
      wonDeals: get(won, a.id)?._count._all ?? 0,
      commission: get(won, a.id)?._sum.commissionAmount ?? 0,
      openDeals: get(open, a.id)?._count._all ?? 0,
      pipeline: get(open, a.id)?._sum.amount ?? 0,
      activeLeads: get(leads, a.id)?._count._all ?? 0,
      viewingsDone: get(viewings, a.id)?._count._all ?? 0,
    }))
    .filter((a) => a.role === "AGENT" || a.wonDeals || a.openDeals || a.activeLeads)
    .sort((a, b) => b.commission - a.commission);
}
