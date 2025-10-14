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
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
      target: 'es2022',
      // 启用新标准装饰器支持
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: false,
          useDefineForClassFields: false,
        },
      },
      treeShaking: true,
      // More aggressive compression settings
      mangleProps: /^_/,
      legalComments: 'none',
    },
    emitCJS: true,
  },
  externals: [
    // 注意：refine-core 已从 externals 中移除，会被打包进最终产物
    'drizzle-orm',
    'postgres',
    'mysql2',
    'better-sqlite3',
    'bun:sqlite',
    'bun:sql',
  ],
});
