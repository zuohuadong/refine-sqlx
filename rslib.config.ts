import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
    },
    tsconfigPath: './tsconfig.build.json',
  },
  lib: [
    // ESM 格式
    {
      format: 'esm',
      dts: {
        bundle: true,
      },
      output: {
        distPath: {
          root: './dist',
        },
        minify: true,
        sourceMap: false,
      },
    },
    // CJS 格式
    {
      format: 'cjs',
      dts: {
        bundle: true,
      },
      output: {
        distPath: {
          root: './dist',
        },
        minify: true,
        sourceMap: false,
      },
    },
  ],
  output: {
    target: 'node',
    cleanDistPath: true,
  },
  tools: {
    rspack: {
      externals: {
        '@refinedev/core': '@refinedev/core',
        'node:sqlite': 'node:sqlite',
      },
      optimization: {
        minimize: true,
        sideEffects: false,
        usedExports: true,
        providedExports: true,
        innerGraph: true,
        mangleExports: true,
        concatenateModules: true,
        removeAvailableModules: true,
        removeEmptyChunks: true,
        mergeDuplicateChunks: true,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
      },
      resolve: {
        symlinks: false,
        preferRelative: true,
      },
      performance: {
        hints: false,
      },
      mode: 'production',
    },
  },
});
