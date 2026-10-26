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
import type { poolAssignManySchema, poolBulkSchema, poolLeadSchema, updatePoolLeadSchema } from "@/schemas/leads-pool";
import { logActivity } from "./activity";
import { assertActiveUser } from "./access";
import { onLeadAssigned } from "./automation";
import { readPoolSheet, type PoolSheetRow } from "./pool-import";
import type { Tx } from "./types";

/**
 * The leads pool: contacts managers and admins collect (buyers, tenants with their needs, or
 * just a private owner's number) — typed in, pasted, or imported from an Excel / CSV file.
 * Agents browse it with the numbers masked and press "Get this lead": it becomes a normal lead
 * on their Leads page at once, with the full details. Managers can also tick entries and give
 * them to an agent. Masking happens here on the server — an agent's browser never receives a
 * pool number that isn't theirs.
 */

export const POOL_SORTS = ["createdAt", "fullName", "budgetMax"] as const;

/** Most entries given in one go (select up to a page of 100). */
export const MAX_ASSIGN = 100;

export interface PoolFilters {
  status?: PoolLeadStatus;
  leadType?: CustomerType;
  purpose?: ListingPurpose;
  /** Managers: only the entries of one import. */
  batch?: string;
}

function poolWhere(actor: Actor, q: string | undefined, f: PoolFilters): Prisma.PoolLeadWhereInput {
  const manager = isManager(actor);
  const digits = q ? digitsOnly(q) : "";
  return {
    AND: [
      // Agents only ever see what is still in the pool.
      manager ? (f.status ? { status: f.status } : {}) : { status: "AVAILABLE" },
      // Agents can't search by digits at all: matching them against the stored numbers, notes
      // or names would reveal hidden numbers bit by bit.
      q && !manager && /[0-9]{3}/.test(digits)
        ? { id: { in: [] } }
        : q
        ? {
            OR: [
              { fullName: like(q) },
              { interestedArea: like(q) },
              { notes: like(q) },
              ...(manager && digits.length >= 3 ? [{ phoneDigits: like(digits) }] : []),
              ...(manager ? [{ email: like(q) }, { batch: like(q) }] : []),
            ],
          }
        : {},
      f.leadType ? { leadType: f.leadType } : {},
      f.purpose ? { purpose: f.purpose } : {},
      manager && f.batch ? { batch: f.batch } : {},
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
  batch: true,
  createdAt: true,
  takenAt: true,
  leadId: true,
  createdBy: { select: { name: true } },
  takenBy: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.PoolLeadSelect;

type PoolRow = Prisma.PoolLeadGetPayload<{ select: typeof poolSelect }>;

export interface PoolListItem extends Omit<PoolRow, "phone" | "email" | "createdBy" | "takenBy" | "leadId" | "batch"> {
  /** The full number for managers; masked (+9745******7) for agents. */
  phone: string;
  email: string | null;
  masked: boolean;
  batch: string | null;
  createdBy: { name: string } | null;
  takenBy: { id: string; name: string; avatarUrl: string | null } | null;
  leadId: string | null;
}

/** What an agent may see of a pool entry. */
function forViewer(actor: Actor, row: PoolRow): PoolListItem {
  if (isManager(actor)) return { ...row, masked: false };
  return {
    ...row,
    phone: maskPhone(row.phone),
    email: row.email ? maskEmail(row.email) : null,
    // A number (or e-mail) typed into the name or the notes stays hidden too.
    fullName: row.fullName && maskPhonesIn(row.fullName),
    notes: row.notes && maskPhonesIn(row.notes.replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, (e) => maskEmail(e))),
    masked: true,
    batch: null,
    createdBy: null,
    takenBy: null,
    leadId: null,
  };
}

export async function listPool(actor: Actor, params: ListParams<(typeof POOL_SORTS)[number]>, filters: PoolFilters) {
  if (!isStaff(actor)) throw forbidden();
  const where = poolWhere(actor, params.q, filters);
  const [rows, total] = await Promise.all([
    db.poolLead.findMany({ where, orderBy: [{ [params.sort]: params.dir }, { createdAt: "desc" }], ...skipTake(params.page, params.pageSize), select: poolSelect }),
    db.poolLead.count({ where }),
  ]);
  return paginate(
    rows.map((row) => forViewer(actor, row)),
    total,
    params.page,
    params.pageSize,
  );
}

export async function poolCounts(actor: Actor) {
  const [available, taken] = await Promise.all([db.poolLead.count({ where: { status: "AVAILABLE" } }), isManager(actor) ? db.poolLead.count({ where: { status: "TAKEN" } }) : 0]);
  return { available, taken };
}

/** Managers: recent imports, for the "From file" filter. */
export async function poolBatches(actor: Actor) {
  if (!isManager(actor)) return [];
  const rows = await db.poolLead.groupBy({ by: ["batch"], where: { batch: { not: null }, status: "AVAILABLE" }, _count: { _all: true }, _max: { createdAt: true } });
  return rows
    .sort((a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0))
    .slice(0, 30)
    .map((r) => ({ batch: r.batch!, available: r._count._all }));
}

// ───────────────────────────── Adding ─────────────────────────────

function assertManager(actor: Actor) {
  if (!isManager(actor)) throw forbidden("Only managers and admins can manage the leads pool.");
}

/** Short label for logs — never the full number. */
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

type Skipped = { line: number; text: string; reason: string };

/** Adds many rows at once, skipping numbers already in the pool (or repeated in the batch). */
async function insertRows(actor: Actor, rows: PoolSheetRow[], skipped: Skipped[], batch: string, source: string) {
  if (rows.length > 5000) throw invalid("Import up to 5,000 numbers at a time — split the file.", { file: ["Too many rows"] });
  const existing = new Set(
    (await db.poolLead.findMany({ where: { status: "AVAILABLE", phoneDigits: { in: rows.map((r) => digitsOnly(r.phone)) } }, select: { phoneDigits: true } })).map((r) => r.phoneDigits),
  );
  const fresh: PoolSheetRow[] = [];
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
    await db.$transaction(
      async (tx) => {
        await tx.poolLead.createMany({ data: fresh.map(({ line: _line, ...r }) => ({ ...r, phoneDigits: digitsOnly(r.phone), batch, createdById: actor.id })) });
        await logActivity(tx, {
          action: "CREATED", entityType: "POOL_LEAD", entityId: "bulk", entityLabel: `${fresh.length} numbers`,
          description: `Added ${fresh.length} number${fresh.length === 1 ? "" : "s"} to the leads pool from ${source}`, userId: actor.id, meta: { count: fresh.length, batch },
        });
      },
      { timeout: 60_000 },
    );
  }
  skipped.sort((a, b) => a.line - b.line);
  return { added: fresh.length, skipped: skipped.slice(0, 200), skippedCount: skipped.length, batch };
}

const stamp = () => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Qatar" }).format(new Date());

/** Parses pasted lines: the first phone-like part of each line, the rest is the name. */
export function parsePoolLines(text: string) {
  const rows: { line: number; phone: string; fullName: string | null }[] = [];
  const skipped: Skipped[] = [];
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
    rows.push({ line: i + 1, phone, fullName: rest ? rest.slice(0, 120) : null });
  });
  return { rows, skipped };
}

