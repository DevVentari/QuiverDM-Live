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
    // Fix for @react-three/fiber compatibility with React 18.3
    // The bundled ESM version has react-reconciler issues, so we need to use the CJS version
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Force @react-three/fiber to use CJS version which properly uses external react-reconciler
        '@react-three/fiber': require.resolve('@react-three/fiber/dist/react-three-fiber.cjs.js'),
      };
    }
    return config;
  },
  // Transpile @react-three packages for compatibility
  transpilePackages: ['three', '@react-three/drei', '@react-three/rapier']
};

module.exports = nextConfig;
