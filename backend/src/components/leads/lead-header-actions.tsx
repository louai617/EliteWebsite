"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Pencil, UserCheck, UserRoundPlus } from "lucide-react";
import type { LeadStatus } from "@/generated/prisma/enums";
import { assignLeadAction, convertLeadAction, deleteLeadAction, setLeadStatusAction } from "@/actions/leads";
import { useAction } from "@/hooks/use-action";
import { LEAD_PIPELINE, LEAD_STATUS_META } from "@/lib/constants";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { LeadSheet, type LeadRecord } from "./lead-form";

const UNASSIGNED = "__none__";

export function LeadHeaderActions({ lead, clientId, agents, viewer }: { lead: LeadRecord; clientId: string | null; agents: AgentOption[]; viewer: Viewer }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const status = useAction(setLeadStatusAction);
  const assign = useAction(assignLeadAction);
  const convert = useAction(convertLeadAction, { onSuccess: (r) => router.push(`/clients/${r.clientId}`) });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" loading={status.pending}>
            {LEAD_STATUS_META[lead.status].label} <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={lead.status} onValueChange={(v) => void status.run({ id: lead.id, status: v as LeadStatus })}>
            {LEAD_PIPELINE.map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                {LEAD_STATUS_META[s].label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {viewer.isManager && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" loading={assign.pending}>
              <UserCheck /> Assign <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 w-56">
            <DropdownMenuLabel>Assign to</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={lead.agentId ?? UNASSIGNED} onValueChange={(v) => void assign.run({ id: lead.id, agentId: v === UNASSIGNED ? null : v })}>
              {agents.map((a) => (
                <DropdownMenuRadioItem key={a.id} value={a.id}>
                  {a.name}
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuRadioItem value={UNASSIGNED}>Unassigned</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {clientId ? (
        <Button variant="outline" onClick={() => router.push(`/clients/${clientId}`)}>
          <UserRoundPlus /> Client profile
        </Button>
      ) : (
        <Button variant="outline" loading={convert.pending} onClick={() => void convert.run({ id: lead.id })}>
          <UserRoundPlus /> Convert to client
        </Button>
      )}

      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil /> Edit
      </Button>
      {viewer.isManager && (
        <DeleteRecordButton action={deleteLeadAction} id={lead.id} redirectTo="/leads" title={`Delete ${lead.fullName}?`} description="Viewings and tasks keep their history but lose the link to this lead. Notes on the lead are removed." />
      )}
      <LeadSheet open={editing} onOpenChange={setEditing} lead={lead} agents={agents} viewer={viewer} />
    </>
  );
}
