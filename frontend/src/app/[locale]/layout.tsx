import type { Metadata } from "next";
import { Cairo, Work_Sans } from "next/font/google";
import "@/app/globals.css";
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ChatbotWidget from '@/components/chatbot/ChatbotWidget';
import { AuthProvider } from '@/lib/AuthContext';

const workSans = Work_Sans({ 
  subsets: ["latin"],
  variable: '--font-work-sans'
});

const cairo = Cairo({ 
  subsets: ["arabic"],
  variable: '--font-cairo'
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isRtl = locale === 'ar';

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    ),
    title: {
      default: "ELITE Real Estate | Elevating the Way You Live",
      template: "%s | ELITE Real Estate Qatar"
    },
    description: "Qatar's premier luxury real estate agency. Discover exclusive apartments, villas, and penthouses in The Pearl, West Bay, and Lusail.",
    keywords: ["Real Estate Qatar", "Luxury Apartments Doha", "The Pearl Qatar Properties", "Lusail Real Estate", "Elite Real Estate"],
    authors: [{ name: "ELITE Real Estate" }],
    openGraph: {
      type: "website",
      locale: isRtl ? "ar_QA" : "en_QA",
      url: "https://elitere.qa",
      siteName: "ELITE Real Estate",
      images: [{
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ELITE Real Estate Luxury Properties"
      }],
    },
  };
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // Validate locale against the shared routing config
  if (!hasLocale(routing.locales, locale)) notFound();

  // Opt into static rendering for this locale
  setRequestLocale(locale);

  // Get messages
  const messages = await getMessages();

  const isRtl = locale === 'ar';

  return (
    // data-scroll-behavior lets Next 16 suppress smooth scrolling during route
    // transitions while keeping it for in-page anchor links.
    <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} data-scroll-behavior="smooth">
      <body className={`${workSans.variable} ${cairo.variable} font-sans`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              <div className="flex-grow">
                {children}
              </div>
              <Footer />
              <ChatbotWidget />
            </div>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
