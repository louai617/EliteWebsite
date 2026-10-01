import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, icon: Icon, href, accent = false, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; href?: string; accent?: boolean; className?: string }) {
  const body = (
    <div className={cn("group h-full rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgba(20,16,10,0.04)] transition-colors", href && "hover:border-foreground/20", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("size-4 text-muted-foreground/70", accent && "text-gold")} />}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      {body}
    </Link>
  ) : (
    body
  );
}
