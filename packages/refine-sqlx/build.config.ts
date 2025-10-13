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
      minify: false, // Disable minification to fix CJS compatibility
      target: 'es2022',
      // 启用新标准装饰器支持
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: false,
          useDefineForClassFields: false,
        },
      },
      treeShaking: true,
    },
    emitCJS: true,
  },
  externals: [
    // 注意：refine-core-utils 已从 externals 中移除，会被打包进最终产物
    'drizzle-orm',
    'postgres',
    'mysql2',
    'better-sqlite3',
    'bun:sqlite',
    'bun:sql',
  ],
});
