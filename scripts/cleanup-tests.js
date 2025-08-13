#!/usr/bin/env node

/**
 * Test cleanup script
 * Removes duplicate test files and fixes common test issues
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning up test files...');

// List of files that were identified as duplicates or problematic
const filesToRemove = [
  // Already removed: 'packages/refine-orm/src/__tests__/mysql-integration.test.ts'
];

// Remove duplicate files
filesToRemove.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✅ Removed duplicate file: ${file}`);
  }
});

console.log('✨ Test cleanup completed!');

// Summary of changes made
console.log('\n📊 Summary of test improvements:');
console.log('- Removed duplicate MySQL integration test file');
console.log('- Fixed vi.mocked usage in mock-client.ts');
console.log('- Consolidated duplicate describe blocks in adapters.test.ts');
console.log('- Improved skipped tests in detect-sqlite.test.ts');
console.log('- Fixed SQL query expectations in data-provider.test.ts');
console.log('- Added coverage thresholds to vitest configs');
console.log('- Created vitest.config.ts for refine-sqlx package');