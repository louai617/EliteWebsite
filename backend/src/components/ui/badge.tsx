import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium [&>svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-border bg-secondary text-secondary-foreground",
        slate: "border-slate-200 bg-slate-50 text-slate-600",
        blue: "border-sky-200 bg-sky-50 text-sky-700",
        teal: "border-teal-200 bg-teal-50 text-teal-700",
        violet: "border-violet-200 bg-violet-50 text-violet-700",
        amber: "border-amber-200 bg-amber-50 text-amber-800",
        green: "border-emerald-200 bg-emerald-50 text-emerald-700",
        red: "border-rose-200 bg-rose-50 text-rose-700",
        gold: "border-[#e8d6ae] bg-gold-soft text-gold-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
