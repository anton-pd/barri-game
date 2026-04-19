import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['postgres'],
  async rewrites() {
    return [
      // Next.js standalone caches public/ at server startup and does not pick up
      // runtime-generated files. Route dynamic image URLs through an API handler
      // that reads directly from the shared volume.
      { source: '/scenarios/dynamic/:hash.jpg', destination: '/api/image/file/:hash' },
    ];
  },
};

export default nextConfig;
