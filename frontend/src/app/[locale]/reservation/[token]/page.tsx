import { setRequestLocale } from 'next-intl/server';
import ReservationView from '@/components/listings/ReservationView';

type PageParams = { locale: string; token: string };

/** Private page: never indexed, and the link (which carries the token) is never sent as a referrer. */
export const metadata = {
  title: 'Your reservation',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ReservationPage({ params }: { params: Promise<PageParams> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return (
    <main className="bg-gray-50 pb-20 pt-28">
      <div className="container mx-auto max-w-5xl px-4">
        <ReservationView token={decodeURIComponent(token)} />
      </div>
    </main>
  );
}
