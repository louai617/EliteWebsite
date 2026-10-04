import { redirect } from 'next/navigation';

/** "My properties" became "Saved homes" (the same CRM shortlist, with price alerts). */
export default async function PropertiesRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/saved`);
}
