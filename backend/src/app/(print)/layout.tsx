import { requireUser } from "@/lib/auth/session";

/** Bare layout for printable documents (no sidebar). Staff only. */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="min-h-screen bg-[#f1eee8] print:bg-white">{children}</div>;
}
