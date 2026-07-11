import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Live shared DB — never parallelize writes across files.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
