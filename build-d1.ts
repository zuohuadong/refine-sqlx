#!/usr/bin/env bun
/**
 * Custom build script for D1 bundle with Drizzle ORM inlined
 * This ensures D1 Workers don't need external dependencies
 */
import * as esbuild from 'esbuild';
import { writeFileSync } from 'fs';

async function buildD1() {
  console.log('Building D1 bundle with inlined Drizzle ORM...');

  const result = await esbuild.build({
    entryPoints: ['src/d1.ts'],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    outfile: 'dist/d1.mjs',
    platform: 'browser', // Cloudflare Workers use browser-like environment
    treeShaking: true,
    // Only externalize @refinedev/core - bundle everything else including drizzle-orm
    external: ['@refinedev/core'],
    metafile: true, // Generate metadata for analysis
  });

  // Analyze bundle size
  const { outputs } = result.metafile!;
  for (const [path, output] of Object.entries(outputs)) {
    console.log(`✓ ${path}`);
    console.log(`  Size: ${(output.bytes / 1024).toFixed(2)} KB`);
    console.log(`  Imports: ${output.imports.length}`);

    if (output.imports.length > 0) {
      console.log('  External imports:');
      output.imports.forEach(imp => {
        if (imp.external) {
          console.log(`    - ${imp.path}`);
        }
      });
    }
  }

  // Check bundle size and warn if too large
  const bundleSize = outputs['dist/d1.mjs'].bytes;
  if (bundleSize > 1000 * 1024) {
    console.warn(`⚠ Warning: Bundle size (${(bundleSize / 1024).toFixed(2)} KB) exceeds 1MB limit for Workers`);
  } else if (bundleSize > 250 * 1024) {
    console.warn(`⚠ Warning: Bundle size (${(bundleSize / 1024).toFixed(2)} KB) exceeds recommended 250KB`);
  } else {
    console.log(`✓ Bundle size (${(bundleSize / 1024).toFixed(2)} KB) is within limits`);
  }

  // Write metafile for analysis
  writeFileSync('dist/d1-meta.json', JSON.stringify(result.metafile, null, 2));
  console.log('✓ Metafile written to dist/d1-meta.json');
}

buildD1().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
