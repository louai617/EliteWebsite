"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { cancelReservationAction, confirmReservationAction } from "@/actions/reservations";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/shared/confirm-button";
import { ReasonDialog } from "@/components/shared/reason-dialog";

export function ReservationActions({ id, reference, status, amount, client, canCancelConfirmed }: { id: string; reference: string; status: string; amount: string; client: string; canCancelConfirmed: boolean }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const cancel = useAction(cancelReservationAction);
  const open = status === "AWAITING_PAYMENT" || status === "PAYMENT_SUBMITTED";
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {open && (
        <ConfirmAction
          title={`Confirm payment for ${reference}?`}
          description={`Only confirm once ${amount} from ${client} is in the company account. The home is marked Reserved and the client is e-mailed.`}
          confirmLabel="Payment received"
          destructive={false}
          action={confirmReservationAction}
          input={{ id }}
          onDone={() => router.refresh()}
        >
          <Button size="sm" variant={status === "PAYMENT_SUBMITTED" ? "default" : "outline"}>
            <CheckCircle2 /> Confirm payment
          </Button>
        </ConfirmAction>
      )}
      {(open || (status === "CONFIRMED" && canCancelConfirmed)) && (
        <Button size="sm" variant="ghost" onClick={() => setCancelling(true)}>
          <XCircle /> Cancel
        </Button>
      )}
      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${reference}?`}
        description="The client is e-mailed. If the home was reserved for them, it becomes available again."
        confirmLabel="Cancel reservation"
        destructive
        suggestions={["Payment not received", "Client changed their mind", "Home no longer available"]}
        onSubmit={async (reason) => {
          const r = await cancel.run({ id, reason });
          if (r?.ok) router.refresh();
          return Boolean(r?.ok);
        }}
      />
    </div>
  );
}
