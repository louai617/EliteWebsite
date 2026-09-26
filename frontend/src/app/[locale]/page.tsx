import React from 'react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import PropertyCard from '@/components/properties/PropertyCard';
import { properties } from '@/data/properties';

const featuredProperties = properties.filter((property) => property.is_featured);

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'hero' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center bg-black overflow-hidden">
        <Image 
          src="/hero.svg" 
          alt="Luxury Real Estate Qatar" 
          fill
          sizes="100vw"
          priority 
          className="object-cover opacity-60"
        />
        
        <div className="relative z-10 text-center text-white px-4 max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {t('title')}
          </h1>
          <p className="text-xl md:text-2xl mb-10 opacity-90 font-light animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {t('subtitle')}
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <Link href={`/${locale}/properties`} className="bg-[#b98f42] text-white px-10 py-4 rounded font-bold text-lg hover:bg-white hover:text-black transition-all duration-300">
              Explore Properties
            </Link>
            <Link href={`/${locale}/contact`} className="bg-transparent border-2 border-white text-white px-10 py-4 rounded font-bold text-lg hover:bg-white hover:text-black transition-all duration-300">
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Properties Section */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">Featured Properties</h2>
              <div className="w-20 h-1 bg-[#b98f42]"></div>
            </div>
            <Link href={`/${locale}/properties`} className="text-[#b98f42] font-bold text-lg hover:underline">
              View All Properties →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProperties.map((property) => (
              <PropertyCard key={property._id} property={property} />
            ))}
          </div>
        </div>
      </section>

      {/* Why ELITE Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Why ELITE Real Estate?</h2>
          <div className="w-24 h-1 bg-[#b98f42] mx-auto mb-16"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="p-8 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-[#b98f42]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#b98f42]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04kM12 20.935a11.903 11.903 0 01-8.618-3.04A12.02 12.02 0 013 9c0-5.591 3.824-10.29 9-11.622 5.176 1.332 9 6.03 9 11.622 0 3.31-.844 6.415-2.382 9.119z"></path></svg>
              </div>
              <h3 className="text-xl font-bold mb-4">Exclusive Listings</h3>
              <p className="text-gray-500">Access to premium properties in Qatar that you won't find anywhere else.</p>
            </div>
            <div className="p-8 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-[#b98f42]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#b98f42]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h3 className="text-xl font-bold mb-4">AI-Powered Search</h3>
              <p className="text-gray-500">Find your perfect home faster with our intelligent property matching system.</p>
            </div>
            <div className="p-8 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-[#b98f42]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#b98f42]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <h3 className="text-xl font-bold mb-4">Expert Agents</h3>
              <p className="text-gray-500">Our team of dedicated professionals will guide you through every step of the process.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 bg-[#b98f42]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">Ready to Find Your Dream Home?</h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto font-light">
            Whether you're looking to buy or rent, our team is ready to help you navigate Qatar's luxury real estate market.
          </p>
          <Link href={`/${locale}/contact`} className="bg-white text-[#b98f42] px-12 py-4 rounded-full font-bold text-lg hover:bg-black hover:text-white transition-all duration-300 shadow-xl">
            Get Started Today
          </Link>
        </div>
      </section>
    </main>
  );
}
