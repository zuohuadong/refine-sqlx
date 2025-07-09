import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: ['src/index.ts'],
  outDir: 'dist',
  declaration: 'node16',
  rollup: {
    esbuild: { minify: true },
    emitCJS: true,
    preserveDynamicImports: true,
  },
  externals: [
    'bun:sqlite',
    'node:sqlite',
    'better-sqlite3',
    '@cloudflare/workers-types',
  ],
});
