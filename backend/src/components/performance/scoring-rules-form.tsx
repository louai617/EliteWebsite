"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { resetScoringRulesAction, updateScoringRulesAction } from "@/actions/performance";
import { useAction } from "@/hooks/use-action";
import type { ScoringRules } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export interface MetricInfo {
  key: string;
  label: string;
  description: string;
  kind: string;
  defaultPoints: number;
}

const KIND_HINT: Record<string, string> = { count: "per unit", ratio: "× rate", flag: "once", speed: "× speed" };

/**
 * Scoring weights. Read-only for managers/agents (so the score is transparent); editable by
 * admins. Changes apply to today's live score and future days — finalized days keep theirs.
 */
export function ScoringRulesForm({ metrics, rules, editable }: { metrics: MetricInfo[]; rules: ScoringRules; editable: boolean }) {
  const [values, setValues] = useState(() => Object.fromEntries(metrics.map((m) => [m.key, { points: String(rules[m.key]?.points ?? m.defaultPoints), isEnabled: rules[m.key]?.isEnabled ?? true }])));
  const save = useAction(updateScoringRulesAction);
  const reset = useAction(resetScoringRulesAction, {
    onSuccess: () => setValues(Object.fromEntries(metrics.map((m) => [m.key, { points: String(m.defaultPoints), isEnabled: true }]))),
  });
  const invalid = Object.values(values).some((v) => v.points.trim() === "" || !Number.isFinite(Number(v.points)) || Math.abs(Number(v.points)) > 1000);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (invalid) return;
        void save.run({ rules: metrics.map((m) => ({ metric: m.key, points: Number(values[m.key].points), isEnabled: values[m.key].isEnabled })) });
      }}
      className="space-y-3"
    >
      <ul className="divide-y">
        {metrics.map((m) => {
          const v = values[m.key];
          const bad = v.points.trim() === "" || !Number.isFinite(Number(v.points)) || Math.abs(Number(v.points)) > 1000;
          return (
            <li key={m.key} className={cn("flex items-start gap-3 py-2.5", !v.isEnabled && "opacity-60")}>
              {editable && (
                <Checkbox
                  className="mt-1"
                  checked={v.isEnabled}
                  onCheckedChange={(c) => setValues((s) => ({ ...s, [m.key]: { ...s[m.key], isEnabled: c === true } }))}
                  aria-label={`Use ${m.label}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {editable ? (
                  <Input
                    value={v.points}
                    onChange={(e) => setValues((s) => ({ ...s, [m.key]: { ...s[m.key], points: e.target.value } }))}
                    inputMode="decimal"
                    className={cn("h-8 w-20 text-right tabular", bad && "border-destructive")}
                    aria-label={`${m.label} points`}
                    aria-invalid={bad}
                  />
                ) : (
                  <span className="tabular w-12 text-right text-sm font-medium">{v.isEnabled ? v.points : "off"}</span>
                )}
                <span className="w-14 text-xs text-muted-foreground">{KIND_HINT[m.kind] ?? ""}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={invalid} loading={save.pending}>
            Save weights
          </Button>
          <Button type="button" variant="ghost" onClick={() => void reset.run({})} loading={reset.pending}>
            <RotateCcw /> Reset to defaults
          </Button>
          <p className="text-xs text-muted-foreground">Applies to today&apos;s live score and future days. Closed days keep the score they were finalized with.</p>
        </div>
      )}
    </form>
  );
}
