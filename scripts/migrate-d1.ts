#!/usr/bin/env bun
/**
 * D1 Migration Helper Script
 *
 * This script automates the process of applying Drizzle migrations to Cloudflare D1.
 * It reads generated SQL migration files and executes them using wrangler CLI.
 *
 * @see https://developers.cloudflare.com/d1/
 * @see https://orm.drizzle.team/docs/migrations
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';

interface MigrationFile {
  name: string;
  path: string;
  timestamp: number;
}

// Configuration
const MIGRATIONS_DIR = './drizzle/d1';
const DATABASE_NAME = process.env.D1_DATABASE_NAME || 'DB';
const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Get all SQL migration files sorted by timestamp
 */
function getMigrationFiles(): MigrationFile[] {
  try {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => {
        const path = join(MIGRATIONS_DIR, file);
        const stats = statSync(path);
        return { name: file, path, timestamp: stats.mtimeMs };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    return files;
  } catch (error) {
    console.error(`❌ Error reading migrations directory: ${MIGRATIONS_DIR}`);
    console.error(error);
    return [];
  }
}

/**
 * Check if wrangler CLI is available
 */
async function checkWranglerCLI(): Promise<boolean> {
  try {
    await $`wrangler --version`.quiet();
    return true;
  } catch {
    console.error('❌ wrangler CLI not found!');
    console.error('Install with: npm install -g wrangler');
    console.error('Or: bun add -g wrangler');
    return false;
  }
}

/**
 * Apply a single migration file to D1
 */
async function applyMigration(migration: MigrationFile): Promise<boolean> {
  console.log(`\n📄 Applying migration: ${migration.name}`);

  if (DRY_RUN) {
    const sql = readFileSync(migration.path, 'utf-8');
    console.log('--- SQL Content (Dry Run) ---');
    console.log(sql);
    console.log('--- End SQL Content ---');
    return true;
  }

  try {
    // Use wrangler d1 execute to apply migration
    const result =
      await $`wrangler d1 execute ${DATABASE_NAME} --file=${migration.path}`;

    if (result.exitCode === 0) {
      console.log(`✅ Successfully applied: ${migration.name}`);
      return true;
    } else {
      console.error(`❌ Failed to apply: ${migration.name}`);
      console.error(result.stderr.toString());
      return false;
    }
  } catch (error) {
    console.error(`❌ Error applying migration: ${migration.name}`);
    console.error(error);
    return false;
  }
}

/**
 * Main migration process
 */
async function main() {
  console.log('🚀 D1 Migration Tool\n');

  // Check if wrangler is available
  if (!(await checkWranglerCLI())) {
    process.exit(1);
  }

  // Get migration files
  const migrations = getMigrationFiles();

  if (migrations.length === 0) {
    console.log('ℹ️  No migration files found.');
    console.log(`   Generate migrations with: bun run db:generate:d1`);
    process.exit(0);
  }

  console.log(`Found ${migrations.length} migration(s):`);
  migrations.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.name}`);
  });

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be applied');
  }

  console.log(`\nTarget database: ${DATABASE_NAME}\n`);

  // Apply migrations sequentially
  let successCount = 0;
  let failCount = 0;

  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (success) {
      successCount++;
    } else {
      failCount++;
      console.log('\n⚠️  Migration failed. Stopping process.');
      break;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total: ${migrations.length}`);

  if (DRY_RUN) {
    console.log('\n⚠️  This was a dry run. No changes were applied.');
    console.log('   Remove DRY_RUN=true to apply migrations.');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

// Run main process
main().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

/**
 * Usage Examples:
 *
 * 1. Apply all migrations:
 *    bun run db:migrate:d1
 *
 * 2. Dry run (preview without applying):
 *    DRY_RUN=true bun run db:migrate:d1
 *
 * 3. Use custom database name:
 *    D1_DATABASE_NAME=my-database bun run db:migrate:d1
 *
 * 4. Apply specific migration manually:
 *    wrangler d1 execute DB --file=./drizzle/d1/0000_migration.sql
 */
