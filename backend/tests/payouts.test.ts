/**
 * Tests for website interest counting (views, calls, WhatsApp per listing) and agent
 * commission payouts (balance, vouchers, cancelling, who may see and do what).
 *   npm test   (uses a throwaway ./test.db, never the dev database)
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { toPublicError } from "@/lib/errors";
import { businessDate } from "@/lib/business-day";
import { interestByProperty, listingInterest, recordListingEvent } from "@/services/listing-stats";
import { agentStatement, commissionSummary, createPayout, getPayout, voidPayout } from "@/services/payouts";
import { listProperties } from "@/services/properties";
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

async function main() {
  const admin = await actorFor("admin@elite.qa");
  const manager = await actorFor("fatima@elite.qa");
  const omar = await actorFor("omar@elite.qa");
  const aisha = await actorFor("aisha@elite.qa");

  // ── Website interest ──
  const listing = await db.property.findFirstOrThrow({ where: { websitePublished: true, status: "AVAILABLE" }, select: { id: true, reference: true } });
  const hidden = await db.property.findFirst({ where: { websitePublished: false }, select: { reference: true } });
  check("a view is counted", await recordListingEvent(listing.reference, "view", "1.1.1.1"));
  check("the same visitor isn't counted twice", !(await recordListingEvent(listing.reference, "view", "1.1.1.1")));
  check("another visitor is counted", await recordListingEvent(listing.reference, "view", "2.2.2.2"));
  check("calls and WhatsApp are counted separately", (await recordListingEvent(listing.reference, "call", "1.1.1.1")) && (await recordListingEvent(listing.reference, "whatsapp", "1.1.1.1")));
  check("unknown listings are ignored", !(await recordListingEvent("ELT-0000", "view", "3.3.3.3")));
  if (hidden) check("hidden listings are ignored", !(await recordListingEvent(hidden.reference, "view", "4.4.4.4")));
  const today = await db.listingStat.findUniqueOrThrow({ where: { propertyId_day: { propertyId: listing.id, day: businessDate() } } });
  check("today's row has the counts", today.views === 2 && today.calls === 1 && today.whatsapps === 1, today);
  const old = new Date(Date.now() - 40 * 86_400_000);
  await recordListingEvent(listing.reference, "view", "5.5.5.5", old);
  const interest = await listingInterest(listing.id);
  check("last 30 days leaves out older days", interest.last30.views === 2 && interest.allTime.views === 3, interest);
  check("14-day series ends today", interest.days.length === 14 && interest.days[13].day === businessDate() && interest.days[13].views === 2);
  const byProperty = await interestByProperty([listing.id]);
  check("listings table gets the 30-day figures", byProperty.get(listing.id)?.calls === 1);
  const page = await listProperties(admin, { page: 1, pageSize: 100, sort: "updatedAt", dir: "desc", q: listing.reference }, {});
  check("properties list carries the figures", page.items.find((p) => p.id === listing.id)?.interest.views === 2);

  // ── Commission payouts ──
  // Give Omar two closed deals worth 1,000 + 600 in agent commission.
  const base = await db.deal.findFirstOrThrow({ select: { propertyId: true, type: true } });
  for (const [ref, share] of [["DL-T1", 1000], ["DL-T2", 600]] as const) {
    await db.deal.create({
      data: {
        reference: ref, type: base.type, status: "CLOSED", amount: 100000, commissionPercent: 2, commissionAmount: share * 2, agentSharePercent: 50,
        agentCommission: share, companyCommission: share, propertyId: base.propertyId, agentId: omar.id, closedAt: new Date(),
      },
    });
  }
  const before = (await agentStatement(omar, omar.id)).balance;
  check("an agent sees their own balance", before >= 1600);
  await rejects("agents can't see another agent's statement", () => agentStatement(omar, aisha.id), /permission|allowed|forbidden/i);
  check("managers see any agent", (await agentStatement(manager, omar.id)).agent.id === omar.id);
  check("agents only see themselves in the summary", (await commissionSummary(omar)).every((r) => r.id === omar.id));
  check("managers see the team", (await commissionSummary(manager)).some((r) => r.id === aisha.id));

  await rejects("agents can't pay", () => createPayout(omar, { agentId: omar.id, amount: 500, method: "CASH", note: null, paidAt: null }), /admins/i);
  await rejects("managers can't pay", () => createPayout(manager, { agentId: omar.id, amount: 500, method: "CASH", note: null, paidAt: null }), /admins/i);
  await rejects("can't pay more than the balance", () => createPayout(admin, { agentId: omar.id, amount: before + 1, method: "CASH", note: null, paidAt: null }), /balance/i);
  await rejects("can't date a payment in the future", () => createPayout(admin, { agentId: omar.id, amount: 1, method: "CASH", note: null, paidAt: new Date(Date.now() + 86_400_000) }), /future/i);

  const pv = await createPayout(admin, { agentId: omar.id, amount: 500, method: "BANK_TRANSFER", note: "October", paidAt: null });
  check("the voucher gets a PV reference", /^PV-\d{4}$/.test(pv.reference), pv.reference);
  const voucher = await getPayout(omar, pv.id);
  check("the voucher keeps the balance before and after", voucher?.balanceBefore === before && voucher.balanceAfter === before - 500 && voucher.amount === 500);
  const after = await agentStatement(omar, omar.id);
  check("500 comes off the balance", after.balance === before - 500 && after.paid >= 500);
  check("the payment is in the agent's transactions", after.entries[0].kind === "PAYOUT" && after.entries[0].reference === pv.reference && after.entries[0].balance === before - 500);
  check("closed deals are listed as earnings", after.entries.some((e) => e.kind === "EARNED" && e.reference === "DL-T1" && e.amount === 1000));
  check("other agents can't open the voucher", await getPayout(aisha, pv.id).then(() => false, () => true));
  check("managers can open it", Boolean(await getPayout(manager, pv.id)));
  const second = await createPayout(admin, { agentId: omar.id, amount: before - 500, method: "CASH", note: null, paidAt: null });
  check("vouchers are numbered in order", Number(second.reference.slice(3)) === Number(pv.reference.slice(3)) + 1);
  await rejects("nothing left to pay", () => createPayout(admin, { agentId: omar.id, amount: 1, method: "CASH", note: null, paidAt: null }), /nothing left/i);

  await rejects("agents can't cancel vouchers", () => voidPayout(omar, { id: pv.id, reason: "Paid twice" }), /admins/i);
  await voidPayout(admin, { id: pv.id, reason: "Entered twice by mistake" });
  const restored = await agentStatement(omar, omar.id);
  check("cancelling puts the amount back", restored.balance === 500);
  check("the cancelled voucher stays in the history", restored.entries.some((e) => e.kind === "PAYOUT" && e.id === pv.id && e.voided && e.voidReason === "Entered twice by mistake"));
  await rejects("a voucher can't be cancelled twice", () => voidPayout(admin, { id: pv.id, reason: "Again please" }), /already/i);
  check("payouts are in the activity log", (await db.activity.count({ where: { entityType: "PAYOUT" } })) >= 3);

  console.log(`payout & interest tests: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
