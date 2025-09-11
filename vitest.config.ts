import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.d.ts',
        'examples/',
        'docs/',
      ],
    },
    testTimeout: 30000,
    hookTimeout: 15000,
    teardownTimeout: 10000,
    retry: 1,
  },
  resolve: {
    alias: {
      '@refine-orm/core-utils': path.resolve(
        __dirname,
        'packages/refine-core-utils/src/index.ts'
      ),
    },
  },
});
