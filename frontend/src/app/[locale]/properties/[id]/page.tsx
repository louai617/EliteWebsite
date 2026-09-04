import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  MapPin, Bed, Bath, Maximize, Car, Building2, CalendarDays, Key, ShieldCheck,
  Sparkles, ChevronRight, ExternalLink, GraduationCap, ShoppingBag, Umbrella,
  Plane, Stethoscope, TrainFront, Landmark, Layers, Hammer, Wallet, Ruler,
} from 'lucide-react';

import {
  properties, getPropertyById, getSimilarProperties,
  pricePerSqm, priceVsMarket, sizeVsMarket,
  type Property, type NearbyPlace,
} from '@/data/properties';

import PropertyGallery from '@/components/properties/detail/PropertyGallery';
import PropertyNav from '@/components/properties/detail/PropertyNav';
import ExpandableText from '@/components/properties/detail/ExpandableText';
import AmenitiesGrid from '@/components/properties/detail/AmenitiesGrid';
import PriceTrendsChart from '@/components/properties/detail/PriceTrendsChart';
import MortgageCalculator from '@/components/properties/detail/MortgageCalculator';
import MarketComparison from '@/components/properties/detail/MarketComparison';
import AgentPanel from '@/components/properties/detail/AgentPanel';
import StickyContactBar from '@/components/properties/detail/StickyContactBar';
import LeadForm from '@/components/properties/LeadForm';
import PropertyCard from '@/components/properties/PropertyCard';

type PageParams = { locale: string; id: string };

export function generateStaticParams() {
  return properties.map((property) => ({ id: property._id }));
}

/**
 * The listing set is a known, finite list, so anything outside it is a genuine
 * 404. Without this, an unknown id streams a 200 response before `notFound()`
 * can influence the status code.
 */
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale, id } = await params;
  const property = getPropertyById(id);
  if (!property) return { title: 'Property not found' };

  const isRtl = locale === 'ar';
  const title = isRtl ? property.title_ar : property.title_en;
  const description = (isRtl ? property.description_ar : property.description_en)
    .split('\n\n')[0]
    .slice(0, 160);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: property.images[0], width: 1200, height: 630, alt: title }],
    },
  };
}

const PLACE_ICONS: Record<NearbyPlace['category'], React.ComponentType<{ className?: string }>> = {
  school: GraduationCap,
  mall: ShoppingBag,
  beach: Umbrella,
  airport: Plane,
  hospital: Stethoscope,
  metro: TrainFront,
  landmark: Landmark,
};

