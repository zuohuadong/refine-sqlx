// Vitest configuration for Edge Runtime (Vercel Edge, etc.)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'edge-runtime', // 使用 edge-runtime 环境
    setupFiles: ['./test/setup.ts'],
    testTimeout: 75000, // Edge Runtime 可能需要适中的时间
    hookTimeout: 40000,
    teardownTimeout: 15000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    maxConcurrency: 1, // Edge Runtime 保持单线程
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
      TEST_RUNTIME: 'edge-light'
    }
  },
  resolve: {
    alias: {
      '@': '.'
    }
  },
  esbuild: {
    target: 'es2022' // Edge Runtime 支持现代 JS
  },
  define: {
    // 定义 Edge Runtime 环境变量
    'globalThis.EdgeRuntime': '"edge-runtime"'
  }
});
