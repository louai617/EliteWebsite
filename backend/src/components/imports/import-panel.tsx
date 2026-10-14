"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, FileJson, Upload } from "lucide-react";
import { toast } from "sonner";
import type { ExternalSource } from "@/generated/prisma/enums";
import { runImportAction } from "@/actions/imports";
import { useAction } from "@/hooks/use-action";
import type { AgentOption } from "@/types/options";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MAX_BYTES = 9 * 1024 * 1024;
const NONE = "__none__";

/** Upload a portal JSON export (with a dry-run preview), or fetch the configured feed. */
export function ImportPanel({ source, remoteConfigured, agents }: { source: ExternalSource; remoteConfigured: boolean; agents: AgentOption[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [agent, setAgent] = useState(NONE);
  const run = useAction(runImportAction, {
    silent: true,
    onSuccess: (r) => {
      const summary = `${r.created} created · ${r.updated} updated · ${r.failed} failed`;
      if (r.status === "FAILED") toast.error(`Import failed — ${summary}`);
      else toast.success(`${dryRun ? "Dry run finished" : "Import finished"} — ${summary}`);
      router.push(`/imports/${r.id}`);
    },
  });

  const start = async (remote: boolean) => {
    let payload: string | undefined;
    if (!remote) {
      if (!file) return toast.error("Choose a JSON file first.");
      if (file.size > MAX_BYTES) return toast.error("File is too large (max 9 MB). Split it into smaller batches.");
      payload = await file.text();
    }
    void run.run({ source, payload, remote, dryRun, defaultAgentId: agent === NONE ? null : agent });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="JSON file" />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          <FileJson /> {file ? file.name : "Choose JSON file"}
        </Button>
        <Button type="button" size="sm" onClick={() => void start(false)} disabled={!file} loading={run.pending}>
          <Upload /> {dryRun ? "Preview import" : "Import file"}
        </Button>
        {remoteConfigured && (
          <Button type="button" size="sm" variant="outline" onClick={() => void start(true)} loading={run.pending}>
            <CloudDownload /> {dryRun ? "Preview feed" : "Fetch from feed"}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Label className="flex cursor-pointer items-center gap-2 font-normal">
          <Checkbox checked={dryRun} onCheckedChange={(v) => setDryRun(v === true)} />
          Dry run (preview only — nothing is saved)
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Unmatched agents →</span>
          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="h-8 w-44" aria-label="Default agent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Leave unassigned</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
