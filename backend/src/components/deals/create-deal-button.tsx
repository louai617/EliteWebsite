"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { AgentOption, Viewer } from "@/types/options";
import { Button } from "@/components/ui/button";
import { useCreateParam } from "@/components/shared/form-sheet";
import { DealSheet, type CommissionDefaults } from "./deal-form";

function OpenFromUrl({ setOpen }: { setOpen: (o: boolean) => void }) {
  useCreateParam(setOpen);
  return null;
}

export function CreateDealButton({ agents, viewer, defaults, openFromUrl }: { agents: AgentOption[]; viewer: Viewer; defaults: CommissionDefaults; openFromUrl?: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      {openFromUrl && <OpenFromUrl setOpen={setOpen} />}
      <Button onClick={() => setOpen(true)}>
        <Plus /> New deal
      </Button>
      <DealSheet open={open} onOpenChange={setOpen} defaults={defaults} agents={agents} viewer={viewer} onSaved={(id) => router.push(`/deals/${id}`)} />
    </>
  );
}
