#!/usr/bin/env node

/**
 * Test script to verify tree-shaking support and bundle optimization
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const packages = ['refine-sqlx', 'refine-d1', 'refine-core-utils'];

console.log('🌳 Testing tree-shaking support and bundle optimization...\n');

// Create temporary test directory
const tempDir = join(
  tmpdir(),
  `tree-shaking-test-${randomBytes(8).toString('hex')}`
);
mkdirSync(tempDir, { recursive: true });

console.log(`📁 Using temp directory: ${tempDir}\n`);

for (const pkg of packages) {
  console.log(`🧪 Testing tree-shaking for: ${pkg}`);

  const packagePath = join('packages', pkg);
  const distPath = join(packagePath, 'dist');

  if (!existsSync(distPath)) {
    console.log(`⚠️  Dist folder not found for ${pkg}, skipping...\n`);
    continue;
  }

  // Check package.json sideEffects field
  const packageJsonPath = join(packagePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    if (packageJson.sideEffects === false) {
      console.log('  ✅ sideEffects: false - Tree-shaking enabled');
    } else if (Array.isArray(packageJson.sideEffects)) {
      console.log(
        `  ⚠️  sideEffects array specified: ${packageJson.sideEffects.join(', ')}`
      );
    } else {
      console.log(
        '  ❌ sideEffects not set to false - Tree-shaking may not work optimally'
      );
    }

    // Check exports field for proper ESM/CJS dual package
    if (packageJson.exports) {
      console.log(
        '  ✅ Package exports defined - Supports conditional exports'
      );

      const mainExport = packageJson.exports['.'];
      if (mainExport && mainExport.import && mainExport.require) {
        console.log('  ✅ Dual package (ESM/CJS) exports configured');
      } else {
        console.log('  ⚠️  Incomplete dual package exports');
      }
    } else {
      console.log(
        '  ⚠️  No package exports - May not support conditional imports'
      );
    }

    // Check module field
    if (packageJson.module) {
      console.log(`  ✅ Module field present: ${packageJson.module}`);
    } else {
      console.log(
        '  ⚠️  No module field - Bundlers may not detect ESM version'
      );
    }
  }

  // Test selective imports
  const testSelectiveImport = join(tempDir, `test-selective-${pkg}.mjs`);

  try {
    // Create a test file that imports only specific functions
    let importStatement = '';
    let testCode = '';

    if (pkg === 'refine-sqlx') {
      importStatement = `import { createPostgreSQLProvider } from '${join(process.cwd(), distPath, 'index.mjs')}';`;
      testCode = `
console.log('Testing selective import for ${pkg}');
console.log('createPostgreSQLProvider imported successfully');
`;
    } else if (pkg === 'refine-d1') {
      importStatement = `import { createProvider } from '${join(process.cwd(), distPath, 'index.mjs')}';`;
      testCode = `
console.log('Testing selective import for ${pkg}');
console.log('createProvider imported successfully');
`;
    } else if (pkg === 'refine-core-utils') {
      importStatement = `import { SqlTransformer } from '${join(process.cwd(), distPath, 'index.mjs')}';`;
      testCode = `
console.log('Testing selective import for ${pkg}');
console.log('SqlTransformer imported successfully');
`;
    }

    writeFileSync(testSelectiveImport, importStatement + testCode);

    execSync(`node "${testSelectiveImport}"`, { stdio: 'inherit' });
    console.log(`  ✅ Selective import works for ${pkg}`);
  } catch (error) {
    console.log(`  ❌ Selective import failed for ${pkg}:`, error.message);
  }

  // Test namespace import
  const testNamespaceImport = join(tempDir, `test-namespace-${pkg}.mjs`);

  try {
    writeFileSync(
      testNamespaceImport,
      `
import * as ${pkg.replace(/-/g, '')} from '${join(process.cwd(), distPath, 'index.mjs')}';
console.log('Testing namespace import for ${pkg}');
console.log('Available exports:', Object.keys(${pkg.replace(/-/g, '')}));
`
    );

    execSync(`node "${testNamespaceImport}"`, { stdio: 'inherit' });
    console.log(`  ✅ Namespace import works for ${pkg}`);
  } catch (error) {
    console.log(`  ❌ Namespace import failed for ${pkg}:`, error.message);
  }

  // Check for common tree-shaking issues
  const mainFile = join(distPath, 'index.mjs');
  if (existsSync(mainFile)) {
    const content = readFileSync(mainFile, 'utf8');

    // Check for side effects in the main file
    const sideEffectPatterns = [
      /console\.(log|warn|error)/g,
      /window\./g,
      /global\./g,
      /process\.env/g,
    ];

    let hasSideEffects = false;
    for (const pattern of sideEffectPatterns) {
      if (pattern.test(content)) {
        hasSideEffects = true;
        break;
      }
    }

    if (hasSideEffects) {
      console.log('  ⚠️  Potential side effects detected in main file');
    } else {
      console.log('  ✅ No obvious side effects in main file');
    }

    // Check for proper ES module exports
    if (content.includes('export ') || content.includes('export{')) {
      console.log('  ✅ ES module exports detected');
    } else {
      console.log('  ⚠️  No ES module exports detected');
    }
  }

  console.log('');
}

// Test bundle size with different import strategies
console.log('📏 Testing bundle size impact...');

try {
  // This would require a bundler like esbuild or rollup
  // For now, just check file sizes
  for (const pkg of packages) {
    const distPath = join('packages', pkg, 'dist');
    const mainFile = join(distPath, 'index.mjs');

    if (existsSync(mainFile)) {
      const stats = require('fs').statSync(mainFile);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`  📦 ${pkg} main bundle: ${sizeKB} KB`);
    }
  }
} catch (error) {
  console.log('  ⚠️  Could not analyze bundle sizes');
}

// Cleanup
execSync(`rm -rf "${tempDir}"`);

console.log('\n🎉 Tree-shaking tests completed!');

console.log('\n📋 Tree-shaking best practices:');
console.log('- Set "sideEffects": false in package.json');
console.log('- Use named exports instead of default exports when possible');
console.log('- Avoid side effects in module initialization');
console.log('- Provide both ESM and CJS builds');
console.log('- Use conditional exports for optimal bundler support');
