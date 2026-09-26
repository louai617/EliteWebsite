"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { useCreateParam } from "@/components/shared/form-sheet";
import { TaskSheet } from "./task-form";

function OpenFromUrl({ setOpen }: { setOpen: (o: boolean) => void }) {
  useCreateParam(setOpen);
  return null;
}

export function CreateTaskButton({ agents, viewer, openFromUrl }: { agents: AgentOption[]; viewer: Viewer; openFromUrl?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {openFromUrl && <OpenFromUrl setOpen={setOpen} />}
      <Button onClick={() => setOpen(true)}>
        <Plus /> New task
      </Button>
      <TaskSheet open={open} onOpenChange={setOpen} agents={agents} viewer={viewer} />
    </>
  );
}
