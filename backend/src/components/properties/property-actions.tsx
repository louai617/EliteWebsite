"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { PropertyStatus } from "@/generated/prisma/enums";
import { deletePropertyAction, setPropertyStatusAction } from "@/actions/properties";
import { useAction } from "@/hooks/use-action";
import { PROPERTY_STATUS_META } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmAction } from "@/components/shared/confirm-button";

export function PropertyRowActions({
  property,
  canEdit,
  canDelete,
  showView = true,
}: {
  property: { id: string; reference: string; status: PropertyStatus };
  canEdit: boolean;
  canDelete: boolean;
  showView?: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const status = useAction(setPropertyStatusAction);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${property.reference}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {showView && (
            <DropdownMenuItem asChild>
              <Link href={`/properties/${property.id}`}>
                <Eye /> View
              </Link>
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem asChild>
              <Link href={`/properties/${property.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRightLeft /> Change status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={property.status} onValueChange={(v) => void status.run({ id: property.id, status: v as PropertyStatus })}>
                  {(Object.keys(PROPERTY_STATUS_META) as PropertyStatus[]).map((s) => (
                    <DropdownMenuRadioItem key={s} value={s} disabled={status.pending}>
                      {PROPERTY_STATUS_META[s].label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmAction
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${property.reference}?`}
        description="Photos, viewings, notes and lead interests for this listing are removed. Listings with deals can't be deleted — mark them Off market instead."
        action={deletePropertyAction}
        input={{ id: property.id }}
        onDone={() => router.push("/properties")}
      />
    </>
  );
}
