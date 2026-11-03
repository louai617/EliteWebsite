import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { forbidden, invalid, notFound, conflict } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { hasPermission, isStaff, type Actor } from "@/lib/permissions";
import { STAFF_ROLES } from "@/lib/constants";
import type { payoutSchema, voidPayoutSchema } from "@/schemas/payout";
import { logActivity } from "./activity";
import { nextReference } from "./references";
import type { Tx } from "./types";

/**
 * Agents' commission and payouts. What an agent has earned is their share of every closed
 * deal (`Deal.agentCommission`); each payout is a voucher (PV-1001) that takes money off that
 * balance. Admins pay and cancel vouchers; managers see everyone's figures; agents see their own.
 * A wrong voucher is voided with a reason — never deleted — so the history always adds up.
 */

export const canPay = (actor: Actor) => hasPermission(actor, "payouts.manage");
const canViewTeam = (actor: Actor) => hasPermission(actor, "reports.viewTeam");

function assertCanView(actor: Actor, agentId: string) {
  if (!isStaff(actor) || (actor.id !== agentId && !canViewTeam(actor))) throw forbidden();
}

async function totals(tx: Tx, agentId: string) {
  const [earned, paid] = await Promise.all([
    tx.deal.aggregate({ where: { agentId, status: "CLOSED" }, _sum: { agentCommission: true } }),
    tx.agentPayout.aggregate({ where: { agentId, voidedAt: null }, _sum: { amount: true } }),
  ]);
  const e = earned._sum.agentCommission ?? 0;
  const p = paid._sum.amount ?? 0;
  return { earned: e, paid: p, balance: e - p };
}

/** Everyone's figures (managers/admins) or just your own (agents). */
export async function commissionSummary(actor: Actor) {
  if (!isStaff(actor)) throw forbidden();
  const team = canViewTeam(actor);
  const [users, earned, paid, last] = await Promise.all([
    db.user.findMany({
      where: team ? { role: { in: STAFF_ROLES } } : { id: actor.id },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, role: true, avatarUrl: true, isActive: true },
    }),
    db.deal.groupBy({ by: ["agentId"], where: { status: "CLOSED", agentId: { not: null }, ...(team ? {} : { agentId: actor.id }) }, _sum: { agentCommission: true }, _count: { _all: true } }),
    db.agentPayout.groupBy({ by: ["agentId"], where: { voidedAt: null, ...(team ? {} : { agentId: actor.id }) }, _sum: { amount: true } }),
    db.agentPayout.groupBy({ by: ["agentId"], where: { voidedAt: null, ...(team ? {} : { agentId: actor.id }) }, _max: { paidAt: true } }),
  ]);
  const e = new Map(earned.map((r) => [r.agentId!, { amount: r._sum.agentCommission ?? 0, deals: r._count._all }]));
  const p = new Map(paid.map((r) => [r.agentId, r._sum.amount ?? 0]));
  const l = new Map(last.map((r) => [r.agentId, r._max.paidAt]));
  return users
    .map((u) => {
      const earnedAmount = e.get(u.id)?.amount ?? 0;
      const paidAmount = p.get(u.id) ?? 0;
      return { ...u, deals: e.get(u.id)?.deals ?? 0, earned: earnedAmount, paid: paidAmount, balance: earnedAmount - paidAmount, lastPaidAt: l.get(u.id) ?? null };
    })
    // Inactive accounts only while they still have money or history.
    .filter((u) => u.isActive || u.earned || u.paid);
}

export type CommissionRow = Awaited<ReturnType<typeof commissionSummary>>[number];

