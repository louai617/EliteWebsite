"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckSquare, Handshake, UserPlus } from "lucide-react";
import type { AgentOption, Viewer } from "@/types/options";
import type { LeadInput } from "@/schemas/lead";
import type { LookupOption } from "@/types/search";
import { Button } from "@/components/ui/button";
import { ViewingSheet, type ViewingPrefill } from "@/components/viewings/viewing-form";
import { TaskSheet, type TaskPrefill } from "@/components/tasks/task-form";
import { DealSheet, type CommissionDefaults, type DealPrefill } from "@/components/deals/deal-form";
import { LeadSheet } from "@/components/leads/lead-form";

/**
 * Contextual "create related record" buttons for detail pages. Each opens the relevant
 * drawer pre-filled with the current record (property, lead, client…).
 */
export function RecordActions({
  agents,
  viewer,
  viewing,
  task,
  deal,
  lead,
}: {
  agents: AgentOption[];
  viewer: Viewer;
  viewing?: ViewingPrefill;
  task?: TaskPrefill;
  deal?: DealPrefill & { defaults: CommissionDefaults };
  lead?: { defaults: Partial<LeadInput>; propertyOption?: LookupOption | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState<null | "viewing" | "task" | "deal" | "lead">(null);
  const set = (key: typeof open) => (o: boolean) => setOpen(o ? key : null);

  return (
    <>
      {viewing && (
        <Button variant="outline" onClick={() => setOpen("viewing")}>
          <CalendarPlus /> Schedule viewing
        </Button>
      )}
      {lead && (
        <Button variant="outline" onClick={() => setOpen("lead")}>
          <UserPlus /> Add lead
        </Button>
      )}
      {task && (
        <Button variant="outline" onClick={() => setOpen("task")}>
          <CheckSquare /> Add task
        </Button>
      )}
      {deal && (
        <Button variant="outline" onClick={() => setOpen("deal")}>
          <Handshake /> Create deal
        </Button>
      )}
      {viewing && <ViewingSheet open={open === "viewing"} onOpenChange={set("viewing")} prefill={viewing} agents={agents} viewer={viewer} />}
      {task && <TaskSheet open={open === "task"} onOpenChange={set("task")} prefill={task} agents={agents} viewer={viewer} />}
      {deal && <DealSheet open={open === "deal"} onOpenChange={set("deal")} prefill={deal} defaults={deal.defaults} agents={agents} viewer={viewer} onSaved={(id) => router.push(`/deals/${id}`)} />}
      {lead && <LeadSheet open={open === "lead"} onOpenChange={set("lead")} defaults={lead.defaults} propertyOption={lead.propertyOption} agents={agents} viewer={viewer} onSaved={(id) => router.push(`/leads/${id}`)} />}
    </>
  );
}
