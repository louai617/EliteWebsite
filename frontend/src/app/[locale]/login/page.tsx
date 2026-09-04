'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await login(data);
      // Redirect based on role or to home
      router.push(`/${locale}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 pt-20 pb-12 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header/Logo */}
        <div className="bg-[#1a1a1a] p-8 text-center">
          <Link href={`/${locale}`} className="inline-block relative h-12 w-40">
            <Image 
              src="/logo.png" 
              alt="ELITE Real Estate" 
              fill
              sizes="160px"
              className="object-contain brightness-0 invert"
            />
          </Link>
          <h1 className="text-white mt-6 text-2xl font-bold">Welcome Back</h1>
          <p className="text-gray-400 text-sm mt-2 font-light">Elevating the Way You Live</p>
        </div>

        <div className="p-8 md:p-10">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  className={`w-full pl-12 pr-4 py-3 bg-gray-50 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#b98f42]/20 focus:border-[#b98f42] outline-none transition-all`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1 font-medium">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Password</label>
                <Link href={`/${locale}/forgot-password`} className="text-xs font-bold text-[#b98f42] hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  {...register('password')}
                  type="password"
                  className={`w-full pl-12 pr-4 py-3 bg-gray-50 border ${errors.password ? 'border-red-500' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-[#b98f42]/20 focus:border-[#b98f42] outline-none transition-all`}
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1 font-medium">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#1a1a1a] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#b98f42] transition-all shadow-lg shadow-gray-200 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-gray-100 text-center">
            <p className="text-gray-500 text-sm">
              Don't have an account?{' '}
              <Link href={`/${locale}/register`} className="font-bold text-[#b98f42] hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
