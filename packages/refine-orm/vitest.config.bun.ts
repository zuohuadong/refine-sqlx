// Vitest configuration for refine-orm package in Bun runtime
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['../../test/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    maxConcurrency: 2, // Bun 可以支持稍微高一点的并发
    fileParallelism: false,
    isolate: true,
    include: [
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
    env: {
      TEST_RUNTIME: 'bun'
    }
  },
  resolve: {
    alias: {
      '@': '../..'
    }
  },
  esbuild: {
    target: 'node18'
  }
});
