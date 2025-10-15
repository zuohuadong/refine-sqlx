import type { DrizzleConfig } from 'drizzle-orm';
import { drizzle as drizzleBunSqlite } from 'drizzle-orm/bun-sqlite';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { Database as BunDatabase } from 'bun:sqlite';

/**
 * Create a Drizzle database instance for Bun SQLite
 *
 * @param connection - Bun SQLite database instance or path
 * @param schema - Drizzle schema definition
 * @param config - Optional Drizzle config
 */
export function createBunSQLiteAdapter<TSchema extends Record<string, unknown>>(
  connection: BunDatabase | string | ':memory:',
  schema: TSchema,
  config?: DrizzleConfig<TSchema>,
): BunSQLiteDatabase<TSchema> {
  let db: BunDatabase;

  // Create or use existing Bun SQLite database
  if (typeof connection === 'string') {
    // Dynamic import for bun:sqlite
    const { Database } = require('bun:sqlite');
    db = new Database(connection);
  } else {
    db = connection;
  }

  // Create Drizzle instance
  return drizzleBunSqlite(db, { schema, ...config });
}

/**
 * Check if Bun SQLite is available
 */
export function isBunSQLiteAvailable(): boolean {
  try {
    return typeof Bun !== 'undefined' && typeof require('bun:sqlite') !== 'undefined';
  } catch {
    return false;
  }
}
