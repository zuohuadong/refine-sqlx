import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    // Main entry - full functionality
    'src/index.ts',
    // Core module - minimal functionality
    { input: 'src/core/index.ts', name: 'core' },
    // Compatibility module - refine-sqlx compatible
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
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
      target: 'es2022', // 升级到 ES2022 以支持新装饰器
      format: 'esm',
      // 启用新标准装饰器支持
      supported: { decorators: true },
      // Remove development debug code
      drop: ['console', 'debugger'],
      // Mark console methods as pure (can be removed if unused)
      pure: ['console.log', 'console.warn', 'console.info'],
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
    // 注意：refine-core 已从 externals 中移除，会被打包进最终产物
    'bun:sqlite',
    'node:sqlite',
    'better-sqlite3',
    '@cloudflare/workers-types',
  ],
});
