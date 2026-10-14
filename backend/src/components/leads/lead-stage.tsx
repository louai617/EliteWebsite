"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronDown, Circle, Clock, ShieldAlert, ThumbsDown, Trophy, XCircle } from "lucide-react";
import type { LeadStatus } from "@/generated/prisma/enums";
import { decideViewingPassAction, markLeadLostAction, markLeadWonAction, requestViewingPassAction, setLeadStatusAction } from "@/actions/leads";
import { useAction } from "@/hooks/use-action";
import { LEAD_PIPELINE, LEAD_STATUS_META, LOST_REASONS, PASS_STATUS_META } from "@/lib/constants";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ReasonDialog } from "@/components/shared/reason-dialog";
import { EntityCombobox } from "@/components/shared/form/entity-combobox";
import { AttachButton } from "@/components/documents/documents-panel";

export interface StageInfo {
  lead: { id: string; fullName: string; status: LeadStatus; lostReason: string | null };
  gate: {
    viewingForm: boolean;
    passed: boolean;
    pass: { id: string; status: "PENDING" | "APPROVED" | "REJECTED"; reason: string; createdAt: Date | string; decisionNote: string | null; requestedBy: { name: string } | null; decidedBy: { name: string } | null } | null;
  };
  missingWonDocuments: ("BOOKING_FORM" | "PROOF_OF_PAYMENT")[];
  properties: { id: string; reference: string; title: string; price: number; purpose: "RENT" | "SALE" }[];
  isManager: boolean;
}

/** Stages moved through the menu; Won and Lost open their own dialogs. */
const MENU_STAGES = LEAD_PIPELINE.filter((s) => s !== "WON" && s !== "LOST");

