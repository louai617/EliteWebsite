import "server-only";
import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { CustomerType, ListingPurpose, PoolLeadStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { isManager, isStaff, type Actor } from "@/lib/permissions";
import { paginate, skipTake, type ListParams } from "@/lib/list-params";
import { digitsOnly, like, maskEmail, maskPhone, maskPhonesIn } from "@/lib/search";
import { phone as phoneRule } from "@/schemas/common";
import type { poolAssignSchema, poolBulkSchema, poolDecisionSchema, poolLeadSchema, updatePoolLeadSchema } from "@/schemas/leads-pool";
import { logActivity } from "./activity";
import { assertActiveUser } from "./access";
import { onLeadAssigned } from "./automation";
import { escalationUser } from "./leads";
import type { Tx } from "./types";

/**
 * The leads pool: contacts managers and admins collect (buyers, tenants with their needs, or
 * just a private owner's number). Agents browse it with the numbers masked and ask for a lead
 * ("Get this lead"); once a manager approves, it becomes a normal lead on the agent's Leads
 * page, with the full details. Masking happens here on the server — an agent's browser never
 * receives a pool number it hasn't been given.
 */

export const POOL_SORTS = ["createdAt", "fullName", "budgetMax"] as const;

/** How many requests an agent may have waiting at once (so nobody reserves the whole pool). */
export const MAX_PENDING_REQUESTS = 10;

export interface PoolFilters {
  status?: PoolLeadStatus;
  leadType?: CustomerType;
  purpose?: ListingPurpose;
}

function poolWhere(actor: Actor, q: string | undefined, f: PoolFilters): Prisma.PoolLeadWhereInput {
  const manager = isManager(actor);
  const digits = q ? digitsOnly(q) : "";
  return {
    AND: [
      // Agents only ever see what is still in the pool.
      manager ? (f.status ? { status: f.status } : {}) : { status: "AVAILABLE" },
      // Agents can't search by digits at all: matching them against the stored notes or names
      // would reveal hidden numbers bit by bit.
      q && !manager && /[0-9]{3}/.test(q.replace(/[^0-9]/g, ""))
        ? { id: { in: [] } }
        : q
        ? {
            OR: [
              { fullName: like(q) },
              { interestedArea: like(q) },
              { notes: like(q) },
              // Searching by number would let agents guess the hidden digits — managers only.
              ...(manager && digits.length >= 3 ? [{ phoneDigits: like(digits) }] : []),
              ...(manager ? [{ email: like(q) }] : []),
            ],
          }
        : {},
      f.leadType ? { leadType: f.leadType } : {},
      f.purpose ? { purpose: f.purpose } : {},
    ],
  };
}

const poolSelect = {
  id: true,
  phone: true,
  fullName: true,
  email: true,
  leadType: true,
  purpose: true,
  interestedArea: true,
  budgetMin: true,
  budgetMax: true,
  bedrooms: true,
  notes: true,
  status: true,
  createdAt: true,
  takenAt: true,
  leadId: true,
  createdBy: { select: { name: true } },
  takenBy: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.PoolLeadSelect;

type PoolRow = Prisma.PoolLeadGetPayload<{ select: typeof poolSelect }>;

export interface PoolListItem extends Omit<PoolRow, "phone" | "email" | "createdBy" | "takenBy" | "leadId"> {
  /** The full number for managers; masked (+9745******7) for agents. */
  phone: string;
  email: string | null;
  masked: boolean;
  createdBy: { name: string } | null;
  takenBy: { id: string; name: string; avatarUrl: string | null } | null;
  leadId: string | null;
  /** Agents: their own request on this entry. Managers: how many requests are waiting. */
  myRequest: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" } | null;
  pendingRequests: number;
}

/** What an agent may see of a pool entry. */
function forViewer(actor: Actor, row: PoolRow, myRequest: PoolListItem["myRequest"], pendingRequests: number): PoolListItem {
  if (isManager(actor)) return { ...row, masked: false, myRequest, pendingRequests };
  return {
    ...row,
    phone: maskPhone(row.phone),
    email: row.email ? maskEmail(row.email) : null,
    // A number typed into the name or the notes stays hidden too.
    fullName: row.fullName && maskPhonesIn(row.fullName),
    notes: row.notes && maskPhonesIn(row.notes.replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, (e) => maskEmail(e))),
    masked: true,
    createdBy: null,
    takenBy: null,
    leadId: null,
    myRequest,
    pendingRequests: 0,
  };
}

export async function listPool(actor: Actor, params: ListParams<(typeof POOL_SORTS)[number]>, filters: PoolFilters) {
  if (!isStaff(actor)) throw forbidden();
  const where = poolWhere(actor, params.q, filters);
  const [rows, total] = await Promise.all([
    db.poolLead.findMany({ where, orderBy: [{ [params.sort]: params.dir }, { createdAt: "desc" }], ...skipTake(params.page, params.pageSize), select: poolSelect }),
    db.poolLead.count({ where }),
  ]);
  const ids = rows.map((r) => r.id);
  const [mine, pending] = await Promise.all([
    db.poolLeadRequest.findMany({ where: { poolLeadId: { in: ids }, requestedById: actor.id }, orderBy: { createdAt: "asc" }, select: { id: true, poolLeadId: true, status: true } }),
    isManager(actor) ? db.poolLeadRequest.groupBy({ by: ["poolLeadId"], where: { poolLeadId: { in: ids }, status: "PENDING" }, _count: { _all: true } }) : [],
  ]);
  const myRequest = new Map(mine.map((r) => [r.poolLeadId, { id: r.id, status: r.status }]));
  const pendingCount = new Map(pending.map((p) => [p.poolLeadId, p._count._all]));
  const items = rows.map((row) => forViewer(actor, row, myRequest.get(row.id) ?? null, pendingCount.get(row.id) ?? 0));
  return paginate(items, total, params.page, params.pageSize);
}

export async function poolCounts(actor: Actor) {
  const [available, taken, pending] = await Promise.all([
    db.poolLead.count({ where: { status: "AVAILABLE" } }),
    isManager(actor) ? db.poolLead.count({ where: { status: "TAKEN" } }) : 0,
    isManager(actor) ? db.poolLeadRequest.count({ where: { status: "PENDING" } }) : db.poolLeadRequest.count({ where: { status: "PENDING", requestedById: actor.id } }),
  ]);
  return { available, taken, pending };
}

/** Managers: the requests waiting for a decision, with the full contact. */
export async function listPendingPoolRequests(actor: Actor) {
  if (!isManager(actor)) return [];
  return db.poolLeadRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      requestedBy: { select: { id: true, name: true, avatarUrl: true } },
      poolLead: { select: { id: true, phone: true, fullName: true, leadType: true, purpose: true, interestedArea: true, notes: true } },
    },
  });
}

