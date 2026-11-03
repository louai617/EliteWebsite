import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <SearchX className="size-5" />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">This record doesn&apos;t exist, was deleted, or isn&apos;t assigned to you.</p>
      <Button asChild className="mt-5" variant="outline">
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
