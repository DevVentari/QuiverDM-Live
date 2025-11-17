/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@radix-ui/themes', 'lucide-react']
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1200, 1920],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      }
    ]
  },
  // Increase body size limit for video uploads
  // Default is 4MB, setting to 1GB for D&D session recordings
  serverRuntimeConfig: {
    bodySizeLimit: '1gb',
  },
  webpack: (config, { isServer }) => {
    return config;
  }
};

module.exports = nextConfig;
