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
      // Photo (8 MB) and document (10 MB) uploads go through Server Actions.
      bodySizeLimit: "11mb",
    },
    // The proxy buffers request bodies up to this size (default 10 MB, and larger bodies are
    // silently cut off). 12 MB covers 10 MB document uploads plus multipart overhead; big
    // videos use /api/media-upload, which the proxy skips.
    proxyClientMaxBodySize: "12mb",
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
