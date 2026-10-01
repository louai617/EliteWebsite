import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

export function UserAvatar({ user, className }: { user: { name: string; avatarUrl?: string | null } | null | undefined; className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
      <AvatarFallback className="text-[10px]">{user ? initials(user.name) : "–"}</AvatarFallback>
    </Avatar>
  );
}

export function AgentCell({ agent, fallback = "Unassigned" }: { agent: { name: string; avatarUrl?: string | null } | null | undefined; fallback?: string }) {
  if (!agent) return <span className="text-xs text-muted-foreground">{fallback}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <UserAvatar user={agent} />
      <span className="truncate text-[13px]">{agent.name}</span>
    </span>
  );
}
