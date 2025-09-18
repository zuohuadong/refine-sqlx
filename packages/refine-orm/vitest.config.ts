import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'examples/',
        'docs/',
      ],
      thresholds: {
        global: { branches: 60, functions: 60, lines: 60, statements: 60 },
      },
    },
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 20000,
    retry: 1,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        // Run integration tests sequentially to avoid deadlocks
        isolate: true,
      },
    },
    // Run database integration tests in sequence to avoid conflicts
    sequence: { hooks: 'list', setupFiles: 'list', concurrent: false },
    fileParallelism: false, // Disable parallel test file execution for integration tests
  },
  resolve: {
    alias: { '@refine-orm/core-utils': '../refine-core-utils/src/index.ts' },
  },
});
