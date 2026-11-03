import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { PAYOUT_METHOD_META } from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { agentStatement, canPay } from "@/services/payouts";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { PayAgentButton, VoidVoucherButton } from "@/components/payouts/pay-agent";

export const metadata: Metadata = { title: "Commission statement" };

export default async function AgentStatementPage({ params }: PageProps<"/commissions/[agentId]">) {
  const user = await requireUser();
  const { agentId } = await params;
  const s = await agentStatement(user, agentId);
  const payer = canPay(user);
  const team = hasPermission(user, "reports.viewTeam");

  return (
    <>
      <PageHeader
        title={s.agent.id === user.id ? "My commission" : `${s.agent.name} — commission`}
        description="Your share of each closed deal comes in; each payment voucher goes out."
        breadcrumbs={team ? [{ label: "Commissions", href: "/commissions" }, { label: s.agent.name }] : undefined}
        actions={payer ? <PayAgentButton agents={[{ id: s.agent.id, name: s.agent.name, balance: s.balance }]} agentId={s.agent.id} /> : undefined}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Earned (closed deals)" value={formatMoney(s.earned)} />
        <StatCard label="Paid to date" value={formatMoney(s.paid)} />
        <StatCard label="Balance owed" value={formatMoney(s.balance)} />
      </div>
      {s.entries.length === 0 ? (
        <EmptyState title="No transactions yet" description="Closed deals and payment vouchers appear here." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Transaction</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.entries.map((e) => (
                <TableRow key={`${e.kind}-${e.id}`} className={e.kind === "PAYOUT" && e.voided ? "text-muted-foreground" : undefined}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(e.date)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {e.kind === "EARNED" ? (
                      <Link href={`/deals/${e.dealId}`} className="font-medium hover:underline">
                        Deal closed · {e.reference}
                      </Link>
                    ) : (
                      <Link href={`/vouchers/${e.id}`} className={`font-medium hover:underline ${e.voided ? "line-through" : ""}`}>
                        Payment · {e.reference}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[340px] text-xs text-muted-foreground">
                    {e.kind === "EARNED" ? (
                      e.detail
                    ) : (
                      <>
                        {PAYOUT_METHOD_META[e.method].label}
                        {e.by ? ` · by ${e.by}` : ""}
                        {e.detail ? ` · ${e.detail}` : ""}
                        {e.voided && <span className="block text-rose-700">Cancelled — {e.voidReason}</span>}
                      </>
                    )}
                  </TableCell>
                  <TableCell className={`tabular text-right whitespace-nowrap ${e.kind === "EARNED" ? "text-emerald-700" : e.voided ? "line-through" : ""}`}>
                    {e.kind === "EARNED" ? "+" : "−"}
                    {formatMoney(e.amount)}
                  </TableCell>
                  <TableCell className="tabular text-right whitespace-nowrap">{formatMoney(e.balance)}</TableCell>
                  <TableCell className="text-right">
                    {e.kind === "PAYOUT" && (
                      <div className="flex justify-end gap-1">
                        <Link href={`/vouchers/${e.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <FileText className="size-3.5" /> Voucher
                        </Link>
                        {payer && !e.voided && <VoidVoucherButton id={e.id} reference={e.reference} />}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