export async function addPoolLeadsBulk(actor: Actor, input: z.output<typeof poolBulkSchema>) {
  assertManager(actor);
  const { rows, skipped } = parsePoolLines(input.lines);
  const full: PoolSheetRow[] = rows.map((r) => ({ ...r, email: null, leadType: input.leadType, purpose: input.purpose, interestedArea: null, budgetMin: null, budgetMax: null, bedrooms: null, notes: input.notes }));
  return insertRows(actor, full, skipped, `Pasted list · ${stamp()}`, "a pasted list");
}

/** Excel (.xlsx) or CSV: columns are recognised by their headings (see pool-import.ts). */
export async function importPoolFile(actor: Actor, file: File) {
  assertManager(actor);
  const { rows, skipped, columns } = await readPoolSheet(file);
  if (!rows.length && !skipped.length) throw invalid("The file has no rows.", { file: ["Empty file"] });
  const name = file.name.replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 60) || "spreadsheet";
  const result = await insertRows(actor, rows, skipped, `${name} · ${stamp()}`, name);
  return { ...result, columns };
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

/** Removes entries from the pool. A lead already created from one stays on the Leads page. */
export async function deletePoolLeads(actor: Actor, ids: string[]) {
  assertManager(actor);
  const rows = await db.poolLead.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, phone: true } });
  if (!rows.length) throw notFound("Pool lead");
  await db.$transaction(async (tx) => {
    await tx.poolLead.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    await logActivity(tx, {
      action: "DELETED", entityType: "POOL_LEAD", entityId: rows.length === 1 ? rows[0].id : "bulk", entityLabel: rows.length === 1 ? label(rows[0]) : `${rows.length} numbers`,
      description: rows.length === 1 ? `Removed ${label(rows[0])} from the leads pool` : `Removed ${rows.length} numbers from the leads pool`, userId: actor.id,
    });
  });
  return { removed: rows.length };
}

// ───────────────────────────── Giving out ─────────────────────────────

/**
 * Turns a pool entry into a lead for `agentId` (inside a transaction). The entry is claimed
 * with a conditional update, so two agents pressing at the same moment can't both get it.
 */
async function giveInTx(tx: Tx, actor: Actor, poolLeadId: string, agentId: string, agentName: string) {
  const pool = await tx.poolLead.findUnique({ where: { id: poolLeadId } });
  if (!pool || pool.status !== "AVAILABLE") return null;
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
  if (claimed.count !== 1) throw conflict("Someone else just took this lead.");
  await onLeadAssigned(tx, lead, actor.id);
  await logActivity(tx, {
    action: "CREATED", entityType: "LEAD", entityId: lead.id, entityLabel: lead.fullName, userId: actor.id, leadId: lead.id,
    description: agentId === actor.id ? `Took ${lead.fullName} from the leads pool` : `Gave ${lead.fullName} from the leads pool to ${agentName}`,
    meta: { poolLeadId: pool.id, agentId },
  });
  return lead.id;
}

/** "Get this lead": the entry becomes a lead of whoever pressed it, straight away. */
export async function takePoolLead(actor: Actor, id: string) {
  if (!isStaff(actor)) throw forbidden();
  const me = await db.user.findUniqueOrThrow({ where: { id: actor.id }, select: { name: true } });
  const leadId = await db.$transaction((tx) => giveInTx(tx, actor, id, actor.id, me.name));
  if (!leadId) throw conflict("This lead is no longer in the pool — someone else took it.");
  return { leadId };
}

/** Managers give one or many entries (ticked in the table) to an agent. */
export async function assignPoolLeads(actor: Actor, input: z.output<typeof poolAssignManySchema>) {
  assertManager(actor);
  await assertActiveUser(input.agentId);
  const agent = await db.user.findUniqueOrThrow({ where: { id: input.agentId }, select: { name: true } });
  const ids = [...new Set(input.ids)];
  const leadIds = await db.$transaction(
    async (tx) => {
      const out: string[] = [];
      for (const id of ids) {
        const leadId = await giveInTx(tx, actor, id, input.agentId, agent.name);
        if (leadId) out.push(leadId);
      }
      return out;
    },
    { timeout: 120_000 },
  );
  return { given: leadIds.length, skipped: ids.length - leadIds.length, agent: agent.name, leadIds };
}
