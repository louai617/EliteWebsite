"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, RotateCcw, XCircle } from "lucide-react";
import { deleteDealAction, setDealStatusAction } from "@/actions/deals";
import { useAction } from "@/hooks/use-action";
import type { AgentOption, Viewer } from "@/types/options";
import type { DealStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/shared/confirm-button";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { ReasonDialog } from "@/components/shared/reason-dialog";
import { DealSheet, type CommissionDefaults, type DealRecord } from "./deal-form";

/**
 * Pending contract → Closed (the lead becomes a client) or Cancelled (with a reason).
 * Only managers change a deal's status; agents generate the contract.
 */
export function DealHeaderActions({ deal, defaults, agents, viewer }: { deal: DealRecord & { status: DealStatus }; defaults: CommissionDefaults; agents: AgentOption[]; viewer: Viewer }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const status = useAction(setDealStatusAction, { onSuccess: () => router.refresh() });
  const party = deal.client?.fullName ?? deal.lead?.fullName ?? "the client";

  return (
    <>
      {viewer.isManager && deal.status === "PENDING_CONTRACT" && (
        <>
          <ConfirmAction
            title={`Close ${deal.reference}?`}
            description={
              deal.client
                ? `The property is marked ${deal.type === "RENTAL" ? "Rented" : "Sold"} and the commission counts as earned.`
                : `${party} becomes a client (with their documents), the property is marked ${deal.type === "RENTAL" ? "Rented" : "Sold"} and the commission counts as earned. You'll get a task to add the client's QID / passport.`
            }
            confirmLabel="Close deal"
            destructive={false}
            action={setDealStatusAction}
            input={{ id: deal.id, status: "CLOSED", reason: null }}
            onDone={() => router.refresh()}
          >
            <Button>
              <CheckCircle2 /> Close deal
            </Button>
          </ConfirmAction>
          <Button variant="outline" onClick={() => setCancelling(true)}>
            <XCircle /> Cancel deal
          </Button>
        </>
      )}
      {viewer.isManager && deal.status !== "PENDING_CONTRACT" && (
        <Button variant="outline" loading={status.pending} onClick={() => void status.run({ id: deal.id, status: "PENDING_CONTRACT", reason: null })}>
          <RotateCcw /> Reopen
        </Button>
      )}
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil /> Edit
      </Button>
      {viewer.isManager && (
        <DeleteRecordButton action={deleteDealAction} id={deal.id} redirectTo="/deals" title={`Delete ${deal.reference}?`} description="The deal and its notes are removed from reports. Cancel it instead to keep a record (deals with generated contracts can't be deleted)." />
      )}
      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${deal.reference}?`}
        description={`The listing is released and ${party}'s lead is marked Lost with this reason.`}
        label="Why was the deal cancelled?"
        placeholder="e.g. Buyer's financing was refused"
        confirmLabel="Cancel deal"
        destructive
        suggestions={["Client withdrew", "Financing refused", "Owner withdrew", "Documents incomplete"]}
        onSubmit={async (reason) => Boolean((await status.run({ id: deal.id, status: "CANCELLED", reason }))?.ok)}
      />
      <DealSheet open={editing} onOpenChange={setEditing} deal={deal} defaults={defaults} agents={agents} viewer={viewer} />
    </>
  );
}