export type PendingPoolRequest = Awaited<ReturnType<typeof listPendingPoolRequests>>[number];

/** Agents: their recent requests and how they went (approved ones link to the new lead). */
export async function listMyPoolRequests(actor: Actor) {
  const rows = await db.poolLeadRequest.findMany({
    where: { requestedById: actor.id, OR: [{ status: "PENDING" }, { decidedAt: { gte: new Date(Date.now() - 14 * 86_400_000) } }] },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      createdAt: true,
      decidedAt: true,
      decisionNote: true,
      poolLead: { select: { phone: true, fullName: true, leadId: true, takenById: true } },
    },
  });
  return rows.map(({ poolLead, ...r }) => {
    const mine = r.status === "APPROVED" && poolLead.takenById === actor.id;
    return { ...r, fullName: poolLead.fullName && (mine ? poolLead.fullName : maskPhonesIn(poolLead.fullName)), phone: mine ? poolLead.phone : maskPhone(poolLead.phone), leadId: mine ? poolLead.leadId : null };
  });
}

export type MyPoolRequest = Awaited<ReturnType<typeof listMyPoolRequests>>[number];

// ───────────────────────────── Adding ─────────────────────────────

function assertManager(actor: Actor) {
  if (!isManager(actor)) throw forbidden("Only managers and admins can manage the leads pool.");
}

/** Short label for logs and tasks — never the full number. */
const label = (p: { fullName: string | null; phone: string }) => (p.fullName ? `${p.fullName} (${maskPhone(p.phone)})` : maskPhone(p.phone));

