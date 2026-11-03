import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { isManager } from "@/lib/permissions";
import { DOCUMENT_KIND_META, PAYMENT_METHOD_META, RESERVATION_STATUS_META } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/format";
import { listReservations, RESERVATION_FILTERS } from "@/services/reservations";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EnumBadge } from "@/components/shared/enum-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect, SearchInput, Toolbar } from "@/components/shared/data-table/toolbar";
import { AgentCell } from "@/components/shared/user-avatar";
import { ReservationActions } from "@/components/reservations/reservation-actions";

export const metadata: Metadata = { title: "Reservations" };

export default async function ReservationsPage({ searchParams }: PageProps<"/reservations">) {
  const user = await requireUser();
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "";
  const filter = (RESERVATION_FILTERS as readonly string[]).includes(raw) ? (raw as (typeof RESERVATION_FILTERS)[number]) : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : undefined;
  const rows = await listReservations(user, filter, q);
  const toVerify = rows.filter((r) => r.status === "PAYMENT_SUBMITTED").length;

  return (
    <>
      <PageHeader
        title="Reservations"
        description={`Homes reserved on the website with a booking deposit (Fawran / bank transfer).${toVerify ? ` ${toVerify} payment${toVerify === 1 ? "" : "s"} to verify.` : ""}`}
      />
      <Toolbar>
        <SearchInput placeholder="Search reference, client, property…" />
        <FilterSelect
          param="status"
          label="Status"
          options={[
            { value: "open", label: "Open (awaiting / to verify)" },
            ...RESERVATION_FILTERS.filter((f) => f !== "open").map((f) => ({ value: f, label: RESERVATION_STATUS_META[f].label })),
          ]}
        />
      </Toolbar>
      {rows.length === 0 ? (
        <EmptyState title="No reservations" description="When a client reserves a home on the website, it appears here with their payment proof." />
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reservation</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Deposit</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={r.status === "PAYMENT_SUBMITTED" ? "bg-sky-50/50" : undefined}>
                  <TableCell>
                    <p className="font-mono text-xs font-medium">{r.reference}</p>
                    <EnumBadge meta={RESERVATION_STATUS_META} value={r.status} dot />
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                  </TableCell>
                  <TableCell>
                    {r.client ? (
                      <Link href={`/clients/${r.client.id}`} className="text-[13px] hover:underline">
                        {r.client.fullName}
                      </Link>
                    ) : r.lead ? (
                      <Link href={`/leads/${r.lead.id}`} className="text-[13px] hover:underline">
                        {r.contactName ?? r.lead.fullName}
                      </Link>
                    ) : (
                      <p className="text-[13px]">{r.contactName ?? "Website visitor"}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{r.contactPhone ?? r.client?.phone ?? r.lead?.phone}</p>
                    {r.contactEmail && <p className="text-xs text-muted-foreground">{r.contactEmail}</p>}
                  </TableCell>
                  <TableCell>
                    <Link href={`/properties/${r.property.id}`} className="block max-w-[220px] hover:underline">
                      <span className="line-clamp-1 text-[13px]">{r.property.title}</span>
                      <span className="text-xs text-muted-foreground">{r.property.reference}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="tabular text-right whitespace-nowrap">{formatMoney(r.amount, r.currency)}</TableCell>
                  <TableCell className="max-w-[260px] text-xs">
                    <p>{PAYMENT_METHOD_META[r.method].label}</p>
                    {r.status === "AWAITING_PAYMENT" && <p className="text-amber-700">Pay by {formatDateTime(r.payBy)}</p>}
                    {(r.payerName || r.paymentReference) && (
                      <p className="text-muted-foreground">
                        {r.payerName}
                        {r.paymentReference ? ` · ref ${r.paymentReference}` : ""}
                      </p>
                    )}
                    {r.documents.map((d) => (
                      <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-sky-700 hover:underline">
                        <FileText className="size-3" /> {DOCUMENT_KIND_META[d.kind].label}
                      </a>
                    ))}
                    {r.verifiedBy && <p className="text-emerald-700">Verified by {r.verifiedBy.name}</p>}
                    {r.cancelReason && <p className="text-rose-700">{r.cancelReason}</p>}
                  </TableCell>
                  <TableCell>
                    <AgentCell agent={r.agent} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ReservationActions
                      id={r.id}
                      reference={r.reference}
                      status={r.status}
                      amount={formatMoney(r.amount, r.currency)}
                      client={r.contactName ?? r.client?.fullName ?? r.lead?.fullName ?? "the visitor"}
                      canCancelConfirmed={isManager(user)}
                    />
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
