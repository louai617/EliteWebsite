import { lastSyncError } from "../../../scripts/db-sync.mjs";

/**
 * Development only: if the automatic database update failed, say so on every agent app page
 * (instead of only in the terminal) with the command that shows the full reason.
 */
export function DevDbNotice() {
  if (process.env.NODE_ENV !== "development") return null;
  const error = lastSyncError();
  if (!error) return null;
  return (
    <div role="alert" className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <p className="font-semibold">The local database couldn&apos;t be updated to match the code.</p>
      <p className="mt-0.5">
        Stop the agent app and run <code className="rounded bg-red-100 px-1">npm run db:sync</code> in <code className="rounded bg-red-100 px-1">backend/</code>, then start it again. Details:
      </p>
      <pre className="mt-2 max-h-40 overflow-auto rounded bg-white/70 p-2 text-xs whitespace-pre-wrap">{error.slice(0, 1500)}</pre>
    </div>
  );
}
