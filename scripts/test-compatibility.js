#!/usr/bin/env node

/**
 * Test script to verify Node.js compatibility and ESM/CJS dual module support
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const packages = ['refine-orm', 'refine-sql', 'refine-core-utils'];

console.log('🔍 Testing Node.js compatibility and module formats...\n');

// Check Node.js version
const nodeVersion = process.version;
console.log(`📦 Node.js version: ${nodeVersion}`);

const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 16) {
  console.error('❌ Node.js 16+ is required');
  process.exit(1);
}

console.log('✅ Node.js version is compatible\n');

// Test each package
for (const pkg of packages) {
  console.log(`🧪 Testing package: ${pkg}`);

  const packagePath = join('packages', pkg);
  const distPath = join(packagePath, 'dist');

  if (!existsSync(distPath)) {
    console.log(`⚠️  Dist folder not found for ${pkg}, skipping...`);
    continue;
  }

  // Test ESM import
  try {
    const esmPath = join(distPath, 'index.mjs');
    if (existsSync(esmPath)) {
      execSync(
        `node -e "import('${esmPath}').then(() => console.log('  ✅ ESM import works'))"`,
        { stdio: 'inherit', timeout: 10000 }
      );
    } else {
      console.log('  ⚠️  ESM file not found');
    }
  } catch (error) {
    console.log('  ❌ ESM import failed:', error.message);
  }

  // Test CJS require
  try {
    const cjsPath = join(distPath, 'index.cjs');
    if (existsSync(cjsPath)) {
      execSync(
        `node -e "const pkg = require('${cjsPath}'); console.log('  ✅ CJS require works')"`,
        { stdio: 'inherit', timeout: 10000 }
      );
    } else {
      console.log('  ⚠️  CJS file not found');
    }
  } catch (error) {
    console.log('  ❌ CJS require failed:', error.message);
  }

  // Check package.json exports
  const packageJsonPath = join(packagePath, 'package.json');
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.exports) {
      console.log('  ✅ Package exports defined');
    } else {
      console.log('  ⚠️  Package exports not defined');
    }

    if (packageJson.sideEffects === false) {
      console.log('  ✅ Tree-shaking enabled (sideEffects: false)');
    } else {
      console.log('  ⚠️  Tree-shaking not optimized');
    }
  }

  console.log('');
}

// Test TypeScript compatibility
console.log('🔍 Testing TypeScript compatibility...');
try {
  execSync('npx tsc --version', { stdio: 'inherit' });
  execSync('npm run typecheck', { stdio: 'inherit' });
  console.log('✅ TypeScript compatibility verified\n');
} catch (error) {
  console.log('❌ TypeScript compatibility failed\n');
}

// Test package sizes
console.log('📏 Checking package sizes...');
try {
  execSync('npx size-limit', { stdio: 'inherit' });
  console.log('✅ Package sizes within limits\n');
} catch (error) {
  console.log('⚠️  Package size check failed or limits exceeded\n');
}

console.log('🎉 Compatibility tests completed!');
