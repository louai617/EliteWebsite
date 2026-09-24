import React, { Suspense } from 'react';
import Link from 'next/link';
import PropertyCard from '@/components/properties/PropertyCard';
import SortSelect from '@/components/properties/SortSelect';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listPublicProperties, type PublicSort } from '@/lib/server/services/publicProperties';

const SORTS: PublicSort[] = ['newest', 'price-low', 'price-high'];
const PAGE_SIZE = 24;

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'common' });

  const query = await searchParams;
  const sort = SORTS.includes(query.sort as PublicSort) ? (query.sort as PublicSort) : 'newest';
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const { items: properties, total, page, pages } = await listPublicProperties({
    sort,
    page: requestedPage,
    limit: PAGE_SIZE,
  });

  const pageHref = (target: number) => `/${locale}/properties?sort=${sort}&page=${target}`;

  return (
    <main className="min-h-screen bg-gray-50 pb-12 pt-24">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-secondary">{t('properties')}</h1>
            <p className="mt-1 text-gray-500">
              {total} {t('properties')}
            </p>
          </div>

          <Suspense>
            <SortSelect label={t('search')} value={sort} />
          </Suspense>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard key={property._id} property={property} />
          ))}
        </div>

        {pages > 1 && (
          <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition hover:border-primary hover:text-primary"
              >
                ←
              </Link>
            )}
            <span className="px-4 py-2 text-sm font-medium text-gray-500">
              {page} / {pages}
            </span>
            {page < pages && (
              <Link
                href={pageHref(page + 1)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600 transition hover:border-primary hover:text-primary"
              >
                →
              </Link>
            )}
          </nav>
        )}
      </div>
    </main>
  );
}
