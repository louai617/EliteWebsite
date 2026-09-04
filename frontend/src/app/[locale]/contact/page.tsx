import React from 'react';
import { getTranslations } from 'next-intl/server';
import { Mail, Phone, MapPin, MessageSquare, Clock } from 'lucide-react';
import LeadForm from '@/components/properties/LeadForm';

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });

  return (
    <main className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-4">
        {/* Header Section */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">{t('contact')}</h1>
          <p className="text-xl text-gray-500 font-light">
            Have a question or looking for your next dream home in Qatar? We're here to help. Contact us through any of the channels below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold mb-8 text-gray-900">Get in Touch</h2>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#b98f42]/10 rounded-full text-[#b98f42]">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Call Us</p>
                    <p className="text-lg font-bold text-gray-900">+974 4444 8888</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#b98f42]/10 rounded-full text-[#b98f42]">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">WhatsApp</p>
                    <p className="text-lg font-bold text-gray-900">+974 5555 1234</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#b98f42]/10 rounded-full text-[#b98f42]">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Email</p>
                    <p className="text-lg font-bold text-gray-900">hello@elitere.qa</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#b98f42]/10 rounded-full text-[#b98f42]">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Office Location</p>
                    <p className="text-lg font-bold text-gray-900">
                      Tornado Tower, Level 22, <br />
                      West Bay, Doha, Qatar
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 pt-6 border-t border-gray-100">
                  <div className="p-3 bg-gray-50 rounded-full text-gray-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Working Hours</p>
                    <p className="text-md text-gray-700">Sunday - Thursday: 9:00 AM - 6:00 PM</p>
                    <p className="text-md text-gray-700">Friday: Closed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold mb-8 text-gray-900">Send us a Message</h2>
              <LeadForm propertyId="" />
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div className="mt-16 w-full h-[500px] rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative">
          <div className="absolute inset-0 bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
            [ Office Map Component ]
          </div>
        </div>
      </div>
    </main>
  );
}
