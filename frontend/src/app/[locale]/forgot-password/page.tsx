'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, MailCheck } from 'lucide-react';
import { api, ApiError, errorMessage } from '@/lib/api';

type Step = 'email' | 'code' | 'password' | 'done';

const input =
  'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#b98f42]/20 focus:border-[#b98f42] outline-none transition-all';
const primary =
  'w-full bg-[#1a1a1a] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#b98f42] transition-all shadow-lg shadow-gray-200 disabled:opacity-60 disabled:cursor-not-allowed group';

/** Six single-digit boxes; paste a whole code into any of them. */
function CodeBoxes({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const setAt = (i: number, d: string) => {
    const next = (value.slice(0, i) + d + value.slice(i + 1)).replace(/\s/g, '').slice(0, 6);
    onChange(next);
  };
  return (
    <div className="flex justify-center gap-2" dir="ltr">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          maxLength={6}
          disabled={disabled}
          value={d.trim()}
          autoFocus={i === 0}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) {
              onChange(v.slice(0, 6));
              refs.current[Math.min(v.length, 5)]?.focus();
              return;
            }
            setAt(i, v);
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          className="h-14 w-11 rounded-xl border border-gray-200 bg-gray-50 text-center font-mono text-2xl font-bold text-gray-900 outline-none focus:border-[#b98f42] focus:ring-2 focus:ring-[#b98f42]/20 sm:w-12"
        />
      ))}
    </div>
  );
}

/** Forgot password → 6-digit e-mail code → new password. */
export default function ForgotPasswordPage() {
  const locale = useLocale();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : undefined;
      setError(fields?.password?.[0] ?? fields?.email?.[0] ?? errorMessage(err));
      if (fields?.token) setStep('email');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (again = false) =>
    run(async () => {
      await api.post('/auth/forgot-password', { email });
      setStep('code');
      setResent(again);
      setCode('');
    });

  const verify = () =>
    run(async () => {
      const r = await api.post<{ resetToken: string }>('/auth/verify-reset-code', { email, code });
      setToken(r.resetToken);
      setStep('password');
    });

  const reset = () => {
    if (password !== confirm) return setError("The passwords don't match.");
    return run(async () => {
      await api.post('/auth/reset-password', { email, token, password });
      setStep('done');
    });
  };

  const titles: Record<Step, string> = { email: 'Reset Password', code: 'Check your e-mail', password: 'Choose a new password', done: 'Password updated' };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 pt-20 pb-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-[#1a1a1a] p-8 text-center">
          <Link href={`/${locale}`} className="inline-block relative h-12 w-40">
            <Image src="/logo.png" alt="ELITE Real Estate" fill sizes="160px" className="object-contain brightness-0 invert" />
          </Link>
          <h1 className="text-white mt-6 text-2xl font-bold">{titles[step]}</h1>
          {step !== 'done' && (
            <ol className="mt-4 flex justify-center gap-2" aria-label="Progress">
              {(['email', 'code', 'password'] as Step[]).map((s, i) => (
                <li key={s} className={`h-1.5 w-10 rounded-full ${(['email', 'code', 'password'] as Step[]).indexOf(step) >= i ? 'bg-[#b98f42]' : 'bg-white/20'}`} />
              ))}
            </ol>
          )}
        </div>

        <div className="p-8 md:p-10">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 flex items-start gap-3 text-left" role="alert">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {step === 'email' && (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                void sendCode();
              }}
            >
              <p className="text-gray-500 font-light text-center">Enter the e-mail of your account and we&apos;ll send you a 6-digit code.</p>
              <div>
                <label htmlFor="fp-email" className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input id="fp-email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} ps-12`} placeholder="name@example.com" />
                </div>
              </div>
              <button type="submit" disabled={busy || !/^\S+@\S+\.\S+$/.test(email)} className={primary}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    Send code <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform rtl:rotate-180" />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
            >
              <div className="flex items-start gap-3 rounded-2xl bg-[#b98f42]/10 p-4 text-sm text-[#7a5c25]">
                <MailCheck className="w-5 h-5 shrink-0" />
                <p>
                  {resent ? 'We sent a new code. ' : ''}If <strong>{email}</strong> has an account, a 6-digit code is on its way. It expires in 10 minutes.
                </p>
              </div>
              <CodeBoxes value={code} onChange={setCode} disabled={busy} />
              <button type="submit" disabled={busy || code.length !== 6} className={primary}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify code'}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setStep('email')} className="text-gray-500 hover:text-[#b98f42]">
                  Change e-mail
                </button>
                <button type="button" onClick={() => void sendCode(true)} disabled={busy} className="font-bold text-[#b98f42] hover:underline disabled:opacity-50">
                  Send a new code
                </button>
              </div>
            </form>
          )}

          {step === 'password' && (
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void reset();
              }}
            >
              <p className="text-sm text-gray-500">At least 10 characters, with upper- and lowercase letters and a number.</p>
              <div>
                <label htmlFor="fp-password" className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  New password
                </label>
                <div className="relative">
                  <KeyRound className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input id="fp-password" type={show ? 'text' : 'password'} autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} ps-12 pe-12`} />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute end-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700" aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="fp-confirm" className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                  Confirm password
                </label>
                <input id="fp-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
              </div>
              <button type="submit" disabled={busy || !password || !confirm} className={primary}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set new password'}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-100">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <p className="text-gray-500 mb-8 font-light">Your password was changed and you were signed out everywhere else. We also sent you a confirmation e-mail.</p>
              <Link href={`/${locale}/login`} className={primary}>
                Sign in
              </Link>
            </div>
          )}

          {step !== 'done' && (
            <div className="mt-10 pt-8 border-t border-gray-100">
              <Link href={`/${locale}/login`} className="text-gray-500 text-sm font-bold hover:text-[#b98f42] transition-colors flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                Return to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
