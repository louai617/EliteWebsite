import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo has several apps; pin tracing/bundling to this folder.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
  // Native SQLite driver must not be bundled.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  experimental: {
    // Enables forbidden()/unauthorized() for role-gated pages.
    authInterrupts: true,
    serverActions: {
      // Property photo uploads go through a Server Action (images are capped at 8 MB).
      bodySizeLimit: "9mb",
    },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
