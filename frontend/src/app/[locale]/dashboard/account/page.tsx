'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { AuthUser, PortalOverview } from '@/lib/api-types';
import { useAuth } from '@/lib/AuthContext';
import { usePortal } from '@/components/portal/use-portal';
import { Card, PageTitle, Section } from '@/components/portal/ui';

const phoneRule = z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Enter a valid phone number, e.g. +974 5512 3456');
const profileSchema = z.object({ name: z.string().trim().min(2, 'Name is required').max(120), phone: phoneRule });
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(10, 'Use at least 10 characters').max(128).regex(/[a-z]/, 'Add a lowercase letter').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[0-9]/, 'Add a number'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: "Passwords don't match" });

const inputCls = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#b98f42]/20 focus:border-[#b98f42] outline-none text-sm';
const buttonCls = 'bg-[#1a1a1a] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#b98f42] transition-colors disabled:opacity-50';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  );
}

function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const { refresh } = useAuth();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { name, phone } });
  useEffect(() => form.reset({ name, phone }), [name, phone, form]);
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        setStatus(null);
        try {
          await api.patch('/portal/account', values);
          await refresh();
          setStatus({ ok: true, text: 'Saved.' });
        } catch (err) {
          if (err instanceof ApiError && err.fields) for (const [k, v] of Object.entries(err.fields)) if (k === 'name' || k === 'phone') form.setError(k, { message: v[0] });
          setStatus({ ok: false, text: errorMessage(err) });
        }
      })}
    >
      <Field label="Full name" error={form.formState.errors.name?.message}>
        <input {...form.register('name')} className={inputCls} autoComplete="name" />
      </Field>
      <Field label="Phone" error={form.formState.errors.phone?.message}>
        <input {...form.register('phone')} className={inputCls} autoComplete="tel" />
      </Field>
      <Field label="E-mail">
        <input value={email} disabled className={`${inputCls} opacity-60`} />
        <span className="block text-xs text-gray-400 mt-1">To change your login e-mail, contact your agent.</span>
      </Field>
      {status && <p className={status.ok ? 'text-sm text-green-700' : 'text-sm text-red-600'} role="status">{status.text}</p>}
      <button type="submit" disabled={form.formState.isSubmitting} className={buttonCls}>
        {form.formState.isSubmitting ? 'Saving…' : 'Save details'}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const form = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const e = form.formState.errors;
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        setStatus(null);
        try {
          await api.post('/auth/password', values);
          form.reset();
          setStatus({ ok: true, text: 'Password changed. Other devices have been signed out.' });
        } catch (err) {
          if (err instanceof ApiError && err.fields) for (const [k, v] of Object.entries(err.fields)) if (k in values) form.setError(k as keyof typeof values, { message: v[0] });
          setStatus({ ok: false, text: errorMessage(err) });
        }
      })}
    >
      <Field label="Current password" error={e.currentPassword?.message}>
        <input {...form.register('currentPassword')} type="password" className={inputCls} autoComplete="current-password" />
      </Field>
      <Field label="New password" error={e.newPassword?.message}>
        <input {...form.register('newPassword')} type="password" className={inputCls} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" error={e.confirmPassword?.message}>
        <input {...form.register('confirmPassword')} type="password" className={inputCls} autoComplete="new-password" />
      </Field>
      {status && <p className={status.ok ? 'text-sm text-green-700' : 'text-sm text-red-600'} role="status">{status.text}</p>}
      <button type="submit" disabled={form.formState.isSubmitting} className={buttonCls}>
        {form.formState.isSubmitting ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}

export default function PortalAccountPage() {
  const state = usePortal<{ user: AuthUser; profile: PortalOverview['client'] }>('/portal/account');
  return (
    <>
      <PageTitle title="Account" description="Your contact details and password." />
      <Section state={state}>
        {({ user, profile }) => (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="font-bold text-gray-900 mb-4">Contact details</h2>
              <ProfileForm name={profile.fullName} phone={profile.phone} email={user.email} />
            </Card>
            <Card className="p-6">
              <h2 className="font-bold text-gray-900 mb-4">Password</h2>
              <PasswordForm />
            </Card>
          </div>
        )}
      </Section>
    </>
  );
}