async function duplicateInPool(digits: string, exceptId?: string) {
  return db.poolLead.findFirst({ where: { phoneDigits: digits, status: "AVAILABLE", ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
}

/** Leads that already have this number (matched on digits, so spacing doesn't matter). */
async function existingLeads(digits: string) {
  const candidates = await db.lead.findMany({ where: { phone: like(digits.slice(-4)) }, select: { id: true, fullName: true, phone: true, agent: { select: { name: true } } }, take: 50 });
  return candidates.filter((l) => digitsOnly(l.phone) === digits || digitsOnly(l.phone).endsWith(digits) || digits.endsWith(digitsOnly(l.phone)));
}

export async function addPoolLead(actor: Actor, input: z.output<typeof poolLeadSchema>) {
  assertManager(actor);
  const digits = digitsOnly(input.phone);
  if (await duplicateInPool(digits)) throw conflict("This number is already in the pool.", { phone: ["Already in the pool"] });
  const known = await existingLeads(digits);
  const row = await db.$transaction(async (tx) => {
    const created = await tx.poolLead.create({ data: { ...input, phoneDigits: digits, createdById: actor.id }, select: { id: true, fullName: true, phone: true } });
    await logActivity(tx, { action: "CREATED", entityType: "POOL_LEAD", entityId: created.id, entityLabel: label(created), description: `Added ${label(created)} to the leads pool`, userId: actor.id });
    return created;
  });
  return { id: row.id, alreadyLead: known[0] ? { id: known[0].id, fullName: known[0].fullName, agent: known[0].agent?.name ?? null } : null };
}

/** Parses pasted lines: the first phone-like part of each line, the rest is the name. */
export function parsePoolLines(text: string) {
  const out: { line: number; phone: string; fullName: string | null }[] = [];
  const skipped: { line: number; text: string; reason: string }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const match = line.match(/\+?[0-9][0-9 ()-]{6,19}[0-9]/);
    const phone = match?.[0].trim();
    if (!phone || !phoneRule.safeParse(phone).success) {
      skipped.push({ line: i + 1, text: line.slice(0, 80), reason: "No valid phone number" });
      return;
    }
    const rest = line.replace(match![0], " ").replace(/^[\s,;:|\t-]+|[\s,;:|\t-]+$/g, "").replace(/\s{2,}/g, " ");
    out.push({ line: i + 1, phone, fullName: rest ? rest.slice(0, 120) : null });
  });
  return { rows: out, skipped };
}

export async function addPoolLeadsBulk(actor: Actor, input: z.output<typeof poolBulkSchema>) {
  assertManager(actor);
  const { rows, skipped } = parsePoolLines(input.lines);
  if (rows.length > 1000) throw invalid("Paste up to 1,000 numbers at a time.", { lines: ["Too many lines"] });
  const existing = new Set(
    (await db.poolLead.findMany({ where: { status: "AVAILABLE", phoneDigits: { in: rows.map((r) => digitsOnly(r.phone)) } }, select: { phoneDigits: true } })).map((r) => r.phoneDigits),
  );
  const fresh: typeof rows = [];
  for (const row of rows) {
    const digits = digitsOnly(row.phone);
    if (existing.has(digits)) {
      skipped.push({ line: row.line, text: row.phone, reason: "Already in the pool" });
      continue;
    }
    existing.add(digits);
    fresh.push(row);
  }
  if (fresh.length) {
    await db.$transaction(async (tx) => {
      await tx.poolLead.createMany({
        data: fresh.map((r) => ({
          phone: r.phone,
          phoneDigits: digitsOnly(r.phone),
          fullName: r.fullName,
          leadType: input.leadType,
          purpose: input.purpose,
          notes: input.notes,
          createdById: actor.id,
        })),
      });
      await logActivity(tx, {
        action: "CREATED", entityType: "POOL_LEAD", entityId: "bulk", entityLabel: `${fresh.length} numbers`,
        description: `Added ${fresh.length} number${fresh.length === 1 ? "" : "s"} to the leads pool`, userId: actor.id, meta: { count: fresh.length },
      });
    });
  }
  skipped.sort((a, b) => a.line - b.line);
  return { added: fresh.length, skipped };
}

export async function updatePoolLead(actor: Actor, input: z.output<typeof updatePoolLeadSchema>) {
  assertManager(actor);
  const { id, ...data } = input;
  const current = await db.poolLead.findUnique({ where: { id }, select: { status: true } });
  if (!current) throw notFound("Pool lead");
  if (current.status === "TAKEN") throw conflict("This lead was already given to an agent — edit it on the Leads page.");
  const digits = digitsOnly(data.phone);
  if (await duplicateInPool(digits, id)) throw conflict("This number is already in the pool.", { phone: ["Already in the pool"] });
  return db.$transaction(async (tx) => {
    const row = await tx.poolLead.update({ where: { id }, data: { ...data, phoneDigits: digits }, select: { id: true, fullName: true, phone: true } });
    await logActivity(tx, { action: "UPDATED", entityType: "POOL_LEAD", entityId: id, entityLabel: label(row), description: `Updated ${label(row)} in the leads pool`, userId: actor.id });
    return { id: row.id };
  });
}

/** Removes an entry from the pool. A lead already created from it stays on the Leads page. */
export async function deletePoolLead(actor: Actor, id: string) {
  assertManager(actor);
  const row = await db.poolLead.findUnique({ where: { id }, select: { id: true, fullName: true, phone: true } });
  if (!row) throw notFound("Pool lead");
  await db.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { autoKey: { startsWith: `pool-request:${id}:` }, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
    await tx.poolLead.delete({ where: { id } });
    await logActivity(tx, { action: "DELETED", entityType: "POOL_LEAD", entityId: id, entityLabel: label(row), description: `Removed ${label(row)} from the leads pool`, userId: actor.id });
  });
}

