import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Building2, Store, LandPlot, Hotel, ShoppingBag, GraduationCap,
  ShieldCheck, Eye, Sparkles, Phone, MapPin, Globe, ArrowRight, Target,
} from 'lucide-react';

import { company, pick, type Sector } from '@/data/company';

type PageParams = { locale: string };

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });

  return {
    title: t('title'),
    description: pick(company.about[0], locale),
  };
}

const SECTOR_ICONS: Record<Sector['key'], React.ComponentType<{ className?: string }>> = {
  residential: Building2,
  commercial: Store,
  land: LandPlot,
  hotels: Hotel,
  malls: ShoppingBag,
  schools: GraduationCap,
};

const VALUE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  trust: ShieldCheck,
  transparency: Eye,
  quality: Sparkles,
};

/**
 * Gold-to-transparent banner behind a section title — the signature motif of
 * the printed company profile, reused here so the site reads as the same brand.
 */
function BannerHeading({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className="relative mb-8 -mx-4 px-4 sm:mx-0 sm:px-0">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 start-0 w-full max-w-lg bg-gradient-to-r from-primary/90 to-transparent rtl:bg-gradient-to-l"
      />
      <h2
        className={`relative py-3 ps-4 text-2xl font-bold tracking-tight md:text-3xl ${
          dark ? 'text-white' : 'text-white'
        }`}
      >
        {children}
      </h2>
    </div>
  );
}

export default async function AboutPage({ params }: { params: Promise<PageParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'about' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  const name = pick(company.name, locale);

  return (
    <main className="min-h-screen bg-secondary text-white">
      {/* ---------- Hero ---------- */}
      <section className="relative flex min-h-[70vh] items-center overflow-hidden pt-20">
        <Image
          src="https://images.unsplash.com/photo-1541339907198-e08759dfc3ef?q=80&w=2000&auto=format&fit=crop"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-secondary via-secondary/85 to-secondary/40 rtl:bg-gradient-to-l"
        />

        <div className="container relative mx-auto px-4 py-20">
          <div className="max-w-2xl">
            <div className="mb-8 flex items-center gap-4">
              <div className="relative h-16 w-16 flex-none">
                <Image src="/logo.png" alt={name} fill sizes="64px" className="object-contain" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-[0.3em] text-primary">ELITE</p>
                <p className="text-xs tracking-[0.4em] text-white/60">REAL ESTATE</p>
              </div>
            </div>

            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              {t('eyebrow')}
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              {pick(company.tagline, locale)}
            </h1>
            {/* A credential line rather than prose — the opening About paragraph
                appears in full immediately below, and repeating it reads badly. */}
            <dl className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 text-sm">
              <div>
                <dt className="text-white/50">{t('hero_experience')}</dt>
                <dd className="mt-1 text-lg font-bold text-primary">
                  {company.yearsOfExperience}+
                </dd>
              </div>
              <div>
                <dt className="text-white/50">{t('hero_sectors')}</dt>
                <dd className="mt-1 text-lg font-bold text-primary">{company.sectors.length}</dd>
              </div>
              <div>
                <dt className="text-white/50">{t('hero_based')}</dt>
                <dd className="mt-1 text-lg font-bold text-primary">
                  {[pick(company.contact.city, locale), pick(company.contact.country, locale)].join(
                    locale === 'ar' ? '، ' : ', '
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* ---------- About ---------- */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <BannerHeading>{t('title')}</BannerHeading>

          <div className="grid gap-12 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {company.about.map((paragraph, index) => (
                <p key={index} className="text-[17px] leading-relaxed text-white/70">
                  {pick(paragraph, locale)}
                </p>
              ))}
            </div>

            {/* Only figures the profile actually states. */}
            <aside className="space-y-4">
              <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 to-transparent p-8">
                <p className="text-5xl font-bold tracking-tight text-primary">
                  {company.yearsOfExperience}+
                </p>
                <p className="mt-2 text-sm text-white/60">{t('years_label')}</p>
              </div>

              <div className="rounded-2xl border border-white/10 p-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/40">
                  {t('services_label')}
                </p>
                <ul className="space-y-2.5">
                  {company.services.map((service) => (
                    <li key={service.key} className="flex items-center gap-2.5 text-sm text-white/80">
                      <span className="h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-hidden="true" />
                      {pick(service.label, locale)}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ---------- Vision & Mission ---------- */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 md:p-10">
              <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Eye className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mb-4 text-2xl font-bold md:text-3xl">{t('vision')}</h2>
              <p className="text-[17px] leading-relaxed text-white/70">
                {pick(company.vision, locale)}
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 md:p-10">
              <span className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Target className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mb-4 text-2xl font-bold md:text-3xl">{t('mission')}</h2>
              <p className="text-[17px] leading-relaxed text-white/70">
                {pick(company.mission, locale)}
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ---------- Goals ---------- */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <BannerHeading>{t('goals')}</BannerHeading>

          <ol className="grid gap-x-12 gap-y-2 md:grid-cols-2">
            {company.goals.map((goal, index) => (
              <li
                key={goal.key}
                className="flex gap-5 border-b border-white/5 py-6 last:border-0 md:last:border-b"
              >
                <span className="text-2xl font-bold tabular-nums text-primary/40">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="pt-1 leading-relaxed text-white/75">{pick(goal.text, locale)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Sectors ---------- */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t('sectors')}</h2>
          <p className="mb-10 mt-3 max-w-2xl text-white/60">{t('sectors_sub')}</p>

          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {company.sectors.map((sector) => {
              const Icon = SECTOR_ICONS[sector.key];
              return (
                <li
                  key={sector.key}
                  className="group rounded-2xl border border-white/10 p-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Icon
                    className="mx-auto mb-4 h-7 w-7 text-primary transition-transform group-hover:scale-110"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-white/85">{pick(sector.label, locale)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------- Values ---------- */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-2xl font-bold tracking-tight md:text-3xl">{t('values')}</h2>

          <div className="grid gap-10 md:grid-cols-3">
            {company.values.map((value) => {
              const Icon = VALUE_ICONS[value.key] ?? Sparkles;
              return (
                <div key={value.key}>
                  <Icon className="mb-5 h-8 w-8 text-primary" aria-hidden="true" />
                  <h3 className="mb-3 text-xl font-bold">{pick(value.label, locale)}</h3>
                  <p className="leading-relaxed text-white/60">{pick(value.text, locale)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Contact ---------- */}
      <section className="border-t border-white/5 py-20 md:py-28">
        <div className="container mx-auto px-4">
          <BannerHeading>{t('contact')}</BannerHeading>

          <div className="grid gap-10 lg:grid-cols-3">
            <div>
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {t('call')}
              </p>
              <ul className="space-y-2">
                {company.contact.phones.map((phone, index) => (
                  <li key={phone}>
                    <a
                      href={`tel:${company.contact.phonesRaw[index]}`}
                      dir="ltr"
                      className="text-lg font-semibold transition-colors hover:text-primary"
                    >
                      {phone}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {t('visit')}
              </p>
              <p className="text-lg leading-relaxed text-white/85">
                {pick(company.contact.address, locale)}
              </p>
            </div>

            <div>
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                <Globe className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {t('online')}
              </p>
              <a
                href={company.contact.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="text-lg font-semibold transition-colors hover:text-primary"
              >
                {company.contact.website}
              </a>

              <Link
                href={`/${locale}/properties`}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-bold text-secondary transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
              >
                {tCommon('properties')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
