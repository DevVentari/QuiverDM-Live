import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Playwright owns tests/workflows/**/*.workflow.spec.ts (browser specs). One
    // exception: forge-recap exercises the P4 loop without a browser (real
    // Prisma + mocked chatWithAI), so it's a vitest spec that happens to live
    // in tests/workflows/ — include it explicitly, not via a glob that would
    // also sweep up the Playwright specs.
    include: ['tests/unit/**/*.test.ts', 'tests/workflows/forge-recap.workflow.spec.ts'],
    setupFiles: ['tests/setup.ts'],
    // Live shared DB — never parallelize writes across files.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@main': path.resolve(__dirname, '../../src'),
    },
  },
});
