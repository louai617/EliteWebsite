import type { EnumMeta } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function EnumBadge<T extends string>({ meta, value, className, dot = false }: { meta: Record<T, EnumMeta>; value: T | null | undefined; className?: string; dot?: boolean }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const m = meta[value];
  return (
    <Badge tone={m.tone} className={className}>
      {dot && <span className={cn("size-1.5 rounded-full bg-current opacity-70")} aria-hidden />}
      {m.label}
    </Badge>
  );
}
