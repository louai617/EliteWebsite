"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";
import { bulkReassignLeadsAction } from "@/actions/leads";
import { useAction } from "@/hooks/use-action";
import type { AgentOption } from "@/types/options";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

/** Managers/admins move many leads at once (an agent is away, leaves, or is overloaded). */
export function BulkReassignButton({ agents }: { agents: AgentOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [onlyNew, setOnlyNew] = useState(false);
  const move = useAction(bulkReassignLeadsAction, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Shuffle /> Reassign leads
      </Button>
      <Dialog open={open} onOpenChange={(v) => !move.pending && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign leads</DialogTitle>
            <DialogDescription>Move every open lead (not Won or Lost) from one agent to another. Each lead&apos;s response task moves with it and the change is logged.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned leads</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose who receives them" />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter((a) => a.id !== from)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={onlyNew} onCheckedChange={setOnlyNew} /> Only leads still in “New”
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={move.pending}>
              Cancel
            </Button>
            <Button loading={move.pending} disabled={!from || !to} onClick={() => void move.run({ fromAgentId: from, toAgentId: to, onlyNew })}>
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
