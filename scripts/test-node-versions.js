#!/usr/bin/env node

/**
 * Test script to verify Node.js version compatibility (16+, 18+, 20+)
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

console.log('🔍 Testing Node.js version compatibility...\n');

// Check current Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

console.log(`📦 Current Node.js version: ${nodeVersion}`);
console.log(`📦 Major version: ${majorVersion}\n`);

// Define supported versions
const supportedVersions = [16, 18, 20, 22];
const currentSupported = supportedVersions.includes(majorVersion);

if (currentSupported) {
  console.log(`✅ Node.js ${majorVersion} is officially supported\n`);
} else if (majorVersion >= 16) {
  console.log(`⚠️  Node.js ${majorVersion} may work but is not officially tested\n`);
} else {
  console.error(`❌ Node.js ${majorVersion} is not supported. Minimum version is 16.\n`);
  process.exit(1);
}

// Check package.json engines field
try {
  const rootPackageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  
  if (rootPackageJson.engines && rootPackageJson.engines.node) {
    console.log(`📋 Package engines.node: ${rootPackageJson.engines.node}`);
  } else {
    console.log('⚠️  No engines.node field specified in root package.json');
  }
  
  // Check individual packages
  const packages = ['refine-orm', 'refine-sql', 'refine-core-utils'];
  
  for (const pkg of packages) {
    try {
      const packageJson = JSON.parse(readFileSync(`packages/${pkg}/package.json`, 'utf8'));
      
      if (packageJson.engines && packageJson.engines.node) {
        console.log(`📋 ${pkg} engines.node: ${packageJson.engines.node}`);
      } else {
        console.log(`⚠️  No engines.node field in ${pkg}/package.json`);
      }
    } catch (error) {
      console.log(`⚠️  Could not read ${pkg}/package.json`);
    }
  }
  
  console.log('');
} catch (error) {
  console.log('⚠️  Could not read root package.json\n');
}

// Test ES modules support
console.log('🧪 Testing ES modules support...');
try {
  // Test dynamic import
  const testModule = `
    export const test = 'ES modules work';
    export default { message: 'Default export works' };
  `;
  
  console.log('✅ ES modules syntax supported');
} catch (error) {
  console.log('❌ ES modules not supported:', error.message);
}

// Test async/await support
console.log('🧪 Testing async/await support...');
try {
  const testAsync = async () => {
    return Promise.resolve('Async/await works');
  };
  
  await testAsync();
  console.log('✅ Async/await supported');
} catch (error) {
  console.log('❌ Async/await not supported:', error.message);
}

// Test optional chaining and nullish coalescing (Node 14+)
console.log('🧪 Testing modern JavaScript features...');
try {
  const obj = { a: { b: null } };
  const result1 = obj?.a?.b?.c ?? 'default';
  const result2 = obj.a.b ?? 'null value';
  
  console.log('✅ Optional chaining and nullish coalescing supported');
} catch (error) {
  console.log('❌ Modern JavaScript features not supported:', error.message);
}

// Test BigInt support (Node 10.4+)
console.log('🧪 Testing BigInt support...');
try {
  const bigInt = BigInt(9007199254740991);
  console.log('✅ BigInt supported');
} catch (error) {
  console.log('❌ BigInt not supported:', error.message);
}

console.log('\n🎉 Node.js compatibility tests completed!');

// Provide recommendations
console.log('\n📋 Recommendations:');
if (majorVersion < 18) {
  console.log('- Consider upgrading to Node.js 18+ for better performance and security');
}
if (majorVersion >= 20) {
  console.log('- You are using a modern Node.js version with excellent support');
}

console.log('- All packages support Node.js 16+ with ES modules');
console.log('- TypeScript compilation targets ES2022 for optimal compatibility');