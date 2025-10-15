import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    // Main entry point (all runtimes)
    // Drizzle ORM is external for main build
    {
      input: 'src/index',
      outDir: 'dist',
      name: 'index',
      declaration: false, // Temporarily disable to debug D1 build
      externals: [
        '@refinedev/core',
        '@cloudflare/workers-types',
        'bun:sqlite',
        'node:sqlite',
        'better-sqlite3',
        'drizzle-orm', // External for main build
      ],
    },
    // D1 optimized entry point (Cloudflare Workers)
    // Bundle Drizzle ORM for D1 to avoid external dependencies
    {
      input: 'src/d1',
      outDir: 'dist',
      name: 'd1',
      builder: 'rollup',
      declaration: false, // Skip declaration for D1 build to avoid Cloudflare types issues
      rollup: {
        esbuild: { minify: true, target: 'es2022', treeShaking: true },
        output: {
          exports: 'named',
          format: 'esm',
          inlineDynamicImports: true, // Create single bundle without code splitting
        },
        // Use Rollup's external option directly
        external: (id: string) => {
          // Only externalize @refinedev/core
          if (id === '@refinedev/core' || id.startsWith('@refinedev/core/')) {
            return true;
          }
          // Bundle everything else including drizzle-orm
          return false;
        },
      },
    },
    // CLI entry point
    {
      input: 'bin/refine-sqlx',
      outDir: 'dist',
      name: 'refine-sqlx',
      builder: 'rollup',
      declaration: false,
      rollup: {
        esbuild: {
          minify: false,
          target: 'es2022',
          banner: '#!/usr/bin/env node',
        },
        output: {
          format: 'esm',
        },
      },
    },
  ],
  outDir: 'dist',
  declaration: false, // Disabled globally for now - will re-enable after D1 bundling works
  rollup: {
    esbuild: { minify: true, target: 'es2022', treeShaking: true },
    emitCJS: false, // ESM only for v0.3.0
    preserveDynamicImports: false,
  },
  failOnWarn: false,
});
