'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, ArrowRight, ArrowLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import api, { apiErrorMessage } from '@/lib/api';

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and at least one number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

type ResetFormValues = z.infer<typeof resetSchema>;

function ResetPasswordForm() {
  const locale = useLocale();
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'This reset link is missing its token.');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetFormValues>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (data: ResetFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full pl-12 pr-4 py-3 bg-gray-50 border ${hasError ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#b98f42]/20 focus:border-[#b98f42] outline-none transition-all`;

  return (
    <div className="p-8 md:p-10 text-center">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 flex items-start gap-3 text-left">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {done ? (
        <div>
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-green-100">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Password Updated</h2>
          <p className="text-gray-500 mb-8 font-light">You can now sign in with your new password.</p>
          <Link href={`/${locale}/login`} className="inline-flex items-center gap-2 text-[#b98f42] font-bold hover:underline">
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 text-left">
          {(['password', 'confirm'] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                {field === 'password' ? 'New Password' : 'Confirm Password'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input {...register(field)} type="password" autoComplete="new-password" className={inputClass(Boolean(errors[field]))} placeholder="••••••••" />
              </div>
              {errors[field] && <p className="text-red-500 text-xs mt-1 font-medium">{errors[field]?.message}</p>}
            </div>
          ))}

          <button
            type="submit"
            disabled={isLoading || !token}
            className="w-full bg-[#1a1a1a] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#b98f42] transition-all shadow-lg shadow-gray-200 disabled:opacity-70 group"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                Update Password
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const locale = useLocale();
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 pt-20 pb-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-[#1a1a1a] p-8 text-center">
          <Link href={`/${locale}`} className="inline-block relative h-12 w-40">
            <Image src="/logo.png" alt="ELITE Real Estate" fill sizes="160px" className="object-contain brightness-0 invert" />
          </Link>
          <h1 className="text-white mt-6 text-2xl font-bold">Choose a New Password</h1>
        </div>
        <Suspense fallback={<Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-[#b98f42]" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
