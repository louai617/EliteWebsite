import type { ScoreResult } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Transparent score explanation: every metric, its value, weight and the points it gave. */
export function ScoreBreakdown({ breakdown, compact = false }: { breakdown: ScoreResult | null; compact?: boolean }) {
  if (!breakdown || breakdown.items.length === 0) return <p className="text-sm text-muted-foreground">No score yet for this period.</p>;
  const items = compact ? breakdown.items.filter((i) => i.points !== 0) : breakdown.items;
  return (
    <div className="space-y-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="pb-2 font-medium">Metric</th>
            <th className="pb-2 text-right font-medium">Value</th>
            {!compact && <th className="pb-2 text-right font-medium">Weight</th>}
            <th className="pb-2 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.key} title={item.explanation}>
              <td className="py-1.5 pr-2">
                {item.label}
                {!compact && <span className="block text-xs text-muted-foreground">{item.explanation}</span>}
              </td>
              <td className="tabular py-1.5 text-right">{item.value}</td>
              {!compact && <td className="tabular py-1.5 text-right text-muted-foreground">{fmt(item.weight)}</td>}
              <td className={cn("tabular py-1.5 text-right font-medium", item.points > 0 && "text-emerald-700", item.points < 0 && "text-rose-600")}>
                {item.points > 0 ? "+" : ""}
                {fmt(item.points)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t font-semibold">
            <td className="pt-2" colSpan={compact ? 2 : 3}>
              Total
            </td>
            <td className="tabular pt-2 text-right">{fmt(breakdown.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
