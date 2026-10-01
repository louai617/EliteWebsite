"use client";

import { useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import type { DealStatus } from "@/generated/prisma/enums";
import { deleteDealAction, setDealStatusAction } from "@/actions/deals";
import { useAction } from "@/hooks/use-action";
import { DEAL_STATUS_META } from "@/lib/constants";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteRecordButton } from "@/components/shared/delete-record-button";
import { DealSheet, type CommissionDefaults, type DealRecord } from "./deal-form";

export function DealHeaderActions({ deal, defaults, agents, viewer }: { deal: DealRecord; defaults: CommissionDefaults; agents: AgentOption[]; viewer: Viewer }) {
  const [editing, setEditing] = useState(false);
  const status = useAction(setDealStatusAction);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" loading={status.pending}>
            {DEAL_STATUS_META[deal.status].label} <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Change status</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={deal.status} onValueChange={(v) => void status.run({ id: deal.id, status: v as DealStatus })}>
            {(Object.keys(DEAL_STATUS_META) as DealStatus[]).map((s) => (
              <DropdownMenuRadioItem key={s} value={s}>
                {DEAL_STATUS_META[s].label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil /> Edit
      </Button>
      {viewer.isManager && (
        <DeleteRecordButton action={deleteDealAction} id={deal.id} redirectTo="/deals" title={`Delete ${deal.reference}?`} description="The deal and its notes are removed from reports. Use “Closed lost” to keep a record of lost deals." />
      )}
      <DealSheet open={editing} onOpenChange={setEditing} deal={deal} defaults={defaults} agents={agents} viewer={viewer} />
    </>
  );
}
