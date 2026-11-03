import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { numberToWords } from "@/lib/contract-format";
import { PAYOUT_METHOD_META } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getPayout } from "@/services/payouts";
import { COMPANY } from "@/services/email-templates";
import { PrintButton } from "@/components/contracts/print-button";

export const metadata: Metadata = { title: "Payment voucher" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[170px_1fr] gap-4 border-b border-neutral-200 py-2.5 text-[13px]">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

/** A payment voucher (PV-…), printable or savable as PDF from the browser. */
export default async function VoucherPage({ params }: PageProps<"/vouchers/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const v = await getPayout(user, id);
  if (!v) notFound();

  return (
    <>
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-3">
          <Link href={`/commissions/${v.agentId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {v.agent.name} — commission
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">Print, or choose “Save as PDF” in the print window.</span>
            <PrintButton />
          </div>
        </div>
      </div>

      <article className="relative mx-auto my-8 max-w-[210mm] bg-white px-[18mm] py-[16mm] shadow-sm print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {v.voidedAt && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="-rotate-12 rounded-lg border-4 border-rose-600/60 px-6 py-2 text-5xl font-black tracking-widest text-rose-600/60">CANCELLED</span>
          </div>
        )}
        <header className="mb-8 flex items-end justify-between border-b-2 border-[#b98f42] pb-4">
          <Image src="/email-logo.png" alt="ELITE Real Estate" width={200} height={51} priority />
          <div className="text-right text-[11px] leading-4 text-neutral-500">
            <p>{COMPANY.address}</p>
            <p>{COMPANY.phone}</p>
          </div>
        </header>

        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Payment voucher</h1>
            <p className="mt-1 text-sm text-neutral-500">Commission payment to agent</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold text-neutral-900">{v.reference}</p>
            <p className="text-sm text-neutral-500">{formatDate(v.paidAt)}</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border-2 border-[#b98f42]/40 bg-[#b98f42]/5 px-6 py-5 text-center">
          <p className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">Amount paid</p>
          <p className="tabular mt-1 text-3xl font-semibold text-neutral-900">{formatMoney(v.amount)}</p>
          <p className="mt-1 text-sm text-neutral-600">{numberToWords(v.amount)} Qatari Riyals only</p>
        </div>

        <dl className="mb-10">
          <Row label="Paid to">
            {v.agent.name}
            <span className="block text-xs font-normal text-neutral-500">{[v.agent.email, v.agent.phone].filter(Boolean).join(" · ")}</span>
          </Row>
          <Row label="Paid by">{PAYOUT_METHOD_META[v.method].label}</Row>
          <Row label="For">Agent&apos;s share of commission on closed deals</Row>
          {v.note && <Row label="Note">{v.note}</Row>}
          <Row label="Balance before">{formatMoney(v.balanceBefore)}</Row>
          <Row label="Balance after">{formatMoney(v.balanceAfter)}</Row>
          <Row label="Issued by">
            {v.createdBy?.name ?? "—"}
            <span className="block text-xs font-normal text-neutral-500">{formatDateTime(v.createdAt)}</span>
          </Row>
          {v.voidedAt && (
            <Row label="Cancelled">
              {formatDateTime(v.voidedAt)}
              {v.voidedBy ? ` by ${v.voidedBy.name}` : ""} — {v.voidReason}
            </Row>
          )}
        </dl>

        <div className="grid grid-cols-2 gap-16 pt-8 text-[12px] text-neutral-600">
          <div>
            <div className="h-14 border-b border-neutral-400" />
            <p className="mt-1.5">Paid by — ELITE Real Estate</p>
          </div>
          <div>
            <div className="h-14 border-b border-neutral-400" />
            <p className="mt-1.5">Received by — {v.agent.name}</p>
          </div>
        </div>

        <footer className="mt-12 border-t pt-3 text-[10px] text-neutral-400">
          {v.reference} · Generated by the ELITE Real Estate agent app. The amount was taken off the agent&apos;s commission balance.
        </footer>
      </article>
    </>
  );
}
