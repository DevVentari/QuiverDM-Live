/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/api/trpc/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  transpilePackages: ['next-themes'],
  // @discordjs/voice pulls a native @snazzah/davey .node binary (DAVE encryption)
  // that webpack can't parse; the discordVoice router imports a const/type from
  // voice-bot.ts, dragging it into the tRPC route bundle. Externalize so it's a
  // runtime require, not bundled — same approach as pdfjs-dist / ffmpeg.
  serverExternalPackages: ['pdfjs-dist', '@discordjs/voice', '@snazzah/davey', 'discord.js', 'prism-media'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-accordion',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-icons',
      '@radix-ui/react-label',
      '@radix-ui/react-progress',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'date-fns',
      'react-markdown',
    ]
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
      },
      {
        protocol: 'https',
        hostname: 'www.dndbeyond.com',
      },
      {
        protocol: 'https',
        hostname: '**.dndbeyond.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'd8j0ntlcm91z4.cloudfront.net',
      },
    ]
  },
  // Increase body size limit for video uploads
  // Default is 4MB, setting to 1GB for D&D session recordings
  serverRuntimeConfig: {
    bodySizeLimit: '1gb',
  },
  webpack: (config, { isServer }) => {
    config.externals = config.externals || [];
    config.externals.push('bufferutil', 'utf-8-validate');
    if (isServer) {
      // These packages use dynamic requires incompatible with webpack bundling
      config.externals.push('@ffmpeg-installer/ffmpeg', 'fluent-ffmpeg');
    }
    // pdfjs-dist optionally imports canvas — alias to false to avoid webpack errors
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    // pdfjs-dist v5 is ESM-only (.mjs). Webpack's ES module initializer
    // (Object.defineProperty on exports) fails for these files — use
    // 'javascript/auto' to treat them as plain scripts instead.
    // Uses path-based test regex to avoid Windows backslash issues with include.
    config.module.rules.push({
      test: /node_modules[/\\](?:pdfjs-dist|react-pdf[/\\]node_modules[/\\]pdfjs-dist)[/\\].*\.mjs$/,
      type: 'javascript/auto',
    });
    return config;
  }
};

module.exports = nextConfig;
