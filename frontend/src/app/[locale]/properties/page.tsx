import React from 'react';
import PropertyCard from '@/components/properties/PropertyCard';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { properties } from '@/data/properties';

export default async function PropertiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <main className="min-h-screen bg-gray-50 pb-12 pt-24">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-secondary">{t('properties')}</h1>
            <p className="mt-1 text-gray-500">
              {properties.length} {t('properties')}
            </p>
          </div>

          <select
            aria-label={t('search')}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 outline-none transition focus:border-primary"
          >
            <option value="newest">Newest First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard key={property._id} property={property} />
          ))}
        </div>
      </div>
    </main>
  );
}
