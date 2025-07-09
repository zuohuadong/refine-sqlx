// Vitest configuration for Deno runtime
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Deno 可以在 Node 环境下测试
    setupFiles: ['./test/setup.ts'],
    testTimeout: 90000, // Deno 可能需要更长的启动时间
    hookTimeout: 45000,
    teardownTimeout: 15000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    maxConcurrency: 2, // Deno 支持不错的并发
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
      TEST_RUNTIME: 'deno'
    }
  },
  resolve: {
    alias: {
      '@': '.'
    }
  },
  esbuild: {
    target: 'es2022' // Deno 支持现代 JS 特性
  },
  define: {
    // 定义 Deno 环境变量
    'globalThis.Deno': JSON.stringify({
      version: { deno: '1.40.0' },
      env: { toObject: () => ({}) }
    })
  }
});
