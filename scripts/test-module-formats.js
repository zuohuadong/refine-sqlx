#!/usr/bin/env node

/**
 * Test script to verify ESM/CJS dual module format correctness
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const packages = ['refine-orm', 'refine-sqlx', 'refine-core-utils'];

console.log('🔍 Testing ESM/CJS dual module format correctness...\n');

// Create temporary test files
const tempDir = join(tmpdir(), `module-test-${randomBytes(8).toString('hex')}`);
execSync(`mkdir -p "${tempDir}"`);

console.log(`📁 Using temp directory: ${tempDir}\n`);

for (const pkg of packages) {
  console.log(`🧪 Testing package: ${pkg}`);

  const packagePath = join('packages', pkg);
  const distPath = join(packagePath, 'dist');

  if (!existsSync(distPath)) {
    console.log(`⚠️  Dist folder not found for ${pkg}, skipping...\n`);
    continue;
  }

  // Test ESM import in ESM context
  const esmTestFile = join(tempDir, `test-esm-${pkg}.mjs`);
  const esmImportPath = join(process.cwd(), distPath, 'index.mjs');

  if (existsSync(esmImportPath)) {
    writeFileSync(
      esmTestFile,
      `
import pkg from '${esmImportPath}';
console.log('ESM import successful for ${pkg}');
console.log('Exported keys:', Object.keys(pkg || {}));
`
    );

    try {
      execSync(`node "${esmTestFile}"`, { stdio: 'inherit' });
      console.log(`  ✅ ESM import works for ${pkg}`);
    } catch (error) {
      console.log(`  ❌ ESM import failed for ${pkg}:`, error.message);
    }
  } else {
    console.log(`  ⚠️  ESM file not found for ${pkg}`);
  }

  // Test CJS require in CJS context
  const cjsTestFile = join(tempDir, `test-cjs-${pkg}.cjs`);
  const cjsRequirePath = join(process.cwd(), distPath, 'index.cjs');

  if (existsSync(cjsRequirePath)) {
    writeFileSync(
      cjsTestFile,
      `
const pkg = require('${cjsRequirePath}');
console.log('CJS require successful for ${pkg}');
console.log('Exported keys:', Object.keys(pkg || {}));
`
    );

    try {
      execSync(`node "${cjsTestFile}"`, { stdio: 'inherit' });
      console.log(`  ✅ CJS require works for ${pkg}`);
    } catch (error) {
      console.log(`  ❌ CJS require failed for ${pkg}:`, error.message);
    }
  } else {
    console.log(`  ⚠️  CJS file not found for ${pkg}`);
  }

  // Test mixed import/require (ESM importing CJS)
  const mixedTestFile = join(tempDir, `test-mixed-${pkg}.mjs`);

  if (existsSync(cjsRequirePath)) {
    writeFileSync(
      mixedTestFile,
      `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('${cjsRequirePath}');
console.log('Mixed ESM->CJS import successful for ${pkg}');
`
    );

    try {
      execSync(`node "${mixedTestFile}"`, { stdio: 'inherit' });
      console.log(`  ✅ Mixed ESM->CJS import works for ${pkg}`);
    } catch (error) {
      console.log(
        `  ❌ Mixed ESM->CJS import failed for ${pkg}:`,
        error.message
      );
    }
  }

  // Verify package.json exports configuration
  const packageJsonPath = join(packagePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    if (packageJson.exports && packageJson.exports['.']) {
      const mainExport = packageJson.exports['.'];

      if (mainExport.import && mainExport.require) {
        console.log(`  ✅ Dual exports configured for ${pkg}`);

        // Verify files exist
        const importFile = join(
          packagePath,
          mainExport.import.default || mainExport.import
        );
        const requireFile = join(
          packagePath,
          mainExport.require.default || mainExport.require
        );

        if (existsSync(importFile)) {
          console.log(
            `  ✅ ESM export file exists: ${mainExport.import.default || mainExport.import}`
          );
        } else {
          console.log(
            `  ❌ ESM export file missing: ${mainExport.import.default || mainExport.import}`
          );
        }

        if (existsSync(requireFile)) {
          console.log(
            `  ✅ CJS export file exists: ${mainExport.require.default || mainExport.require}`
          );
        } else {
          console.log(
            `  ❌ CJS export file missing: ${mainExport.require.default || mainExport.require}`
          );
        }
      } else {
        console.log(`  ⚠️  Incomplete dual exports for ${pkg}`);
      }
    } else {
      console.log(`  ⚠️  No exports configuration for ${pkg}`);
    }

    // Check type definitions
    if (
      packageJson.types ||
      (packageJson.exports &&
        packageJson.exports['.'] &&
        packageJson.exports['.'].types)
    ) {
      console.log(`  ✅ TypeScript definitions configured for ${pkg}`);
    } else {
      console.log(`  ⚠️  TypeScript definitions not configured for ${pkg}`);
    }
  }

  console.log('');
}

// Cleanup
execSync(`rm -rf "${tempDir}"`);

console.log('🎉 Module format tests completed!');
