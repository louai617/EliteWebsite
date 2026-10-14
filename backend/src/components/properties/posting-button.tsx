"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { recordPropertyPostingAction } from "@/actions/work-activities";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

const CHANNELS = ["Property Finder", "Qatar Living", "Website", "Instagram", "WhatsApp"];

/**
 * Records that the listing was posted or reposted on a portal. Counts towards the agent's
 * daily report and closes any open posting/repost task for this listing.
 */
export function PostingButton({ propertyId, posted }: { propertyId: string; posted: boolean }) {
  const [channel, setChannel] = useState("");
  const record = useAction(recordPropertyPostingAction);
  const run = (kind: "PROPERTY_POST" | "PROPERTY_REPOST", where: string) => void record.run({ propertyId, kind, outcome: where });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={record.pending}>
          <Megaphone /> {posted ? "Mark reposted" : "Mark posted"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{posted ? "Reposted on" : "Posted on"}</DropdownMenuLabel>
        {CHANNELS.map((c) => (
          <DropdownMenuItem key={c} onSelect={() => run(posted ? "PROPERTY_REPOST" : "PROPERTY_POST", c)}>
            {c}
          </DropdownMenuItem>
        ))}
        <div className="flex gap-1 p-1" onKeyDown={(e) => e.stopPropagation()}>
          <Input value={channel} onChange={(e) => setChannel(e.target.value)} maxLength={200} placeholder="Other channel…" className="h-7 text-xs" aria-label="Other channel" />
          <Button size="xs" disabled={!channel.trim()} onClick={() => run(posted ? "PROPERTY_REPOST" : "PROPERTY_POST", channel.trim())}>
            Save
          </Button>
        </div>
        {posted && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => run("PROPERTY_POST", "")}>Record as a new posting instead</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
