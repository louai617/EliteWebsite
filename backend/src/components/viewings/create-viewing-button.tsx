"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { useCreateParam } from "@/components/shared/form-sheet";
import { ViewingSheet } from "./viewing-form";

function OpenFromUrl({ setOpen }: { setOpen: (o: boolean) => void }) {
  useCreateParam(setOpen);
  return null;
}

export function CreateViewingButton({ agents, viewer, openFromUrl }: { agents: AgentOption[]; viewer: Viewer; openFromUrl?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {openFromUrl && <OpenFromUrl setOpen={setOpen} />}
      <Button onClick={() => setOpen(true)}>
        <CalendarPlus /> Schedule viewing
      </Button>
      <ViewingSheet open={open} onOpenChange={setOpen} agents={agents} viewer={viewer} />
    </>
  );
}
