import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-6" : "py-14", className)}>
      <div className={cn("flex items-center justify-center rounded-full bg-secondary text-muted-foreground", compact ? "size-8" : "size-11")}>
        <Icon className={compact ? "size-4" : "size-5"} />
      </div>
      <p className={cn("font-medium", compact ? "mt-2 text-[13px]" : "mt-3 text-sm")}>{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