/** One agent's statement: closed deals (money in) and vouchers (money out), newest first, with the running balance. */
export async function agentStatement(actor: Actor, agentId: string) {
  assertCanView(actor, agentId);
  const agent = await db.user.findFirst({ where: { id: agentId, role: { in: STAFF_ROLES } }, select: { id: true, name: true, email: true, phone: true, role: true, avatarUrl: true, isActive: true } });
  if (!agent) throw notFound("Agent");
  const [deals, payouts] = await Promise.all([
    db.deal.findMany({
      where: { agentId, status: "CLOSED" },
      select: { id: true, reference: true, closedAt: true, updatedAt: true, amount: true, agentCommission: true, agentSharePercent: true, property: { select: { reference: true, title: true } } },
    }),
    db.agentPayout.findMany({
      where: { agentId },
      select: { id: true, reference: true, amount: true, method: true, note: true, paidAt: true, voidedAt: true, voidReason: true, createdBy: { select: { name: true } } },
    }),
  ]);
  type Entry =
    | { kind: "EARNED"; id: string; date: Date; reference: string; amount: number; detail: string; dealId: string }
    | { kind: "PAYOUT"; id: string; date: Date; reference: string; amount: number; detail: string; method: (typeof payouts)[number]["method"]; voided: boolean; voidReason: string | null; by: string | null };
  const entries: Entry[] = [
    ...deals.map((d) => ({
      kind: "EARNED" as const, id: d.id, date: d.closedAt ?? d.updatedAt, reference: d.reference, amount: d.agentCommission, dealId: d.id,
      detail: `${d.property?.reference ?? "Deal"} · ${d.agentSharePercent}% of the commission on ${formatMoney(d.amount)}`,
    })),
    ...payouts.map((p) => ({
      kind: "PAYOUT" as const, id: p.id, date: p.paidAt, reference: p.reference, amount: p.amount, method: p.method, voided: Boolean(p.voidedAt), voidReason: p.voidReason,
      by: p.createdBy?.name ?? null, detail: p.note ?? "",
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  let balance = 0;
  const withBalance = entries.map((entry) => {
    if (entry.kind === "EARNED") balance += entry.amount;
    else if (!entry.voided) balance -= entry.amount;
    return { ...entry, balance };
  });
  const sum = await totals(db, agentId);
  return { agent, ...sum, entries: withBalance.reverse() };
}

export type AgentStatement = Awaited<ReturnType<typeof agentStatement>>;

/** Pays an agent: checks the balance, takes the amount off it and issues the voucher. */
export async function createPayout(actor: Actor, input: z.output<typeof payoutSchema>) {
  if (!canPay(actor)) throw forbidden("Only admins can pay commissions.");
  const agent = await db.user.findFirst({ where: { id: input.agentId, role: { in: STAFF_ROLES } }, select: { id: true, name: true } });
  if (!agent) throw notFound("Agent");
  if (input.paidAt && input.paidAt.getTime() > Date.now() + 5 * 60_000) throw invalid("The payment date can't be in the future.", { paidAt: ["In the future"] });
  return db.$transaction(async (tx) => {
    const { balance } = await totals(tx, agent.id);
    if (balance <= 0) throw conflict(`${agent.name} has nothing left to pay (balance ${formatMoney(balance)}).`, { amount: ["No balance"] });
    if (input.amount > balance) throw invalid(`That's more than ${agent.name}'s balance of ${formatMoney(balance)}.`, { amount: [`At most ${formatMoney(balance)}`] });
    const reference = await nextReference(tx, "payout", "PV");
    const payout = await tx.agentPayout.create({
      data: {
        reference, agentId: agent.id, amount: input.amount, method: input.method, note: input.note,
        balanceBefore: balance, balanceAfter: balance - input.amount, paidAt: input.paidAt ?? new Date(), createdById: actor.id,
      },
      select: { id: true, reference: true },
    });
    await logActivity(tx, {
      action: "CREATED", entityType: "PAYOUT", entityId: payout.id, entityLabel: payout.reference, userId: actor.id,
      description: `Paid ${agent.name} ${formatMoney(input.amount)} — voucher ${payout.reference} (balance ${formatMoney(balance - input.amount)})`,
      meta: { agentId: agent.id, amount: input.amount },
    });
    return payout;
  });
}

/** Cancels a voucher (wrong amount, paid twice…): the money goes back on the agent's balance. */
export async function voidPayout(actor: Actor, input: z.output<typeof voidPayoutSchema>) {
  if (!canPay(actor)) throw forbidden("Only admins can cancel vouchers.");
  const payout = await db.agentPayout.findUnique({ where: { id: input.id }, select: { id: true, reference: true, amount: true, voidedAt: true, agent: { select: { name: true } } } });
  if (!payout) throw notFound("Voucher");
  if (payout.voidedAt) throw conflict("This voucher is already cancelled.");
  await db.$transaction(async (tx) => {
    await tx.agentPayout.update({ where: { id: payout.id }, data: { voidedAt: new Date(), voidReason: input.reason, voidedById: actor.id } });
    await logActivity(tx, {
      action: "CANCELLED", entityType: "PAYOUT", entityId: payout.id, entityLabel: payout.reference, userId: actor.id,
      description: `Cancelled voucher ${payout.reference} (${formatMoney(payout.amount)} to ${payout.agent.name}) — ${input.reason}`,
    });
  });
  return { reference: payout.reference };
}

/** A voucher, for printing. */
export async function getPayout(actor: Actor, id: string) {
  const payout = await db.agentPayout.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, email: true, phone: true } },
      createdBy: { select: { name: true } },
      voidedBy: { select: { name: true } },
    },
  });
  if (!payout) return null;
  assertCanView(actor, payout.agentId);
  return payout;
}
