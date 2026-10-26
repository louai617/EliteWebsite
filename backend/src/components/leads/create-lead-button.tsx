"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { AgentOption, Viewer } from "@/types/options";
import type { LookupOption } from "@/types/search";
import type { LeadInput } from "@/schemas/lead";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useCreateParam } from "@/components/shared/form-sheet";
import { LeadSheet } from "./lead-form";

function OpenFromUrl({ setOpen }: { setOpen: (open: boolean) => void }) {
  useCreateParam(setOpen);
  return null;
}

export function CreateLeadButton({
  agents,
  viewer,
  defaults,
  propertyOption,
  openFromUrl = false,
  label = "Add lead",
  variant,
  navigate = true,
}: {
  agents: AgentOption[];
  viewer: Viewer;
  defaults?: Partial<LeadInput>;
  propertyOption?: LookupOption | null;
  openFromUrl?: boolean;
  label?: string;
  variant?: ButtonProps["variant"];
  navigate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      {openFromUrl && <OpenFromUrl setOpen={setOpen} />}
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <LeadSheet
        open={open}
        onOpenChange={setOpen}
        agents={agents}
        viewer={viewer}
        defaults={defaults}
        propertyOption={propertyOption}
        onSaved={(id) => navigate && router.push(`/leads/${id}`)}
      />
    </>
  );
}
