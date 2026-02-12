import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    // Main entry point
    {
      input: 'src/index',
      outDir: 'dist',
      name: 'index',
      declaration: false,
      externals: [
        '@refinedev/core',
        '@cloudflare/workers-types',
        'drizzle-orm',
      ],
      builder: 'rollup',
      rollup: {
        output: {
          format: 'esm',
          // Preserve all exports from entry point
          preserveEntrySignatures: 'allow-extension',
          // Enable tree-shaking but keep re-exports
          interop: 'auto',
        },
      },
    },
    // D1 helper entry point
    {
      input: 'src/d1',
      outDir: 'dist',
      name: 'd1',
      declaration: false,
      externals: [
        '@refinedev/core',
        '@cloudflare/workers-types',
        'drizzle-orm',
      ],
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
        output: { format: 'esm' },
        // Simple externals for CLI
        external: (id) => id.startsWith('node:') || id === 'drizzle-kit' || id.startsWith('drizzle-kit/'),
      },
    },
  ],
  outDir: 'dist',
  declaration: false,
  rollup: {
    esbuild: { minify: true, target: 'es2022', treeShaking: true },
    emitCJS: false, // Pure ESM
  },
  failOnWarn: false,
});
