import React, { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SearchX, WifiOff } from 'lucide-react';
import PropertyCard from '@/components/properties/PropertyCard';
import ListingFilters from '@/components/listings/ListingFilters';
import { getListings } from '@/lib/listings';

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** All published listings from the CRM, with filters, sorting and pagination in the URL. */
export default async function PropertiesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'listings' });
  const query = {
    q: one(sp.q),
    purpose: one(sp.purpose),
    category: one(sp.category),
    type: one(sp.type),
    area: one(sp.area),
    beds: one(sp.beds),
    priceMin: one(sp.priceMin),
    priceMax: one(sp.priceMax),
    sort: one(sp.sort),
    page: one(sp.page),
    pageSize: 12,
  };
  const result = await getListings(query);

  const pageHref = (page: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== 'pageSize' && k !== 'page') next.set(k, String(v));
    if (page > 1) next.set('page', String(page));
    return `/${locale}/properties${next.toString() ? `?${next}` : ''}`;
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-12 pt-24">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-secondary">{t('title')}</h1>
          {result && <p className="mt-1 text-gray-500">{t('results', { count: result.total })}</p>}
        </div>

        <Suspense>
          <ListingFilters areas={result?.facets.areas ?? []} />
        </Suspense>

        {!result ? (
          <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-12 text-center" role="alert">
            <WifiOff className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
            <p className="mt-3 font-bold text-secondary">{t('error_title')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('error_body')}</p>
          </div>
        ) : result.items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-12 text-center">
            <SearchX className="mx-auto h-8 w-8 text-gray-400" aria-hidden="true" />
            <p className="mt-3 font-bold text-secondary">{t('no_results')}</p>
            <p className="mt-1 text-sm text-gray-500">{t('no_results_body')}</p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {result.items.map((property) => (
                <PropertyCard key={property._id} property={property} />
              ))}
            </div>
            {result.pageCount > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
                {result.page > 1 && (
                  <Link href={pageHref(result.page - 1)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:border-primary">
                    {t('prev')}
                  </Link>
                )}
                <span className="text-sm text-gray-500">{t('page_of', { page: result.page, pages: result.pageCount })}</span>
                {result.page < result.pageCount && (
                  <Link href={pageHref(result.page + 1)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:border-primary">
                    {t('next')}
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
