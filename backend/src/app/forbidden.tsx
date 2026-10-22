import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function Forbidden() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <ShieldAlert className="size-5" />
      </div>
      <h1 className="text-lg font-semibold">You don&apos;t have access to this page</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Ask a manager or admin if you need access.</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        Back to the dashboard
      </Link>
    </main>
  );
}