/** Section shell — the scroll-margin keeps anchors clear of the sticky nav. */
function Section({
  id,
  title,
  children,
  className = '',
}: {
  id: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-36 ${className}`}>
      {title && <h2 className="mb-5 text-xl font-bold text-secondary md:text-2xl">{title}</h2>}
      {children}
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 py-3.5 last:border-0">
      <Icon className="h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
      <dt className="flex-1 text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-semibold text-secondary">{value}</dd>
    </div>
  );
}

/**
 * Property detail page.
 *
 * Rendered on the server from the shared dataset so it prerenders per locale;
 * only the gallery, charts, calculator and contact controls ship as client
 * components.
 */
export default async function PropertyDetailPage({ params }: { params: Promise<PageParams> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const property = getPropertyById(id);
  if (!property) notFound();

  const t = await getTranslations({ locale, namespace: 'property' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const isRtl = locale === 'ar';

  const title = isRtl ? property.title_ar : property.title_en;
  const description = isRtl ? property.description_ar : property.description_en;
  const area = isRtl ? property.location.area_ar : property.location.area_en;
  const city = isRtl ? property.location.city_ar : property.location.city_en;
  const community = isRtl ? property.location.community_ar : property.location.community_en;
  const address = isRtl ? property.location.address_ar : property.location.address_en;
  const developer = isRtl ? property.developer_ar : property.developer_en;

  const priceLabel = `${property.price.toLocaleString()} ${property.currency}`;
  const frequencySuffix = property.price_frequency
    ? t(property.price_frequency === 'month' ? 'per_month' : 'per_year')
    : '';

  // Rentals are quoted per year per m² once annualised, so the unit differs.
  const perSqmUnit = property.price_frequency
    ? t('trends_axis_rent')
    : t('trends_axis');

  const priceDelta = priceVsMarket(property);
  const sizeDelta = sizeVsMarket(property);
  const similar = getSimilarProperties(property._id);

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${property.location.lat},${property.location.lng}`;

  // Rentals get neither a mortgage calculator nor a construction payment plan,
  // so the section — and its nav entry — drop out entirely.
  const showPayment = property.purpose === 'sale';

  const sections = [
    { id: 'overview', labelKey: 'nav_overview' },
    { id: 'details', labelKey: 'nav_details' },
    { id: 'amenities', labelKey: 'nav_amenities' },
    { id: 'trends', labelKey: 'nav_trends' },
    { id: 'location', labelKey: 'nav_location' },
    ...(showPayment ? [{ id: 'payment', labelKey: 'nav_payment' }] : []),
    { id: 'similar', labelKey: 'nav_similar' },
  ];

  // Structured data so listings surface correctly in search results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: title,
    description: description.split('\n\n')[0],
    url: `https://elitere.qa/${locale}/properties/${property._id}`,
    image: property.images.slice(0, 5),
    datePosted: new Date(Date.now() - property.listed_days_ago * 86_400_000).toISOString(),
    offers: {
      '@type': 'Offer',
      price: property.price,
      priceCurrency: property.currency,
      availability: 'https://schema.org/InStock',
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressLocality: city,
      addressCountry: 'QA',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: property.location.lat,
      longitude: property.location.lng,
    },
    numberOfBedrooms: property.bedrooms,
    numberOfBathroomsTotal: property.bathrooms,
    floorSize: { '@type': 'QuantitativeValue', value: property.area_sqm, unitCode: 'MTK' },
  };

  return (
    <main className="min-h-screen bg-white pb-24 pt-20 lg:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-sm text-gray-400">
          <Link href={`/${locale}`} className="transition hover:text-primary">
            {tCommon('home')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          <Link href={`/${locale}/properties`} className="transition hover:text-primary">
            {tCommon('properties')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
          <span className="truncate font-medium text-gray-600">{area}</span>
        </nav>

        <PropertyGallery images={property.images} title={title} />

        {/* Headline block */}
        <header className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  property.purpose === 'sale'
                    ? 'bg-secondary text-white'
                    : 'bg-primary text-white'
                }`}
              >
                {property.purpose === 'sale' ? t('for_sale') : t('for_rent')}
              </span>
              {property.is_verified && (
                <span
                  title={t('verified_tooltip')}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('verified')}
                </span>
              )}
              {property.is_exclusive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('exclusive')}
                </span>
              )}
              <span className="text-xs text-gray-400">
                {property.listed_days_ago === 0
                  ? t('listed_today')
                  : t('listed_days', { days: property.listed_days_ago })}
              </span>
            </div>

            <h1 className="text-2xl font-bold leading-tight tracking-tight text-secondary md:text-4xl">
              {title}
            </h1>

            <p className="mt-2.5 flex items-center gap-1.5 text-gray-500">
              <MapPin className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
              <span className="text-sm md:text-base">
                {community}, {area}, {city}
              </span>
            </p>
          </div>

          <div className="flex-none lg:text-end">
            <p className="text-3xl font-bold tracking-tight text-secondary md:text-4xl">
              {property.price.toLocaleString()}
              <span className="ms-2 text-lg font-semibold text-primary">{property.currency}</span>
              {frequencySuffix && (
                <span className="text-lg font-medium text-gray-400">{frequencySuffix}</span>
              )}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {t('price_per_sqm')} · {pricePerSqm(property).toLocaleString()} {perSqmUnit}
            </p>
          </div>
        </header>

        {/* Key facts strip */}
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-100 bg-gray-100 sm:grid-cols-4">
          {[
            { icon: Bed, label: t('beds'), value: String(property.bedrooms) },
            { icon: Bath, label: t('baths'), value: String(property.bathrooms) },
            {
              icon: Maximize,
              label: t('area'),
              value: `${property.area_sqm} ${tCommon('sqm')}`,
            },
            {
              icon: Building2,
              label: t('property_type'),
              value: t(`type_${property.type}`),
            },
          ].map((fact) => (
            <div key={fact.label} className="flex items-center gap-3 bg-white px-4 py-4">
              <fact.icon className="h-5 w-5 flex-none text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs text-gray-500">{fact.label}</dt>
                <dd className="truncate font-bold text-secondary">{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <PropertyNav sections={sections} />

        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
          {/* ---------------- Main column ---------------- */}
          <div className="space-y-12 lg:col-span-2">
            <Section id="overview" title={tCommon('description')}>
              {property.highlights.length > 0 && (
                <ul className="mb-6 flex flex-wrap gap-2">
                  {property.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary"
                    >
                      {t(`highlight_${highlight}`)}
                    </li>
                  ))}
                </ul>
              )}
              <ExpandableText text={description} />
            </Section>

            <Section id="details" title={t('property_details')}>
              <dl className="grid gap-x-10 sm:grid-cols-2">
                <DetailRow icon={Building2} label={t('property_type')} value={t(`type_${property.type}`)} />
                <DetailRow icon={Layers} label={t('furnishing')} value={t(`furnishing_${property.furnishing}`)} />
                <DetailRow
                  icon={Maximize}
                  label={t('area')}
                  value={`${property.area_sqm} ${tCommon('sqm')}`}
                />
                {property.plot_sqm && (
                  <DetailRow
                    icon={Ruler}
                    label={t('plot_area')}
                    value={`${property.plot_sqm} ${tCommon('sqm')}`}
                  />
                )}
                {property.floor && property.total_floors && (
                  <DetailRow
                    icon={Layers}
                    label={t('floor_level')}
                    value={t('floor_of', { floor: property.floor, total: property.total_floors })}
                  />
                )}
                <DetailRow
                  icon={Car}
                  label={t('parking')}
                  value={t('parking_spaces', { count: property.parking })}
                />
                <DetailRow
                  icon={Hammer}
                  label={t('completion_status')}
                  value={t(`completion_${property.completion}`)}
                />
                {property.handover && (
                  <DetailRow icon={CalendarDays} label={t('handover')} value={property.handover} />
                )}
                <DetailRow icon={Key} label={t('ownership')} value={t(`ownership_${property.ownership}`)} />
                <DetailRow
                  icon={CalendarDays}
                  label={t('available_from')}
                  value={new Date(property.available_from).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                />
                {property.year_built && (
                  <DetailRow icon={Hammer} label={t('year_built')} value={String(property.year_built)} />
                )}
                {developer && <DetailRow icon={Building2} label={t('developer')} value={developer} />}
                {property.service_charge_sqm && (
                  <DetailRow
                    icon={Wallet}
                    label={t('service_charge')}
                    value={`${property.service_charge_sqm} ${t('service_charge_unit')}`}
                  />
                )}
              </dl>
            </Section>

            <Section id="amenities" title={tCommon('amenities')}>
              <AmenitiesGrid amenities={property.amenities} />
            </Section>

            <Section id="trends" title={t('trends_title')}>
              <p className="-mt-2 mb-6 text-sm text-gray-500">
                {t('trends_subtitle', {
                  beds: property.bedrooms,
                  type: t(`type_${property.type}`).toLowerCase(),
                  community,
                  city,
                })}
              </p>

              <div className="rounded-2xl border border-gray-100 p-5 md:p-6">
                <PriceTrendsChart
                  history={property.market.price_history}
                  communityLabel={community}
                  cityLabel={t('trends_city', { city })}
                  axisLabel={perSqmUnit}
                />
              </div>

              <h3 className="mb-4 mt-8 text-base font-bold text-secondary">
                {t('comparison_title')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <MarketComparison
                  label={
                    priceDelta > 0
                      ? t('costs_more', { percent: Math.abs(priceDelta) })
                      : priceDelta < 0
                        ? t('costs_less', { percent: Math.abs(priceDelta) })
                        : t('costs_same')
                  }
                  value={property.price}
                  average={property.market.avg_price}
                  delta={priceDelta}
                  unit={property.currency}
                  thisLabel={t('this_property')}
                  averageLabel={t('community_average')}
                />
                <MarketComparison
                  label={
                    sizeDelta > 0
                      ? t('is_bigger', { percent: Math.abs(sizeDelta) })
                      : sizeDelta < 0
                        ? t('is_smaller', { percent: Math.abs(sizeDelta) })
                        : t('is_same_size')
                  }
                  value={property.area_sqm}
                  average={property.market.avg_size_sqm}
                  delta={sizeDelta}
                  unit={tCommon('sqm')}
                  thisLabel={t('this_property')}
                  averageLabel={t('community_average')}
                />
              </div>
            </Section>

            <Section id="location" title={t('location_title')}>
              <p className="-mt-2 mb-5 flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
                {address}
              </p>

              <div className="relative mb-6 h-64 overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 to-gray-100 md:h-80">
                {/* Decorative grid standing in for the map tile layer. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-[0.35]"
                  style={{
                    backgroundImage:
                      'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <span className="relative flex h-12 w-12 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
                    <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-lg">
                      <MapPin className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </span>
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-secondary shadow-md transition hover:bg-gray-50"
                  >
                    {t('get_directions')}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <h3 className="mb-4 text-base font-bold text-secondary">{t('nearby_title')}</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {property.nearby.map((place) => {
                  const Icon = PLACE_ICONS[place.category];
                  return (
                    <li
                      key={place.name_en}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3"
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gray-50 text-primary">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-secondary">
                          {isRtl ? place.name_ar : place.name_en}
                        </p>
                        <p className="text-xs text-gray-400">{t(`place_${place.category}`)}</p>
                      </div>
                      <span className="flex-none text-xs font-semibold text-gray-500">
                        {place.mode === 'walk'
                          ? t('minutes_walk', { minutes: place.minutes })
                          : t('minutes_drive', { minutes: place.minutes })}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* Community snapshot */}
              <div className="mt-8 rounded-2xl bg-gray-50 p-6">
                <h3 className="mb-4 text-base font-bold text-secondary">
                  {t('community_title', { community })}
                </h3>
                <dl className="grid grid-cols-3 gap-4">
                  <div>
                    <dt className="text-xs text-gray-500">{t('community_buildings')}</dt>
                    <dd className="mt-1 text-xl font-bold text-secondary">
                      {property.market.community_buildings}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">{t('community_listings')}</dt>
                    <dd className="mt-1 text-xl font-bold text-secondary">
                      {property.market.community_listings.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">{t('community_avg_price')}</dt>
                    <dd className="mt-1 text-xl font-bold text-secondary">
                      {(property.market.avg_price / 1_000_000).toFixed(1)}M
                    </dd>
                  </div>
                </dl>
              </div>
            </Section>

            {/* The calculator carries its own heading, so only the plan needs one. */}
            {showPayment && (
            <Section id="payment" title={property.payment_plan ? t('payment_plan_title') : undefined}>
              {property.payment_plan && (
                <>
                  <p className="-mt-2 mb-6 text-sm text-gray-500">{t('payment_plan_subtitle')}</p>
                  <ol className="relative space-y-5 border-s-2 border-gray-100 ps-6">
                    {property.payment_plan.map((milestone) => (
                      <li key={milestone.key} className="relative">
                        <span className="absolute -start-[1.9rem] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary bg-white" />
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-semibold text-secondary">
                            {t(`milestone_${milestone.key}`)}
                          </p>
                          <p className="text-lg font-bold text-primary">{milestone.percent}%</p>
                        </div>
                        <p className="text-sm text-gray-500">
                          {isRtl ? milestone.timing_ar : milestone.timing_en} ·{' '}
                          {Math.round((property.price * milestone.percent) / 100).toLocaleString()}{' '}
                          {property.currency}
                        </p>
                      </li>
                    ))}
                  </ol>
                  <p className="mb-4 mt-10 text-sm text-gray-500">{t('mortgage_after_handover')}</p>
                </>
              )}
              <MortgageCalculator price={property.price} currency={property.currency} />
            </Section>
            )}

            <Section id="similar" title={tCommon('similar_properties')}>
              <div className="grid gap-6 sm:grid-cols-2">
                {similar.map((item: Property) => (
                  <PropertyCard key={item._id} property={item} />
                ))}
              </div>
            </Section>

            {/* Regulatory footer */}
            <div className="rounded-2xl bg-gray-50 p-6">
              <h3 className="mb-4 text-sm font-bold text-secondary">{t('regulatory_title')}</h3>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-gray-500">{tCommon('reference')}</dt>
                  <dd className="font-mono font-medium text-secondary">
                    {property.reference_number}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('listed_on')}</dt>
                  <dd className="font-medium text-secondary">
                    {property.listed_days_ago === 0
                      ? t('today')
                      : t('days_ago', { days: property.listed_days_ago })}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">{t('ownership')}</dt>
                  <dd className="font-medium text-secondary">
                    {t(`ownership_${property.ownership}`)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* ---------------- Sidebar ---------------- */}
          <aside className="lg:col-span-1">
            <div className="space-y-6 lg:sticky lg:top-36">
              <AgentPanel
                agent={property.agent}
                propertyId={property._id}
                shareTitle={title}
              />
              <LeadForm propertyId={property._id} />
            </div>
          </aside>
        </div>
      </div>

      <StickyContactBar
        phone={property.agent.phone}
        whatsapp={property.agent.whatsapp}
        price={`${priceLabel}${frequencySuffix}`}
        shareTitle={title}
      />
    </main>
  );
}
