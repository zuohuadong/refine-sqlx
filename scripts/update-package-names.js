#!/usr/bin/env node

/**
 * Script to update package names from old to new scoped names
 * Usage: node scripts/update-package-names.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔄 Updating package names in documentation and source files...\n');

// Define replacements (order matters)
const replacements = [
  // Import statements
  { from: /from ['"]refine-sql['"]/g, to: "from '@refine-sqlx/sql'" },
  { from: /from ['"]refine-orm['"]/g, to: "from '@refine-sqlx/orm'" },
  { from: /from ['"]refine-core['"]/g, to: "from '@refine-sqlx/core'" },

  // Package installation commands
  { from: /npm install refine-sql/g, to: 'npm install @refine-sqlx/sql' },
  { from: /npm install refine-orm/g, to: 'npm install @refine-sqlx/orm' },
  { from: /npm install refine-core/g, to: 'npm install @refine-sqlx/core' },
  { from: /yarn add refine-sql/g, to: 'yarn add @refine-sqlx/sql' },
  { from: /yarn add refine-orm/g, to: 'yarn add @refine-sqlx/orm' },
  { from: /pnpm add refine-sql/g, to: 'pnpm add @refine-sqlx/sql' },
  { from: /pnpm add refine-orm/g, to: 'pnpm add @refine-sqlx/orm' },
  { from: /bun add refine-sql/g, to: 'bun add @refine-sqlx/sql' },
  { from: /bun add refine-orm/g, to: 'bun add @refine-sqlx/orm' },

  // Markdown bold references
  { from: /\*\*refine-orm\*\*/g, to: '**@refine-sqlx/orm**' },
  { from: /\*\*refine-sql\*\*/g, to: '**@refine-sqlx/sql**' },
  { from: /\*\*refine-core\*\*/g, to: '**@refine-sqlx/core**' },

  // Markdown headers
  { from: /### 🚀 \[refine-orm\]/g, to: '### 🚀 [@refine-sqlx/orm]' },
  { from: /### ⚡ \[refine-sql\]/g, to: '### ⚡ [@refine-sqlx/sql]' },

  // Package names in parentheses
  { from: /refine-sql \(main\)/g, to: '@refine-sqlx/sql (main)' },
  { from: /refine-orm \(main\)/g, to: '@refine-sqlx/orm (main)' },

  // Plain text references (be careful with these - they should be last)
  { from: /refine-sql/g, to: '@refine-sqlx/sql' },
  { from: /refine-orm/g, to: '@refine-sqlx/orm' },
  { from: /refine-core/g, to: '@refine-sqlx/core' },
];

function updateFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const { from, to } of replacements) {
      const newContent = content.replace(from, to);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✓ Updated: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`  ✗ Error updating ${filePath}:`, error.message);
    return false;
  }
}

// Find markdown files
console.log('📝 Processing markdown files...');
const mdFiles = execSync(
  'find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/dist/*" -type f',
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

let mdUpdatedCount = 0;
for (const file of mdFiles) {
  if (updateFile(file)) {
    mdUpdatedCount++;
  }
}

// Find TypeScript example files
console.log('\n📝 Processing TypeScript example files...');
const tsFiles = execSync(
  'find ./examples ./packages/refine-sql/examples ./packages/refine-orm/examples -name "*.ts" -type f 2>/dev/null || true',
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

let tsUpdatedCount = 0;
for (const file of tsFiles) {
  if (updateFile(file)) {
    tsUpdatedCount++;
  }
}

console.log('\n✅ Package names updated successfully!\n');
console.log('Summary of changes:');
console.log(`  ${mdUpdatedCount} markdown files updated`);
console.log(`  ${tsUpdatedCount} TypeScript files updated`);
console.log('\nPackage name mappings:');
console.log('  refine-sql → @refine-sqlx/sql');
console.log('  refine-orm → @refine-sqlx/orm');
console.log('  refine-core → @refine-sqlx/core');
console.log('\nNote: All packages are marked as private and won\'t be published to npm.');
