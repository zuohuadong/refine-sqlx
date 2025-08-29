import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    // Single main entry - contains all functionality
    'src/index.ts',
  ],
  outDir: 'dist',
  declaration: 'node16',
  clean: true,
  failOnWarn: false,
  rollup: {
    esbuild: {
      minify: true,
      target: 'es2022',
      format: 'esm',
      // 启用新标准装饰器支持
      supported: { decorators: true },
      drop: ['console', 'debugger'],
      mangleProps: /^_/,
      treeShaking: true,
      legalComments: 'none',
    },
    emitCJS: true,
    output: {
      compact: true,
      minifyInternalExports: true,
      generatedCode: 'es2015',
    },
  },
  externals: [
    'drizzle-orm',
    'postgres',
    'mysql2',
    'better-sqlite3',
    'bun:sqlite',
    'bun:sql',
  ],
});
