"use client";

import { ChevronDown } from "lucide-react";
import type { PropertyStatus } from "@/generated/prisma/enums";
import { setPropertyStatusAction } from "@/actions/properties";
import { useAction } from "@/hooks/use-action";
import { PROPERTY_STATUS_META } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function PropertyStatusMenu({ id, status }: { id: string; status: PropertyStatus }) {
  const { run, pending } = useAction(setPropertyStatusAction);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" loading={pending}>
          Status: {PROPERTY_STATUS_META[status].label} <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Change status</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => void run({ id, status: v as PropertyStatus })}>
          {(Object.keys(PROPERTY_STATUS_META) as PropertyStatus[]).map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {PROPERTY_STATUS_META[s].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
