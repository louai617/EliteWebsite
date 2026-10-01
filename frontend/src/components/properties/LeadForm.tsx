'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { api, errorMessage } from '@/lib/api';

const leadSchema = z.object({
  full_name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().email('Invalid email address'),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Enter a valid phone number, e.g. +974 5512 3456'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
  /** Honeypot (hidden from people). */
  website: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadFormProps {
  propertyId: string;
}

const LeadForm: React.FC<LeadFormProps> = ({ propertyId }) => {
  const t = useTranslations('common');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
  });

  const onSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Creates a lead in the CRM (backend/src/services/portal.ts → createPublicLead).
      await api.post('/public/leads', {
        fullName: data.full_name,
        email: data.email,
        phone: data.phone,
        message: `${data.message}\n\nWebsite listing: ${propertyId}`,
        propertyRef: propertyId,
        website: data.website ?? '',
      });
      setIsSuccess(true);
      reset();
    } catch (err) {
      setError(errorMessage(err, 'Your inquiry could not be sent. Please try again or contact us on WhatsApp.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-green-50 p-6 rounded-lg text-center">
        <h3 className="text-xl font-bold text-green-800 mb-2">Thank You!</h3>
        <p className="text-green-700">Your inquiry has been sent successfully. One of our agents will contact you shortly.</p>
        <button 
          onClick={() => setIsSuccess(false)}
          className="mt-4 text-green-800 font-semibold underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-xl font-bold mb-6 text-gray-900">{t('send_inquiry')}</h3>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>}
        <input {...register('website')} type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('full_name')}</label>
          <input
            {...register('full_name')}
            className="w-full px-4 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-[#b98f42] focus:border-transparent outline-none transition-all"
            placeholder="John Doe"
          />
          {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
            <input
              {...register('email')}
              type="email"
              className="w-full px-4 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-[#b98f42] focus:border-transparent outline-none transition-all"
              placeholder="john@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('phone')}</label>
            <input
              {...register('phone')}
              className="w-full px-4 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-[#b98f42] focus:border-transparent outline-none transition-all"
              placeholder="+974 0000 0000"
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('message')}</label>
          <textarea
            {...register('message')}
            rows={4}
            className="w-full px-4 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-[#b98f42] focus:border-transparent outline-none transition-all resize-none"
            placeholder="I am interested in this property..."
          />
          {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-black text-white font-bold py-3 rounded hover:bg-[#b98f42] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending...' : t('submit')}
        </button>
      </form>
    </div>
  );
};

export default LeadForm;
