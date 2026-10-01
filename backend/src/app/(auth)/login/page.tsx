import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoMark } from "@/components/layout/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#171412] p-10 text-stone-200 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }}
        />
        <div className="relative flex items-center gap-3">
          <LogoMark className="size-9" />
          <div className="leading-none">
            <p className="font-serif text-lg tracking-[0.25em] text-[#f2c98d]">ELITE</p>
            <p className="mt-1 text-[10px] tracking-[0.35em] text-stone-400">REAL ESTATE · DOHA</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <p className="font-serif text-3xl leading-snug text-stone-50">Every lead, listing and deal — in one place.</p>
          <p className="mt-4 text-sm leading-relaxed text-stone-400">
            The internal workspace for the ELITE team: pipeline, inventory across The Pearl, Lusail and West Bay,
            viewings, contracts and commission — backed by a single source of truth.
          </p>
        </div>
        <p className="relative text-xs text-stone-500">Authorised staff only. Activity is logged.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <span className="font-serif text-base tracking-[0.22em]">ELITE</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your ELITE staff account.</p>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
      </section>
    </main>
  );
}