// ───────────────────────────── Getting a lead ─────────────────────────────

/**
 * Turns a pool entry into a lead for `agentId` (inside a transaction). The entry is claimed
 * with a conditional update, so two approvals at the same moment can't both succeed.
 */
async function giveInTx(tx: Tx, actor: Actor, poolLeadId: string, agentId: string) {
  const pool = await tx.poolLead.findUnique({ where: { id: poolLeadId } });
  if (!pool) throw notFound("Pool lead");
  if (pool.status !== "AVAILABLE") throw conflict("This lead was already given to an agent.");
  const now = new Date();
  const lead = await tx.lead.create({
    data: {
      fullName: pool.fullName ?? pool.phone,
      phone: pool.phone,
      email: pool.email,
      source: "LEADS_POOL",
      leadType: pool.leadType,
      purpose: pool.purpose,
      interestedArea: pool.interestedArea,
      budgetMin: pool.budgetMin,
      budgetMax: pool.budgetMax,
      bedrooms: pool.bedrooms,
      notes: pool.notes,
      agentId,
      assignedAt: now,
    },
    select: { id: true, fullName: true, status: true, agentId: true },
  });
  const claimed = await tx.poolLead.updateMany({ where: { id: pool.id, status: "AVAILABLE" }, data: { status: "TAKEN", takenById: agentId, takenAt: now, leadId: lead.id } });
  if (claimed.count !== 1) throw conflict("This lead was already given to an agent.");

  // Settle every other request for this entry.
  const others = await tx.poolLeadRequest.findMany({ where: { poolLeadId: pool.id, status: "PENDING" }, select: { id: true, requestedById: true } });
  for (const r of others) {
    const approved = r.requestedById === agentId;
    await tx.poolLeadRequest.update({
      where: { id: r.id },
      data: { status: approved ? "APPROVED" : "REJECTED", decidedById: actor.id, decidedAt: now, ...(approved ? {} : { decisionNote: "Given to another agent" }) },
    });
  }
  await tx.task.updateMany({ where: { autoKey: { startsWith: `pool-request:${pool.id}:` }, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "COMPLETED", completedAt: now } });

  await onLeadAssigned(tx, lead, actor.id);
  const agent = await tx.user.findUnique({ where: { id: agentId }, select: { name: true } });
  await logActivity(tx, {
    action: "CREATED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName, userId: actor.id, leadId: lead.id,
    description: agentId === actor.id ? `Took ${lead.fullName} from the leads pool` : `Gave ${lead.fullName} from the leads pool to ${agent?.name}`,
    meta: { poolLeadId: pool.id, agentId },
  });
  await logActivity(tx, {
    action: "ASSIGNED", entityType: "POOL_LEAD", entityId: pool.id, entityLabel: label(pool), userId: actor.id, leadId: lead.id,
    description: `${label(pool)} left the leads pool — now a lead of ${agent?.name}`,
  });
  return { leadId: lead.id };
}

/**
 * "Get this lead". An agent's request goes to the management for approval; a manager or
 * admin takes the lead straight away.
 */
