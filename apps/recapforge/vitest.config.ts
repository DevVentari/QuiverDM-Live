import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Playwright owns tests/workflows/**/*.workflow.spec.ts (browser specs). Two
    // exceptions: forge-recap (P4) and forge-recap-publish (P5) exercise their
    // loops without a browser (real Prisma + mocked externals), so they're
    // vitest specs that happen to live in tests/workflows/ — include them
    // explicitly, not via a glob that would also sweep up the Playwright specs.
    include: ['tests/unit/**/*.test.ts', 'tests/workflows/forge-recap.workflow.spec.ts', 'tests/workflows/forge-recap-publish.workflow.spec.ts'],
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
