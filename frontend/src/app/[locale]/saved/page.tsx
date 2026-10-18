import { setRequestLocale } from 'next-intl/server';
import SavedHomesView from '@/components/listings/SavedHomesView';

type PageParams = { locale: string };

export const metadata = {
  title: 'Saved homes',
  robots: { index: false, follow: true },
};

export default async function SavedHomesPage({ params }: { params: Promise<PageParams> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="bg-gray-50 pb-20 pt-28">
      <div className="container mx-auto px-4">
        <SavedHomesView />
      </div>
    </main>
  );
}
