import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { forbidden, invalid, notFound } from "@/lib/errors";
import { atLocalHour, businessDate, shiftDate } from "@/lib/business-day";
import { formatZoned } from "@/lib/format";
import { hasPermission, isStaff, type Actor } from "@/lib/permissions";
import type { availabilitySchema } from "@/schemas/availability";
import { assertActiveUser } from "./access";
import { logActivity } from "./activity";

/**
 * "Free for viewings": blocks of time agents mark on the calendar. Visitors on the website can
 * only book a viewing that fits inside the listing agent's blocks (and doesn't clash with a
 * viewing already booked). Agents manage their own blocks; managers manage anyone's.
 */

const canManageOthers = (actor: Actor) => hasPermission(actor, "tasks.assign");

/** Shortest block that can hold one viewing. */
export const MIN_BLOCK_MINUTES = 45;

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const at = (date: string, minutes: number) => atLocalHour(date, Math.floor(minutes / 60), minutes % 60);

export async function addAvailability(actor: Actor, input: z.output<typeof availabilitySchema>) {
  if (!isStaff(actor)) throw forbidden();
  const agentId = input.agentId ?? actor.id;
  if (agentId !== actor.id && !canManageOthers(actor)) throw forbidden("You can only set your own free time.");
  await assertActiveUser(agentId);
  const from = toMinutes(input.from);
  const to = toMinutes(input.to);
  if (to - from < MIN_BLOCK_MINUTES) throw invalid(`Make it at least ${MIN_BLOCK_MINUTES} minutes (one viewing).`, { to: ["Too short"] });
  if (input.date < businessDate()) throw invalid("Choose today or a later day.", { date: ["In the past"] });

  const blocks = Array.from({ length: input.repeatWeeks + 1 }, (_, week) => {
    const date = shiftDate(input.date, week * 7);
    return { startsAt: at(date, from), endsAt: at(date, to) };
  }).filter((b) => b.endsAt.getTime() > Date.now());
  if (!blocks.length) throw invalid("That time has already passed today.", { to: ["Already passed"] });

  // Blocks that overlap free time already marked are skipped (the existing one stays).
  const existing = await db.viewingAvailability.findMany({
    where: { agentId, startsAt: { lt: blocks[blocks.length - 1].endsAt }, endsAt: { gt: blocks[0].startsAt } },
    select: { startsAt: true, endsAt: true },
  });
  const fresh = blocks.filter((b) => !existing.some((e) => e.startsAt < b.endsAt && e.endsAt > b.startsAt));
  if (!fresh.length) throw invalid("Those hours are already marked as free.", { from: ["Already free"] });

  const agent = await db.user.findUniqueOrThrow({ where: { id: agentId }, select: { name: true } });
  await db.$transaction(async (tx) => {
    await tx.viewingAvailability.createMany({ data: fresh.map((b) => ({ ...b, agentId, createdById: actor.id })) });
    await logActivity(tx, {
      action: "UPDATED", entityType: "USER", entityId: agentId, entityLabel: agent.name, userId: actor.id,
      description: `Marked ${agent.name} free for viewings ${formatZoned(fresh[0].startsAt, "EEE d MMM")} ${input.from}–${input.to}${fresh.length > 1 ? ` (${fresh.length} weeks)` : ""}`,
    });
  });
  return { added: fresh.length, skipped: blocks.length - fresh.length };
}

export async function removeAvailability(actor: Actor, id: string) {
  const block = await db.viewingAvailability.findUnique({ where: { id }, select: { id: true, agentId: true } });
  if (!block) throw notFound("Free time");
  if (block.agentId !== actor.id && !canManageOthers(actor)) throw forbidden("You can only change your own free time.");
  await db.viewingAvailability.delete({ where: { id } });
}

/** Blocks between two instants, for the calendar (agents see their own; managers everyone's or one agent's). */
export async function availabilityBetween(actor: Actor, start: Date, end: Date, agentId?: string) {
  if (!isStaff(actor)) return [];
  const who = canManageOthers(actor) ? (agentId ? { agentId } : {}) : { agentId: actor.id };
  return db.viewingAvailability.findMany({
    where: { ...who, startsAt: { lt: end }, endsAt: { gt: start } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true, agentId: true, agent: { select: { name: true } } },
  });
}

export type AvailabilityBlock = Awaited<ReturnType<typeof availabilityBetween>>[number];

/** An agent's blocks overlapping [start, end) — used for the website's bookable times. */
export function agentBlocks(agentId: string, start: Date, end: Date) {
  return db.viewingAvailability.findMany({ where: { agentId, startsAt: { lt: end }, endsAt: { gt: start } }, orderBy: { startsAt: "asc" }, select: { startsAt: true, endsAt: true } });
}