function Requirement({ done, label, children }: { done: boolean; label: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      {done ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4 text-muted-foreground" />}
      <span className={cn("text-sm", done ? "text-foreground" : "text-muted-foreground")}>{label}</span>
      {!done && <span className="ml-auto">{children}</span>}
    </li>
  );
}

function WonDialog({ open, onOpenChange, info }: { open: boolean; onOpenChange: (o: boolean) => void; info: StageInfo }) {
  const router = useRouter();
  const first = info.properties[0];
  const [propertyId, setPropertyId] = useState<string | null>(first?.id ?? null);
  const [amount, setAmount] = useState(first ? String(first.purpose === "SALE" ? first.price : first.price * 12) : "");
  const [notes, setNotes] = useState("");
  const won = useAction(markLeadWonAction, {
    onSuccess: (r) => {
      onOpenChange(false);
      router.push(`/deals/${r.dealId}`);
    },
  });
  const docsReady = info.missingWonDocuments.length === 0;
  const ready = info.gate.passed && docsReady && propertyId && Number(amount.replace(/[, ]/g, "")) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !won.pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark {info.lead.fullName} as won</DialogTitle>
          <DialogDescription>Won means booked: the deal opens as “Pending contract” and the property is reserved.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-md border px-3">
          <Requirement done={info.gate.passed} label={info.gate.viewingForm ? "Viewing form attached" : info.gate.pass?.status === "APPROVED" ? "Viewing pass approved" : "Viewing form or approved pass"}>
            <AttachButton target="lead" targetId={info.lead.id} kind="VIEWING_FORM" label="Attach viewing form" />
          </Requirement>
          <Requirement done={!info.missingWonDocuments.includes("BOOKING_FORM")} label="Booking form">
            <AttachButton target="lead" targetId={info.lead.id} kind="BOOKING_FORM" label="Attach" />
          </Requirement>
          <Requirement done={!info.missingWonDocuments.includes("PROOF_OF_PAYMENT")} label="Proof of payment">
            <AttachButton target="lead" targetId={info.lead.id} kind="PROOF_OF_PAYMENT" label="Attach" />
          </Requirement>
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Property booked *</Label>
            <EntityCombobox
              kind="property"
              value={propertyId}
              initialOption={first ? { id: first.id, label: `${first.reference} · ${first.title}` } : null}
              onChange={(id) => {
                setPropertyId(id);
                const p = info.properties.find((x) => x.id === id);
                if (p) setAmount(String(p.purpose === "SALE" ? p.price : p.price * 12));
              }}
              placeholder="Search properties…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="won-amount">Agreed amount (QAR) *</Label>
            <Input id="won-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9,]/g, ""))} />
            <p className="text-xs text-muted-foreground">Sale price, or the total contract value for a rental (e.g. 12 × monthly rent). {amount && `= ${formatMoney(Number(amount.replace(/,/g, "")))}`}</p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="won-notes">Notes</Label>
            <Textarea id="won-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={won.pending}>
            Cancel
          </Button>
          <Button
            loading={won.pending}
            disabled={!ready}
            onClick={() => void won.run({ id: info.lead.id, propertyId: propertyId ?? "", amount: Number(amount.replace(/[, ]/g, "")), notes: notes || null })}
          >
            <Trophy /> Mark as won
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Header controls: stage menu + Won / Lost. `?stage=won|lost` opens the dialog (used by the board). */
export function LeadStageControls({ info }: { info: StageInfo }) {
  const router = useRouter();
  const params = useSearchParams();
  // ?stage=won|lost|gate (from the board) opens the matching dialog on arrival.
  const initial = params.get("stage");
  const [wonOpen, setWonOpen] = useState(initial === "won" && info.lead.status !== "WON");
  const [lostOpen, setLostOpen] = useState(initial === "lost" && info.lead.status !== "LOST");
  const [gateOpen, setGateOpen] = useState(initial === "gate");
  const status = useAction(setLeadStatusAction, { silent: true });
  const lost = useAction(markLeadLostAction);
  const closed = info.lead.status === "WON" || info.lead.status === "LOST";

  const move = async (to: LeadStatus) => {
    const result = await status.run({ id: info.lead.id, status: to });
    if (result?.ok) router.refresh();
    else if (result?.fieldErrors?.gate?.[0] === "viewing") setGateOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" loading={status.pending}>
            {LEAD_STATUS_META[info.lead.status].label} <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={info.lead.status} onValueChange={(v) => void move(v as LeadStatus)}>
            {MENU_STAGES.map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                {LEAD_STATUS_META[s].label}
                {s === "NEGOTIATION" && !info.gate.passed && <ShieldAlert className="ml-auto size-3.5 text-amber-600" />}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={info.lead.status === "WON"} onSelect={() => setWonOpen(true)}>
            <Trophy /> Won…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={info.lead.status === "LOST"} onSelect={() => setLostOpen(true)}>
            <ThumbsDown /> Lost…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {!closed && (
        <Button onClick={() => setWonOpen(true)}>
          <Trophy /> Mark as won
        </Button>
      )}
      <WonDialog open={wonOpen} onOpenChange={setWonOpen} info={info} />
      <ReasonDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        title={`Mark ${info.lead.fullName} as lost?`}
        description="Open follow-up tasks for this lead are cancelled. The reason is kept on the lead and in reports."
        label="Why was the lead lost?"
        placeholder="Add details, e.g. found a cheaper villa in Al Waab"
        confirmLabel="Mark as lost"
        destructive
        suggestions={LOST_REASONS}
        onSubmit={async (reason) => {
          const r = await lost.run({ id: info.lead.id, reason });
          if (r?.ok) router.refresh();
          return Boolean(r?.ok);
        }}
      />
      <ViewingGateDialog open={gateOpen} onOpenChange={setGateOpen} info={info} />
    </>
  );
}

/** Shown when a lead can't pass the viewing stage yet. */
function ViewingGateDialog({ open, onOpenChange, info }: { open: boolean; onOpenChange: (o: boolean) => void; info: StageInfo }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Dialog open={open && !asking} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach the viewing form first</DialogTitle>
            <DialogDescription>To move {info.lead.fullName} past the viewing stage, attach the signed property viewing form (PDF or photo), or request a pass with a reason.</DialogDescription>
          </DialogHeader>
          {info.gate.pass?.status === "PENDING" && (
            <p className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <Clock className="size-4" /> A pass request is waiting for a manager.
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <AttachButton target="lead" targetId={info.lead.id} kind="VIEWING_FORM" variant="default" label="Attach viewing form" onDone={() => onOpenChange(false)} />
            <Button variant="outline" disabled={info.gate.pass?.status === "PENDING"} onClick={() => setAsking(true)}>
              Request a pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PassRequestDialog
        open={asking}
        onOpenChange={(o) => {
          setAsking(o);
          if (!o) onOpenChange(false);
        }}
        info={info}
      />
    </>
  );
}

function PassRequestDialog({ open, onOpenChange, info }: { open: boolean; onOpenChange: (o: boolean) => void; info: StageInfo }) {
  const router = useRouter();
  const request = useAction(requestViewingPassAction);
  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request a viewing pass"
      description={info.isManager ? "As a manager, your pass is approved straight away and recorded on the lead." : "A manager reviews the request. Once approved you can move the lead forward."}
      label="Why is there no viewing form?"
      placeholder="e.g. The client viewed the unit with the owner directly and signed the booking form the same day."
      minLength={10}
      confirmLabel={info.isManager ? "Pass the viewing step" : "Send request"}
      onSubmit={async (reason) => {
        const r = await request.run({ leadId: info.lead.id, reason });
        if (r?.ok) router.refresh();
        return Boolean(r?.ok);
      }}
    />
  );
}

/** Card on the lead page: what's needed to move forward, pass requests, lost reason. */
export function StageRequirements({ info }: { info: StageInfo }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [deciding, setDeciding] = useState<null | boolean>(null);
  const decide = useAction(decideViewingPassAction);
  const pass = info.gate.pass;

  return (
    <div className="space-y-3 text-sm">
      {info.lead.status === "LOST" && info.lead.lostReason && (
        <p className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">
          <XCircle className="mt-0.5 size-4 shrink-0" /> <span>Lost: {info.lead.lostReason}</span>
        </p>
      )}
      <ul className="divide-y">
        <Requirement done={info.gate.passed} label={info.gate.viewingForm ? "Viewing form attached" : pass?.status === "APPROVED" ? "Viewing step passed (pass approved)" : "Viewing form — needed to move past Viewing"}>
          <span className="flex gap-1.5">
            <AttachButton target="lead" targetId={info.lead.id} kind="VIEWING_FORM" label="Attach" />
            {pass?.status !== "PENDING" && (
              <Button variant="ghost" size="sm" onClick={() => setAsking(true)}>
                Request pass
              </Button>
            )}
          </span>
        </Requirement>
        <Requirement done={!info.missingWonDocuments.includes("BOOKING_FORM")} label="Booking form — needed for Won">
          <AttachButton target="lead" targetId={info.lead.id} kind="BOOKING_FORM" label="Attach" />
        </Requirement>
        <Requirement done={!info.missingWonDocuments.includes("PROOF_OF_PAYMENT")} label="Proof of payment — needed for Won">
          <AttachButton target="lead" targetId={info.lead.id} kind="PROOF_OF_PAYMENT" label="Attach" />
        </Requirement>
      </ul>
      {pass && !info.gate.viewingForm && (
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Viewing pass</span>
            <EnumBadge meta={PASS_STATUS_META} value={pass.status} />
          </div>
          <p className="mt-1 text-muted-foreground">“{pass.reason}”</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pass.requestedBy?.name ?? "Someone"} · {formatDateTime(pass.createdAt)}
            {pass.decidedBy && ` · ${pass.status === "APPROVED" ? "approved" : "rejected"} by ${pass.decidedBy.name}`}
            {pass.decisionNote && ` — ${pass.decisionNote}`}
          </p>
          {pass.status === "PENDING" && info.isManager && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => setDeciding(true)}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDeciding(false)}>
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
      <PassRequestDialog open={asking} onOpenChange={setAsking} info={info} />
      {pass && deciding !== null && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setDeciding(null)}
          title={deciding ? "Approve the viewing pass?" : "Reject the viewing pass?"}
          description={`Requested by ${pass.requestedBy?.name ?? "the agent"}: “${pass.reason}”`}
          label="Note for the agent"
          minLength={deciding ? 0 : 5}
          confirmLabel={deciding ? "Approve" : "Reject"}
          destructive={!deciding}
          onSubmit={async (note) => {
            const r = await decide.run({ requestId: pass.id, approve: deciding, note: note || null });
            if (r?.ok) router.refresh();
            return Boolean(r?.ok);
          }}
        />
      )}
    </div>
  );
}
