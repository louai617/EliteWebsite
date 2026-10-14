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
