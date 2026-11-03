import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoMark } from "@/components/layout/logo";
import { ResetPasswordFlow } from "./reset-flow";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <LogoMark />
          <span className="font-serif text-base tracking-[0.22em]">ELITE</span>
        </div>
        <ResetPasswordFlow />
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
