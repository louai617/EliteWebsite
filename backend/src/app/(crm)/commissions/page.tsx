import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatDate, formatMoney } from "@/lib/format";
import { canPay, commissionSummary } from "@/services/payouts";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AgentCell } from "@/components/shared/user-avatar";
import { PayAgentButton } from "@/components/payouts/pay-agent";

export const metadata: Metadata = { title: "Commissions" };

export default async function CommissionsPage() {
  const user = await requireUser();
  // Agents go straight to their own statement.
  if (!hasPermission(user, "reports.viewTeam")) redirect(`/commissions/${user.id}`);
  const rows = await commissionSummary(user);
  const payer = canPay(user);
  const total = rows.reduce((t, r) => ({ earned: t.earned + r.earned, paid: t.paid + r.paid, balance: t.balance + r.balance }), { earned: 0, paid: 0, balance: 0 });
  const payable = rows.map((r) => ({ id: r.id, name: r.name, balance: r.balance }));

  return (
    <>
      <PageHeader
        title="Commissions"
        description="Each agent's share of closed deals, what has been paid out (vouchers) and what is still owed."
        actions={payer ? <PayAgentButton agents={payable} /> : undefined}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Earned by agents" value={formatMoney(total.earned)} />
        <StatCard label="Paid out" value={formatMoney(total.paid)} />
        <StatCard label="Still owed" value={formatMoney(total.balance)} />
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Closed deals</TableHead>
              <TableHead className="text-right">Earned</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Last payment</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/commissions/${r.id}`} className="hover:underline">
                    <AgentCell agent={r} />
                  </Link>
                  {!r.isActive && <span className="ml-8 text-[11px] text-muted-foreground">Deactivated</span>}
                </TableCell>
                <TableCell className="tabular text-right">{r.deals}</TableCell>
                <TableCell className="tabular text-right">{formatMoney(r.earned)}</TableCell>
                <TableCell className="tabular text-right">{formatMoney(r.paid)}</TableCell>
                <TableCell className={`tabular text-right font-medium ${r.balance > 0 ? "text-amber-700" : ""}`}>{formatMoney(r.balance)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.lastPaidAt ? formatDate(r.lastPaidAt) : "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={`/commissions/${r.id}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                      Statement
                    </Link>
                    {payer && r.balance > 0 && <PayAgentButton agents={payable} agentId={r.id} label="Pay" size="xs" variant="outline" />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