export async function requestPoolLead(actor: Actor, id: string) {
  if (!isStaff(actor)) throw forbidden();
  const pool = await db.poolLead.findUnique({ where: { id }, select: { id: true, status: true, fullName: true, phone: true, leadType: true, purpose: true, interestedArea: true } });
  if (!pool || pool.status !== "AVAILABLE") throw notFound("Pool lead");

  if (isManager(actor)) {
    const { leadId } = await db.$transaction((tx) => giveInTx(tx, actor, id, actor.id));
    return { status: "APPROVED" as const, leadId };
  }

  const [mine, waiting] = await Promise.all([
    db.poolLeadRequest.findFirst({ where: { poolLeadId: id, requestedById: actor.id, status: "PENDING" }, select: { id: true } }),
    db.poolLeadRequest.count({ where: { requestedById: actor.id, status: "PENDING" } }),
  ]);
  if (mine) throw conflict("You already asked for this lead — a manager will review it.");
  if (waiting >= MAX_PENDING_REQUESTS) throw conflict(`You have ${waiting} requests waiting. Wait for a decision (or cancel one) before asking for more.`);

  return db.$transaction(async (tx) => {
    const request = await tx.poolLeadRequest.create({ data: { poolLeadId: id, requestedById: actor.id }, select: { id: true } });
    const [approver, agent] = await Promise.all([escalationUser(tx), tx.user.findUnique({ where: { id: actor.id }, select: { name: true } })]);
    const needs = [pool.leadType && pool.leadType.toLowerCase(), pool.purpose && `for ${pool.purpose.toLowerCase()}`, pool.interestedArea && `in ${pool.interestedArea}`].filter(Boolean).join(" ");
    await tx.task.create({
      data: {
        title: `Approve leads pool request — ${agent?.name} wants ${pool.fullName ?? "a pool lead"}`,
        description: `${agent?.name} asked for ${label(pool)}${needs ? ` (${needs})` : ""}. Approve or reject it in Leads pool.`,
        type: "LEAD_FOLLOW_UP", priority: "HIGH", dueDate: new Date(Date.now() + 4 * 3_600_000),
        assigneeId: approver?.id ?? null, createdById: actor.id, autoKey: `pool-request:${id}:${request.id}`,
        events: { create: { type: "CREATED", actorId: actor.id, message: "Created automatically from a leads pool request" } },
      },
    });
    await logActivity(tx, { action: "UPDATED", entityType: "POOL_LEAD", entityId: id, entityLabel: label(pool), description: `Asked for ${label(pool)} from the leads pool`, userId: actor.id });
    return { status: "PENDING" as const, leadId: null };
  });
}

/** The agent withdraws their own waiting request. */
export async function cancelPoolRequest(actor: Actor, requestId: string) {
  const request = await db.poolLeadRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true, requestedById: true, poolLeadId: true } });
  if (!request || request.requestedById !== actor.id) throw notFound("Request");
  if (request.status !== "PENDING") throw conflict("This request was already decided.");
  await db.$transaction(async (tx) => {
    await tx.poolLeadRequest.delete({ where: { id: request.id } });
    await tx.task.updateMany({ where: { autoKey: `pool-request:${request.poolLeadId}:${request.id}`, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "CANCELLED" } });
  });
}

export async function decidePoolRequest(actor: Actor, input: z.output<typeof poolDecisionSchema>) {
  assertManager(actor);
  const request = await db.poolLeadRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, status: true, poolLeadId: true, requestedById: true, requestedBy: { select: { name: true, isActive: true } }, poolLead: { select: { fullName: true, phone: true } } },
  });
  if (!request) throw notFound("Request");
  if (request.status !== "PENDING") throw conflict("This request was already decided.");

  if (input.approve) {
    if (!request.requestedBy.isActive) throw conflict(`${request.requestedBy.name}'s account is deactivated — reject the request or give the lead to someone else.`);
    return db.$transaction(async (tx) => {
      const { leadId } = await giveInTx(tx, actor, request.poolLeadId, request.requestedById);
      if (input.note) await tx.poolLeadRequest.update({ where: { id: request.id }, data: { decisionNote: input.note } });
      return { status: "APPROVED" as const, leadId };
    });
  }
  return db.$transaction(async (tx) => {
    await tx.poolLeadRequest.update({ where: { id: request.id }, data: { status: "REJECTED", decidedById: actor.id, decidedAt: new Date(), decisionNote: input.note } });
    await tx.task.updateMany({ where: { autoKey: `pool-request:${request.poolLeadId}:${request.id}`, status: { in: ["TODO", "IN_PROGRESS"] } }, data: { status: "COMPLETED", completedAt: new Date() } });
    await logActivity(tx, {
      action: "UPDATED", entityType: "POOL_LEAD", entityId: request.poolLeadId, entityLabel: label(request.poolLead), userId: actor.id,
      description: `Declined ${request.requestedBy.name}'s request for ${label(request.poolLead)}${input.note ? ` — ${input.note}` : ""}`,
    });
    return { status: "REJECTED" as const, leadId: null };
  });
}

/** A manager gives a pool lead straight to an agent (or to themselves), no request needed. */
export async function assignPoolLead(actor: Actor, input: z.output<typeof poolAssignSchema>) {
  assertManager(actor);
  await assertActiveUser(input.agentId);
  return db.$transaction((tx) => giveInTx(tx, actor, input.id, input.agentId));
}
