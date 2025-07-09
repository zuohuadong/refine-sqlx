import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        execArgv: ['--experimental-sqlite']
      }
    },
    maxConcurrency: 1,
    fileParallelism: false,
    // 确保在CI环境中Node.js可以访问实验性SQLite功能
    setupFiles: ['./test/setup.ts']
  }
});
