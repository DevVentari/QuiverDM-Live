/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@quiverdm/shared'],
  eslint: {
    // Quality is gated by tsc + the Playwright/Vitest suites; the Manuscript
    // copy is full of apostrophes ("the players' eyes", "don't") that would
    // otherwise fail the prod build on react/no-unescaped-entities.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
