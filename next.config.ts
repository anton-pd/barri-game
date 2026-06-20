import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['postgres'],
  // PostHog uses /ingest paths that must not be trailing-slash-redirected (ANT-170).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // Next.js standalone caches public/ at server startup and does not pick up
      // runtime-generated files. Route dynamic image URLs through an API handler
      // that reads directly from the shared volume.
      { source: '/scenarios/dynamic/:hash.jpg', destination: '/api/image/file/:hash' },

      // PostHog first-party reverse proxy (ANT-170): adblockers block direct
      // requests to *.posthog.com. Proxying analytics through our own domain
      // (barrigame.es/ingest) makes them first-party and unblockable. posthog-js
      // is configured with `api_host: '/ingest'` (see providers.tsx). Static/array
      // asset paths go to the assets CDN; everything else to the ingestion host.
      { source: '/ingest/static/:path*', destination: 'https://eu-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/array/:path*', destination: 'https://eu-assets.i.posthog.com/array/:path*' },
      { source: '/ingest/:path*', destination: 'https://eu.i.posthog.com/:path*' },
    ];
  },
};

export default nextConfig;
