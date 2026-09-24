'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { Calendar, Heart, Loader2, LogOut, MessageSquare } from 'lucide-react';
import api, { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

interface Overview {
  enquiries: {
    _id: string;
    created_at: string;
    status: 'received' | 'in_progress' | 'completed' | 'closed';
    properties: { _id: string; title_en: string; title_ar?: string; reference_number: string }[];
  }[];
  viewings: {
    _id: string;
    scheduled_at: string;
    status: string;
    property?: { _id: string; title_en: string; title_ar?: string; location?: { area_en?: string } };
  }[];
  saved: {
    _id: string;
    title_en: string;
    title_ar?: string;
    price: number;
    currency: string;
    price_frequency?: string;
    purpose: string;
    images: string[];
    location?: { area_en?: string };
  }[];
}

const STATUS_STYLES: Record<Overview['enquiries'][number]['status'], string> = {
  received: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-600',
};

/** Website customer area: enquiries, upcoming viewings and saved listings. */
export default function AccountPage() {
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const { user, loading, logout } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .get<{ data: Overview }>('/account/overview')
      .then(({ data: res }) => setData(res.data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, [user]);

  if (loading || (user && !data && !error)) {
    return (
      <main className="flex min-h-screen items-center justify-center pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-[#b98f42]" />
      </main>
    );
  }

  const title = (item: { title_en: string; title_ar?: string }) => (isRtl && item.title_ar) || item.title_en;

  return (
    <main className="min-h-screen bg-gray-50 pb-16 pt-28">
      <div className="container mx-auto max-w-5xl space-y-8 px-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Hello, {user?.full_name.split(' ')[0]}</h1>
            <p className="mt-1 text-gray-500">Your enquiries, viewings and saved properties.</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 font-bold text-gray-700 transition hover:border-red-200 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

        {data && (
          <>
            <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
                <Heart className="h-5 w-5 text-[#b98f42]" /> Saved Properties
              </h2>
              {data.saved.length === 0 ? (
                <p className="text-gray-500">
                  Nothing saved yet.{' '}
                  <Link href={`/${locale}/properties`} className="font-bold text-[#b98f42] hover:underline">Browse properties</Link>
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.saved.map((p) => (
                    <Link key={p._id} href={`/${locale}/properties/${p._id}`} className="group overflow-hidden rounded-xl border border-gray-100 transition hover:shadow-lg">
                      <div className="relative h-36 bg-gray-100">
                        {p.images[0] && <Image src={p.images[0]} alt={title(p)} fill sizes="300px" className="object-cover" />}
                      </div>
                      <div className="p-4">
                        <p className="truncate font-bold text-gray-900 group-hover:text-[#b98f42]">{title(p)}</p>
                        <p className="text-sm text-gray-500">{p.location?.area_en}</p>
                        <p className="mt-1 font-bold text-gray-900">
                          {p.price.toLocaleString()} {p.currency}
                          {p.purpose === 'rent' && p.price_frequency ? <span className="text-sm text-gray-400"> /{p.price_frequency}</span> : null}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <div className="grid gap-8 md:grid-cols-2">
              <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
                  <MessageSquare className="h-5 w-5 text-[#b98f42]" /> My Enquiries
                </h2>
                {data.enquiries.length === 0 && <p className="text-gray-500">You have not sent any enquiries while signed in.</p>}
                <ul className="space-y-4">
                  {data.enquiries.map((e) => (
                    <li key={e._id} className="flex items-start justify-between gap-4 border-b border-gray-50 pb-4 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-gray-900">{e.properties[0] ? title(e.properties[0]) : 'General enquiry'}</p>
                        <p className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString(locale)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[e.status]}`}>
                        {e.status.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-900">
                  <Calendar className="h-5 w-5 text-[#b98f42]" /> Upcoming Viewings
                </h2>
                {data.viewings.length === 0 && <p className="text-gray-500">No viewings scheduled.</p>}
                <ul className="space-y-4">
                  {data.viewings.map((v) => (
                    <li key={v._id} className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-gray-900">{v.property ? title(v.property) : ''}</p>
                        <p className="text-sm text-gray-500">{v.property?.location?.area_en}</p>
                      </div>
                      <p className="shrink-0 text-right text-sm font-bold text-gray-900">
                        {new Date(v.scheduled_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
