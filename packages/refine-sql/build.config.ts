import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    // Main entry - full functionality
    'src/index.ts',
    // Core module - minimal functionality
    { input: 'src/core/index.ts', name: 'core' },
    // Compatibility module - refine-orm compatible
    { input: 'src/compat/index.ts', name: 'compat' },
    // Runtime-specific modules
    { input: 'src/d1/index.ts', name: 'd1' },
    { input: 'src/bun/index.ts', name: 'bun' },
    { input: 'src/node/index.ts', name: 'node' },
  ],
  outDir: 'dist',
  declaration: 'node16',
  clean: true,
  failOnWarn: false, // Ignore warnings to avoid build failures
  rollup: {
    esbuild: {
      minify: true,
      target: 'es2022', // 升级到 ES2022 以支持新装饰器
      format: 'esm',
      // 启用新标准装饰器支持
      supported: { decorators: true },
      // Remove development debug code
      drop: ['console', 'debugger'],
      // More aggressive compression settings
      mangleProps: /^_/,
      treeShaking: true,
      legalComments: 'none',
    },
    emitCJS: true,
    // Optimize output
    output: {
      compact: true,
      minifyInternalExports: true,
      generatedCode: 'es2015',
    },
  },
  externals: [
    'bun:sqlite',
    'node:sqlite',
    'better-sqlite3',
    '@cloudflare/workers-types',
  ],
});
