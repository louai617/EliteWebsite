"use client";

import { useState } from "react";
import { CalendarCheck2, CheckCircle2, MoreHorizontal, Pencil, Trash2, UserX, XCircle } from "lucide-react";
import type { ViewingItem } from "@/services/viewings";
import { deleteViewingAction, setViewingStatusAction } from "@/actions/viewings";
import { useAction } from "@/hooks/use-action";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmAction } from "@/components/shared/confirm-button";
import { ViewingSheet } from "./viewing-form";

export function ViewingActions({ viewing, agents, viewer, trigger }: { viewing: ViewingItem; agents: AgentOption[]; viewer: Viewer; trigger?: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const status = useAction(setViewingStatusAction);
  const active = viewing.status === "SCHEDULED" || viewing.status === "CONFIRMED";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="icon-xs" aria-label="Viewing actions" disabled={status.pending}>
              <MoreHorizontal />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {viewing.status === "SCHEDULED" && (
            <DropdownMenuItem onSelect={() => void status.run({ id: viewing.id, status: "CONFIRMED" })}>
              <CalendarCheck2 /> Confirm
            </DropdownMenuItem>
          )}
          {active && (
            <>
              <DropdownMenuItem onSelect={() => void status.run({ id: viewing.id, status: "COMPLETED" })}>
                <CheckCircle2 /> Mark completed
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void status.run({ id: viewing.id, status: "NO_SHOW" })}>
                <UserX /> Mark no-show
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void status.run({ id: viewing.id, status: "CANCELLED" })}>
                <XCircle /> Cancel viewing
              </DropdownMenuItem>
            </>
          )}
          {!active && (
            <DropdownMenuItem onSelect={() => void status.run({ id: viewing.id, status: "SCHEDULED" })}>
              <CalendarCheck2 /> Reopen as scheduled
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Edit / reschedule
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ViewingSheet open={editing} onOpenChange={setEditing} viewing={viewing} agents={agents} viewer={viewer} />
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete this viewing?"
        description="Prefer “Cancel viewing” to keep the history. Deleting removes it from the calendar and reports."
        action={deleteViewingAction}
        input={{ id: viewing.id }}
      />
    </>
  );
}
