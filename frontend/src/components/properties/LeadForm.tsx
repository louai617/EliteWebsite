'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import axios from 'axios';

const leadSchema = z.object({
  full_name: z.string().min(3, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(8, 'Valid phone number is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadFormProps {
  propertyId: string;
}

const LeadForm: React.FC<LeadFormProps> = ({ propertyId }) => {
  const t = useTranslations('common');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

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
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/leads`, {
        ...data,
        propertyId,
      });
      setIsSuccess(true);
      reset();
    } catch (error) {
      console.error('Error submitting lead:', error);
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
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
