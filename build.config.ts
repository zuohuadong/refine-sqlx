import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    // Main entry point (all runtimes)
    'src/index.ts',
    // D1 optimized entry point (Cloudflare Workers)
    {
      input: 'src/d1',
      outDir: 'dist',
      name: 'd1',
      builder: 'rollup',
    },
  ],
  outDir: 'dist',
  declaration: 'node16',
  rollup: {
    esbuild: {
      minify: true,
      target: 'es2022',
      treeShaking: true,
    },
    emitCJS: false, // ESM only for v0.3.0
    preserveDynamicImports: false,
  },
  externals: [
    '@refinedev/core',
    '@cloudflare/workers-types',
    'bun:sqlite',
    'node:sqlite',
    'better-sqlite3',
  ],
  // Don't externalize drizzle-orm - bundle it for optimization
  alias: {
    // Ensure proper Drizzle ORM imports
    'drizzle-orm/bun-sqlite': 'drizzle-orm/bun-sqlite',
    'drizzle-orm/better-sqlite3': 'drizzle-orm/better-sqlite3',
    'drizzle-orm/d1': 'drizzle-orm/d1',
  },
});
