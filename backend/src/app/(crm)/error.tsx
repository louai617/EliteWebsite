"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CrmError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle className="size-5" />
      </div>
      <h1 className="mt-4 text-lg font-semibold">This page couldn&apos;t be loaded</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Something went wrong while loading the data. It has been logged{error.digest ? ` (ref ${error.digest})` : ""}.
      </p>
      <Button className="mt-5" variant="outline" onClick={reset}>
        <RotateCw /> Try again
      </Button>
    </div>
  );
}
