"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "code" | "password" | "done";

async function post<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string; fields?: Record<string, string[]> }> {
  try {
    const res = await fetch(`/api/auth/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.ok) return { ok: true, data: json.data as T };
    return { ok: false, message: json.error?.message ?? "Something went wrong.", fields: json.error?.fields };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." };
  }
}

/** Forgot password → 6-digit code by e-mail → new password. */
export function ResetPasswordFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const r = await post("forgot-password", { email });
    setBusy(false);
    if (!r.ok) return setError(r.fields?.email?.[0] ?? r.message);
    setStep("code");
    setNotice(`If ${email} has an account, a 6-digit code is on its way. It expires in 10 minutes.`);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const r = await post<{ resetToken: string }>("verify-reset-code", { email, code });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setToken(r.data.resetToken);
    setStep("password");
  };

  const reset = async () => {
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    const r = await post("reset-password", { email, token, password });
    setBusy(false);
    if (!r.ok) {
      setError(r.fields?.password?.[0] ?? r.message);
      if (r.fields?.token) setStep("email");
      return;
    }
    setStep("done");
  };

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{step === "done" ? "Password updated" : "Reset your password"}</h1>
      {error && (
        <div role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {step === "email" && (
        <form
          className="mt-6 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <p className="text-sm text-muted-foreground">Enter your staff e-mail. We&apos;ll send you a 6-digit code.</p>
          <div className="grid gap-1.5">
            <Label htmlFor="reset-email">E-mail</Label>
            <Input id="reset-email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@elite.qa" />
          </div>
          <Button type="submit" size="lg" loading={busy} disabled={!email.includes("@")}>
            Send code
          </Button>
        </form>
      )}

      {step === "code" && (
        <form
          className="mt-6 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          {notice && (
            <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              <MailCheck className="mt-0.5 size-4 shrink-0" /> {notice}
            </p>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="reset-code">6-digit code</Label>
            <Input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
              placeholder="••••••"
            />
          </div>
          <Button type="submit" size="lg" loading={busy} disabled={code.length !== 6}>
            Verify code
          </Button>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground hover:underline" onClick={() => void sendCode()} disabled={busy}>
            Didn&apos;t get it? Send a new code
          </button>
        </form>
      )}

      {step === "password" && (
        <form
          className="mt-6 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void reset();
          }}
        >
          <p className="text-sm text-muted-foreground">At least 10 characters with upper- and lowercase letters and a number.</p>
          <div className="grid gap-1.5">
            <Label htmlFor="reset-password">New password</Label>
            <div className="relative">
              <Input id="reset-password" type={show ? "text" : "password"} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reset-confirm">Confirm new password</Label>
            <Input id="reset-confirm" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" size="lg" loading={busy} disabled={!password || !confirm}>
            Set new password
          </Button>
        </form>
      )}

      {step === "done" && (
        <div className="mt-6 grid gap-4">
          <p className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Your password was changed and every other device was signed out. We also sent you a confirmation e-mail.
          </p>
          <Button size="lg" onClick={() => router.push("/login")}>
            Sign in
          </Button>
        </div>
      )}
    </div>
  );
}
