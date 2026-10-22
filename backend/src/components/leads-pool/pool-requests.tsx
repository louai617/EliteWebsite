"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { MyPoolRequest, PendingPoolRequest } from "@/services/leads-pool";
import { cancelPoolRequestAction, decidePoolRequestAction } from "@/actions/leads-pool";
import { useAction } from "@/hooks/use-action";
import { CUSTOMER_TYPE_META, POOL_REQUEST_STATUS_META, PURPOSE_META } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EnumBadge } from "@/components/shared/enum-badge";
import { ReasonDialog } from "@/components/shared/reason-dialog";
import { RelativeTime } from "@/components/shared/relative-time";
import { UserAvatar } from "@/components/shared/user-avatar";

/** Managers: agents' "Get this lead" requests, approved or declined here. */
export function PendingPoolRequests({ requests }: { requests: PendingPoolRequest[] }) {
  const router = useRouter();
  const [deciding, setDeciding] = useState<null | { request: PendingPoolRequest; approve: boolean }>(null);
  const decide = useAction(decidePoolRequestAction);
  if (!requests.length) return null;

  return (
    <Card id="requests" className="mb-5 scroll-mt-20 gap-0 overflow-hidden p-0">
      <div className="border-b bg-amber-50/60 px-4 py-2.5">
        <h2 className="text-sm font-semibold">
          {requests.length} request{requests.length === 1 ? "" : "s"} waiting for you
        </h2>
        <p className="text-xs text-muted-foreground">Approving gives the agent the full number — the lead appears on their Leads page.</p>
      </div>
      <ul className="divide-y">
        {requests.map((r) => {
          const p = r.poolLead;
          const needs = [p.leadType && CUSTOMER_TYPE_META[p.leadType].label, p.interestedArea].filter(Boolean).join(" · ");
          return (
            <li key={r.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <UserAvatar user={r.requestedBy} className="mt-0.5 size-7" />
                <div className="min-w-0 text-sm">
                  <p>
                    <span className="font-medium">{r.requestedBy.name}</span> wants <span className="font-medium">{p.fullName ?? "this number"}</span>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{p.phone}</span>
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {p.purpose && <EnumBadge meta={PURPOSE_META} value={p.purpose} />}
                    {needs && <span>{needs}</span>}
                    <span>
                      {p.purpose || needs ? "· " : ""}asked <RelativeTime date={r.createdAt} />
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => setDeciding({ request: r, approve: false })}>
                  <X /> Decline
                </Button>
                <Button size="sm" onClick={() => setDeciding({ request: r, approve: true })}>
                  <Check /> Approve
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {deciding && (
        <ReasonDialog
          open
          onOpenChange={(o) => !o && setDeciding(null)}
          title={deciding.approve ? `Give the lead to ${deciding.request.requestedBy.name}?` : `Decline ${deciding.request.requestedBy.name}'s request?`}
          description={deciding.approve ? "Other agents waiting for the same lead are declined automatically." : "The number stays in the pool for other agents."}
          label={deciding.approve ? "Note for the agent (optional)" : "Reason for the agent"}
          minLength={deciding.approve ? 0 : 3}
          confirmLabel={deciding.approve ? "Approve" : "Decline"}
          destructive={!deciding.approve}
          onSubmit={async (note) => {
            const r = await decide.run({ requestId: deciding.request.id, approve: deciding.approve, note: note || null });
            if (r?.ok) router.refresh();
            return Boolean(r?.ok);
          }}
        />
      )}
    </Card>
  );
}

/** Agents: what they asked for and how it went. */
export function MyPoolRequests({ requests }: { requests: MyPoolRequest[] }) {
  const router = useRouter();
  const cancel = useAction(cancelPoolRequestAction, { onSuccess: () => router.refresh() });
  if (!requests.length) return null;
  return (
    <Card className="mb-5 gap-0 overflow-hidden p-0">
      <div className="border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Your requests</h2>
        <p className="text-xs text-muted-foreground">Approved leads are on your Leads page with the full number.</p>
      </div>
      <ul className="divide-y">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
            <span className="font-medium">{r.fullName ?? "No name"}</span>
            <span className="font-mono text-xs text-muted-foreground">{r.phone}</span>
            <EnumBadge meta={POOL_REQUEST_STATUS_META} value={r.status} dot />
            {r.decisionNote && <span className="text-xs text-muted-foreground">“{r.decisionNote}”</span>}
            <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <RelativeTime date={r.decidedAt ?? r.createdAt} />
              {r.status === "PENDING" && (
                <Button size="xs" variant="ghost" disabled={cancel.pending} onClick={() => void cancel.run({ requestId: r.id })}>
                  Cancel
                </Button>
              )}
              {r.leadId && (
                <Button size="xs" variant="outline" asChild>
                  <Link href={`/leads/${r.leadId}`}>Open lead</Link>
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
