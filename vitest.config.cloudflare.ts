// Vitest configuration for Cloudflare Workers runtime
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'edge-runtime', // 使用 edge-runtime 环境模拟 Workers
    setupFiles: ['./test/setup.ts'],
    testTimeout: 90000, // Workers 环境可能需要更长时间
    hookTimeout: 45000,
    teardownTimeout: 15000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    maxConcurrency: 1, // Workers 环境保持单线程
    fileParallelism: false,
    isolate: true,
    include: [
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'packages/**/test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'test/setup.ts'
    ],
    env: {
      TEST_RUNTIME: 'cloudflare-workers'
    }
  },
  resolve: {
    alias: {
      '@': '.'
    }
  },
  esbuild: {
    target: 'es2022' // Cloudflare Workers 支持现代 JS
  },
  define: {
    // 定义 Cloudflare Workers 环境变量
    'globalThis.EdgeRuntime': '"cloudflare-workers"',
    'globalThis.WorkerGlobalScope': 'function WorkerGlobalScope() {}'
  }
});
