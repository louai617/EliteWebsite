"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ActionResult } from "@/types/action";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "./confirm-button";

export function DeleteRecordButton<O>({
  action,
  id,
  redirectTo,
  title,
  description,
  label = "Delete",
}: {
  action: (input: { id: string }) => Promise<ActionResult<O>>;
  id: string;
  redirectTo: string;
  title: string;
  description: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <ConfirmAction title={title} description={description} action={action} input={{ id }} onDone={() => router.push(redirectTo)}>
      <Button variant="outline" className="text-destructive hover:text-destructive">
        <Trash2 /> {label}
      </Button>
    </ConfirmAction>
  );
}
