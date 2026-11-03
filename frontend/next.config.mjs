import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** Listing photos uploaded in the CRM are served by the agent app (app.eliterealestate.qa). */
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api');
const isLocalApi = ['localhost', '127.0.0.1'].includes(apiUrl.hostname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    // AVIF first (about 20–30% smaller than WebP), WebP for browsers without AVIF.
    formats: ['image/avif', 'image/webp'],
    // Keep optimized copies for a day (default 4 h); a removed photo still drops off within a day.
    minimumCacheTTL: 60 * 60 * 24,
    // No 2048 / 3840 px variants: listing photos are never handed out bigger than 1920 px
    // (smaller files, and less worth taking).
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      {
        protocol: apiUrl.protocol.replace(':', ''),
        hostname: apiUrl.hostname,
        ...(apiUrl.port ? { port: apiUrl.port } : {}),
        pathname: '/api/uploads/**',
      },
    ],
    // Only in local development, where the agent app runs on localhost.
    dangerouslyAllowLocalIP: isLocalApi && process.env.NODE_ENV !== 'production',
  },
};

export default withNextIntl(nextConfig);
