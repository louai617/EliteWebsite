import Link from "next/link";
import { ArrowRightLeft, CheckCircle2, CirclePlus, Flag, ImagePlus, MessageSquare, Pencil, PhoneCall, Trash2, UserPlus, XCircle, type LucideIcon } from "lucide-react";
import type { ActivityAction, EntityType } from "@/generated/prisma/enums";
import { RelativeTime } from "./relative-time";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export interface ActivityView {
  id: string;
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  description: string;
  createdAt: Date;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

const ICON: Record<ActivityAction, { icon: LucideIcon; className: string }> = {
  CREATED: { icon: CirclePlus, className: "text-sky-600 bg-sky-50" },
  UPDATED: { icon: Pencil, className: "text-slate-500 bg-slate-100" },
  DELETED: { icon: Trash2, className: "text-rose-600 bg-rose-50" },
  STATUS_CHANGED: { icon: ArrowRightLeft, className: "text-amber-700 bg-amber-50" },
  ASSIGNED: { icon: UserPlus, className: "text-violet-600 bg-violet-50" },
  COMPLETED: { icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50" },
  CANCELLED: { icon: XCircle, className: "text-slate-500 bg-slate-100" },
  CLOSED: { icon: Flag, className: "text-[#8a6a2f] bg-gold-soft" },
  CONVERTED: { icon: ArrowRightLeft, className: "text-emerald-600 bg-emerald-50" },
  NOTE_ADDED: { icon: MessageSquare, className: "text-slate-600 bg-slate-100" },
  IMAGE_ADDED: { icon: ImagePlus, className: "text-sky-600 bg-sky-50" },
  WORK_LOGGED: { icon: PhoneCall, className: "text-teal-700 bg-teal-50" },
};

const HREF: Partial<Record<EntityType, string>> = {
  LEAD: "/leads/",
  CLIENT: "/clients/",
  OWNER: "/owners/",
  PROPERTY: "/properties/",
  DEAL: "/deals/",
};

export function ActivityTimeline({ items, showEntity = false, emptyText = "No activity yet." }: { items: ActivityView[]; showEntity?: boolean; emptyText?: string }) {
  if (items.length === 0) return <EmptyState compact title={emptyText} />;
  return (
    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-border">
      {items.map((item) => {
        const { icon: Icon, className } = ICON[item.action];
        const href = item.action !== "DELETED" && HREF[item.entityType] ? `${HREF[item.entityType]}${item.entityId}` : null;
        return (
          <li key={item.id} className="relative flex gap-3">
            <span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card", className)}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug">
                {showEntity && href ? (
                  <Link href={href} className="hover:underline">
                    {item.description}
                  </Link>
                ) : (
                  item.description
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.user?.name ?? "System"} · <RelativeTime date={item.createdAt} />
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
